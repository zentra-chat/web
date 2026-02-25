#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$FRONTEND_DIR/dist"
GO_HOST_PKG="$FRONTEND_DIR/scripts/go-host"
GO_BINARY="$DIST_DIR/zentra-frontend-host"
RUN_SCRIPT="$DIST_DIR/run-frontend.sh"

DEFAULT_PORT="4173"
DEFAULT_INSTANCE_URL="http://localhost:8080"
DEFAULT_INSTANCE_NAME="Zentra Local"

ACTION="deploy"
FRONTEND_PORT=""
INSTANCE_URL=""
INSTANCE_NAME=""
BRANCH="main"
REMOTE="origin"
SKIP_INSTALL="false"
SKIP_GO_BUILD="false"
REBUILD_GO_ON_UPDATE="false"

usage() {
	cat <<'EOF'
Usage:
  scripts/deploy-frontend.sh [action] [options]

Actions:
  deploy         Build frontend and host artifacts (default)
  update         Pull latest code and rebuild frontend only (fast path)

Options:
  --port <port>                  Frontend host port for dist/run-frontend.sh (default: 4173)
  --instance-url <url>           PUBLIC_DEFAULT_INSTANCE_URL value
  --instance-name <name>         PUBLIC_DEFAULT_INSTANCE_NAME value
  --branch <branch>              Git branch for update action (default: main)
  --remote <remote>              Git remote for update action (default: origin)
  --skip-install                 Skip dependency install step
  --skip-go-build                Skip Go host binary build (deploy action)
  --rebuild-go-host              Rebuild Go host binary during update action
  -h, --help                     Show this help

Examples:
  scripts/deploy-frontend.sh deploy --instance-url https://zentra.example --instance-name "Zentra"
  scripts/deploy-frontend.sh update --branch main
  scripts/deploy-frontend.sh update --instance-url https://new.example --instance-name "New API"
EOF
}

detect_package_manager() {
	if command -v pnpm >/dev/null 2>&1; then
		PACKAGE_MANAGER="pnpm"
		INSTALL_CMD=(pnpm install --frozen-lockfile)
		BUILD_CMD=(pnpm build)
	elif command -v npm >/dev/null 2>&1; then
		PACKAGE_MANAGER="npm"
		INSTALL_CMD=(npm ci)
		BUILD_CMD=(npm run build)
	else
		echo "Error: neither pnpm nor npm is installed."
		exit 1
	fi
}

ensure_dependencies() {
	if [[ "${SKIP_INSTALL}" == "true" ]]; then
		echo "Skipping dependency installation"
		return
	fi

	echo "Installing dependencies..."
	(
		cd "$FRONTEND_DIR"
		"${INSTALL_CMD[@]}"
	)
}

build_frontend() {
	echo "Building frontend..."
	(
		cd "$FRONTEND_DIR"
		"${BUILD_CMD[@]}"
	)
}

get_env_value() {
	local key="$1"
	if [[ -f "$FRONTEND_DIR/.env" ]]; then
		grep -E "^${key}=" "$FRONTEND_DIR/.env" | head -n1 | cut -d'=' -f2- || true
	fi
}

resolve_env_values() {
	local current_url current_name
	current_url="$(get_env_value PUBLIC_DEFAULT_INSTANCE_URL)"
	current_name="$(get_env_value PUBLIC_DEFAULT_INSTANCE_NAME)"

	if [[ -z "$INSTANCE_URL" ]]; then
		INSTANCE_URL="${current_url:-$DEFAULT_INSTANCE_URL}"
	fi
	if [[ -z "$INSTANCE_NAME" ]]; then
		INSTANCE_NAME="${current_name:-$DEFAULT_INSTANCE_NAME}"
	fi
}

write_env_file() {
	cat > "$FRONTEND_DIR/.env" <<EOF
PUBLIC_DEFAULT_INSTANCE_URL=$INSTANCE_URL
PUBLIC_DEFAULT_INSTANCE_NAME=$INSTANCE_NAME
EOF
	echo "Wrote $FRONTEND_DIR/.env"
}

write_run_script() {
	mkdir -p "$DIST_DIR"
	cat > "$RUN_SCRIPT" <<EOF
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
"\$SCRIPT_DIR/zentra-frontend-host" --port "$FRONTEND_PORT" --dir "\$SCRIPT_DIR/../build"
EOF
	chmod +x "$RUN_SCRIPT"
}

