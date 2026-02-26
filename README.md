# Selenite
The frontend web-ui made in svelte for the Zentra App

## Docs submodule setup

The frontend serves docs from `frontend/docs`.

Initialize/update the docs submodule:

```bash
git submodule update --init --recursive docs
```

If you need to add it in a fresh clone where it is missing:

```bash
git submodule add https://github.com/zentra-chat/zentra-docs.git docs
git submodule update --init --recursive docs
```

## Deploy build + host binary

Run:

```bash
./scripts/deploy-frontend.sh deploy \
	--instance-url https://zentra-main.abstractmelon.net \
	--instance-name "Zentra Main" \
	--port 4173
```

The script will:

- create/update `.env`
- build the frontend static files into `build/`
- compile a Go binary at `dist/zentra-frontend-host`
- generate a launcher at `dist/run-frontend.sh`

## Fast update (pull + rebuild frontend only)

To pull latest changes and update frontend assets without recreating everything:

```bash
./scripts/deploy-frontend.sh update --branch main
```

Optional update flags:
- `--instance-url <url>` and `--instance-name <name>` to update `.env`
- `--port <port>` to regenerate `dist/run-frontend.sh` with a different host port
- `--rebuild-go-host` if you also want to rebuild the Go host binary

Start the hosted frontend with:

```bash
./dist/run-frontend.sh
```