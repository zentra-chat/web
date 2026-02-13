# Selenite
The frontend web-ui made in svelte for the Zentra App

## Deploy build + host binary

Run:

```bash
./scripts/deploy-frontend.sh
```

The script will:

- ask for frontend host port
- ask for default instance URL and name
- create/update `.env`
- build the frontend static files into `build/`
- compile a Go binary at `dist/zentra-frontend-host`
- generate a launcher at `dist/run-frontend.sh`

Start the hosted frontend with:

```bash
./dist/run-frontend.sh
```