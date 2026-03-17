## Nagios Plugin Generator Web App

This project is a small web app that lets you:

- **Enter plugin metadata and a command** to run.
- **Generate a Bash Nagios plugin script** with proper exit codes and `--help` / `--version`.
- **Save the script on the server** and **download** it.
- **Optionally copy the script into a Nagios container** via the Docker Engine socket.

### Stack

- Node.js + Express (TypeScript)
- Simple static HTML/JS frontend served by the backend
- Docker/Docker Compose for an optional dev stack with a sample Nagios container

### Running locally (no Docker)

```bash
cd "Nagios Plugin Generator/server"
npm install
npm run dev
```

Then open `http://localhost:3000` in your browser.

> Note: The “Copy into Nagios container” action will only work when the app
> can talk to Docker (for example when `docker.sock` is available and a Nagios
> container is running).

### Running with Docker Compose (with sample Nagios)

Requirements:

- Docker and Docker Compose installed
- Access to `/var/run/docker.sock` on the host

From the project root:

```bash
docker compose up --build
```

This will start:

- `plugin-generator` on port `3000`.
- `nagios` on port `8080` (default login for the demo image is described on its Docker Hub page).

The two containers share a volume mounted at:

- `/app/generated-plugins` inside the generator.
- `/usr/local/nagios/libexec` inside the Nagios container.

So any generated plugin scripts that you copy into the container will appear under `libexec` for Nagios to use.

### Environment variables

The server honors:

- `PORT` – HTTP port (default `3000`).
- `NAGIOS_CONTAINER_NAME` – Docker container name/ID for copy (default `nagios`).
- `NAGIOS_TARGET_DIR` – Target directory inside the container (default `/usr/local/nagios/libexec`).

You can set these in `server/.env` (not committed).

### Development notes

- TypeScript build:

  ```bash
  cd "Nagios Plugin Generator/server"
  npm run build
  ```

- The generated scripts live in `server/generated-plugins` (gitignored).
- The UI is in `server/public/index.html`.