ensure_go_host_scaffold() {
	mkdir -p "$DIST_DIR"
	mkdir -p "$GO_HOST_PKG"

	if [[ ! -f "$GO_HOST_PKG/go.mod" ]]; then
		cat > "$GO_HOST_PKG/go.mod" <<'EOF'
module zentra/frontend-host

go 1.22
EOF
	fi

	if [[ ! -f "$GO_HOST_PKG/main.go" ]]; then
		cat > "$GO_HOST_PKG/main.go" <<'EOF'
package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	port := flag.String("port", "4173", "port to listen on")
	dir := flag.String("dir", "./build", "directory to serve")
	flag.Parse()

	root, err := filepath.Abs(*dir)
	if err != nil {
		log.Fatalf("invalid directory: %v", err)
	}

	if info, statErr := os.Stat(root); statErr != nil || !info.IsDir() {
		log.Fatalf("build directory does not exist: %s", root)
	}

	indexPath := filepath.Join(root, "index.html")
	if _, statErr := os.Stat(indexPath); statErr != nil {
		log.Fatalf("index.html not found in build directory: %s", indexPath)
	}

	fileServer := http.FileServer(http.Dir(root))

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cleanPath := strings.TrimPrefix(filepath.Clean(r.URL.Path), "/")
		requested := filepath.Join(root, cleanPath)
		if info, statErr := os.Stat(requested); statErr == nil && !info.IsDir() {
			fileServer.ServeHTTP(w, r)
			return
		}

		if strings.HasPrefix(r.URL.Path, "/assets") || strings.HasPrefix(r.URL.Path, "/_app") {
			fileServer.ServeHTTP(w, r)
			return
		}

		http.ServeFile(w, r, indexPath)
	})

	addr := ":" + *port
	log.Printf("Serving %s on http://localhost%s", root, addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
EOF
	fi
}

build_go_host() {
	if ! command -v go >/dev/null 2>&1; then
		echo "Error: go is not installed."
		exit 1
	fi

	ensure_go_host_scaffold

	echo "Building Go host binary..."
	(
		cd "$GO_HOST_PKG"
		go build -o "$GO_BINARY" .
	)
}

run_deploy() {
	resolve_env_values
	FRONTEND_PORT="${FRONTEND_PORT:-$DEFAULT_PORT}"

	echo "Frontend deployment setup"
	echo "========================="
	echo "Action: deploy"
	echo "Port: ${FRONTEND_PORT}"
	echo "Instance URL: ${INSTANCE_URL}"
	echo "Instance Name: ${INSTANCE_NAME}"

	write_env_file
	detect_package_manager
	echo "Using package manager: $PACKAGE_MANAGER"
	ensure_dependencies
	build_frontend

	if [[ "${SKIP_GO_BUILD}" != "true" ]]; then
		build_go_host
	else
		echo "Skipping Go host binary build"
	fi

	write_run_script

	echo
	echo "Done."
	echo "Go binary: $GO_BINARY"
	echo "Run command: $RUN_SCRIPT"
}

run_update() {
	echo "Frontend update"
	echo "==============="
	echo "Pulling latest code from ${REMOTE}/${BRANCH}..."
	git -C "$FRONTEND_DIR" fetch "$REMOTE"
	git -C "$FRONTEND_DIR" pull --ff-only "$REMOTE" "$BRANCH"

	local should_write_env
	should_write_env="false"
	if [[ ! -f "$FRONTEND_DIR/.env" || -n "$INSTANCE_URL" || -n "$INSTANCE_NAME" ]]; then
		should_write_env="true"
	fi

	if [[ "$should_write_env" == "true" ]]; then
		resolve_env_values
		write_env_file
	fi

	detect_package_manager
	echo "Using package manager: $PACKAGE_MANAGER"
	ensure_dependencies
	build_frontend

	if [[ "${REBUILD_GO_ON_UPDATE}" == "true" ]]; then
		build_go_host
	fi

	if [[ -n "$FRONTEND_PORT" || ! -f "$RUN_SCRIPT" ]]; then
		FRONTEND_PORT="${FRONTEND_PORT:-$DEFAULT_PORT}"
		write_run_script
	fi

	echo
	echo "Update complete."
	echo "If hosted via process manager, restart it now to serve new build assets."
}

if [[ $# -gt 0 && "${1}" != --* ]]; then
	ACTION="$1"
	shift
fi

while [[ $# -gt 0 ]]; do
	case "$1" in
		--port)
			FRONTEND_PORT="$2"
			shift 2
			;;
		--instance-url)
			INSTANCE_URL="$2"
			shift 2
			;;
		--instance-name)
			INSTANCE_NAME="$2"
			shift 2
			;;
		--branch)
			BRANCH="$2"
			shift 2
			;;
		--remote)
			REMOTE="$2"
			shift 2
			;;
		--skip-install)
			SKIP_INSTALL="true"
			shift
			;;
		--skip-go-build)
			SKIP_GO_BUILD="true"
			shift
			;;
		--rebuild-go-host)
			REBUILD_GO_ON_UPDATE="true"
			shift
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			echo "Unknown option: $1" >&2
			usage
			exit 1
			;;
	esac
done

case "$ACTION" in
	deploy)
		run_deploy
		;;
	update)
		run_update
		;;
	*)
		echo "Unknown action: $ACTION" >&2
		usage
		exit 1
		;;
esac
