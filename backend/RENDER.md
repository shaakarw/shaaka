# Deploy the backend to Render

Create a Render **Web Service** from this repository with:

- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/health`

Render provides `PORT` at runtime. The server binds to `0.0.0.0` and uses that
port; do not hard-code a port in the Render dashboard.

Configure these backend environment variables in Render:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `JWT_SECRET`
- `ADMIN_PHONE`
- `ADMIN_PASSWORD`

Add the storage, payment, email, and push-notification variables required by
the application features you enable. Keep credentials in Render's environment
settings rather than in source control.

The backend's Socket.IO and online-user state are held in process memory, so
run a single instance. Cron jobs are enabled by default; set `CRON_ENABLED=false`
only when scheduled work is managed elsewhere. The repository-root `render.yaml`
provides a Blueprint with these settings and prompts for required secrets.
