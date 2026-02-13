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

echo "Frontend deployment setup"
echo "========================="

read -r -p "Frontend host port [$DEFAULT_PORT]: " FRONTEND_PORT
FRONTEND_PORT="${FRONTEND_PORT:-$DEFAULT_PORT}"

read -r -p "Default instance URL [$DEFAULT_INSTANCE_URL]: " INSTANCE_URL
INSTANCE_URL="${INSTANCE_URL:-$DEFAULT_INSTANCE_URL}"

read -r -p "Default instance name [$DEFAULT_INSTANCE_NAME]: " INSTANCE_NAME
INSTANCE_NAME="${INSTANCE_NAME:-$DEFAULT_INSTANCE_NAME}"

cat > "$FRONTEND_DIR/.env" <<EOF
PUBLIC_DEFAULT_INSTANCE_URL=$INSTANCE_URL
PUBLIC_DEFAULT_INSTANCE_NAME=$INSTANCE_NAME
EOF

echo "Created $FRONTEND_DIR/.env"

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

echo "Using package manager: $PACKAGE_MANAGER"

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
	echo "Installing dependencies..."
	(
		cd "$FRONTEND_DIR"
		"${INSTALL_CMD[@]}"
	)
fi

echo "Building frontend..."
(
	cd "$FRONTEND_DIR"
	"${BUILD_CMD[@]}"
)

if ! command -v go >/dev/null 2>&1; then
	echo "Error: go is not installed."
	exit 1
fi

mkdir -p "$DIST_DIR"

echo "Building Go host binary..."
(
	cd "$GO_HOST_PKG"
	go build -o "$GO_BINARY" .
)

cat > "$RUN_SCRIPT" <<EOF
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
"\$SCRIPT_DIR/zentra-frontend-host" --port "$FRONTEND_PORT" --dir "\$SCRIPT_DIR/../build"
EOF

chmod +x "$RUN_SCRIPT"

echo
echo "Done."
echo "Go binary: $GO_BINARY"
echo "Run command: $RUN_SCRIPT"
