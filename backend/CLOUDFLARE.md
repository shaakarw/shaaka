# Deploy the backend to Cloudflare

The backend runs as a Node.js server with Socket.IO and native media-processing
dependencies. The root `wrangler.jsonc` deploys it as a Cloudflare Container
behind a Worker; it is not an Expo web export or a Pages static site.

## Requirements

- A Cloudflare Workers Paid plan with Containers enabled.
- Connect this repository as a **Worker** using Workers Builds, not as a Pages
  project.
- In the Worker build settings, use the repository root as the root directory,
  leave the frontend build command empty, and set the deploy command to:

  ```sh
  npx wrangler deploy
  ```

The root Wrangler config and `Dockerfile` are used to build and deploy the API
container. Do not use `npx expo export -p web` for this Worker.

## Configure secrets

In the `shaaka` Worker settings, add the following under **Variables and
Secrets**. Mark credentials and tokens as secrets.

Required for startup:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `JWT_SECRET`
- `ADMIN_PHONE`
- `ADMIN_PASSWORD`

Set `API_PUBLIC_URL` to the deployed Worker URL. Other feature-specific
settings are optional, but media, email, and push-notification features need
their corresponding values:

- B2 storage: `B2_APPLICATION_KEY`, `B2_BUCKET_NAME`, `B2_ENDPOINT`,
  `B2_KEY_ID`, `B2_REGION`
- Image Cloudinary: `IMAGE_CLOUD_NAME`, `IMAGE_API_KEY`, `IMAGE_API_SECRET`
  (or `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`)
- Video Cloudinary: `VIDEO_CLOUD_NAME`, `VIDEO_API_KEY`, `VIDEO_API_SECRET`
- Email: `EMAIL_USER`, `EMAIL_PASS`, `CLIENT_URL`
- Push notifications: `EXPO_ACCESS_TOKEN`
- Optional logging: `DEBUG_LOGS`, `PERF_LOGS`

The Worker passes these values into the container at startup. The container
uses port `5000`; do not set a different `PORT`.

The current deployment intentionally uses one container instance because the
backend keeps Socket.IO and online-user state in process memory. Cloudflare
may stop an idle container, so its in-process cron jobs are not a reliable
scheduler; move them to Worker Cron Triggers before relying on them. Move
Socket.IO and online-user state to shared services before increasing
`max_instances`.
