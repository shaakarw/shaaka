import { DurableObject } from 'cloudflare:workers';

const BACKEND_PORT = 5000;
const STARTUP_TIMEOUT_MS = 60_000;
const RETRY_DELAY_MS = 500;
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

const BACKEND_ENV_KEYS = [
  'ADMIN_PHONE',
  'ADMIN_PASSWORD',
  'ADMIN_USERNAME',
  'API_PUBLIC_URL',
  'B2_APPLICATION_KEY',
  'B2_BUCKET_NAME',
  'B2_ENDPOINT',
  'B2_KEY_ID',
  'B2_REGION',
  'CLIENT_URL',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'DEBUG_LOGS',
  'EMAIL_PASS',
  'EMAIL_USER',
  'EXPO_ACCESS_TOKEN',
  'IMAGE_API_KEY',
  'IMAGE_API_SECRET',
  'IMAGE_CLOUD_NAME',
  'JWT_SECRET',
  'PERF_LOGS',
  'TURSO_AUTH_TOKEN',
  'TURSO_DATABASE_URL',
  'VIDEO_API_KEY',
  'VIDEO_API_SECRET',
  'VIDEO_CLOUD_NAME',
];

export class ShaakaBackend extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.starting = undefined;
  }

  async fetch(request) {
    this.starting ??= this.startAndWaitForBackend().finally(() => {
      this.starting = undefined;
    });
    await this.starting;

    const url = new URL(request.url);
    url.protocol = 'http:';
    url.host = 'container';
    const forwardedRequest = new Request(url, request);
    forwardedRequest.headers.delete('host');
    return this.ctx.container.getTcpPort(BACKEND_PORT).fetch(forwardedRequest);
  }

  async startAndWaitForBackend() {
    const container = this.ctx.container;
    if (!container) {
      throw new Error('Shaaka backend container is not configured.');
    }

    if (!container.running) {
      const env = { PORT: String(BACKEND_PORT) };
      for (const key of BACKEND_ENV_KEYS) {
        const value = this.env[key];
        if (typeof value === 'string') env[key] = value;
      }
      container.start({ enableInternet: true, env });
    }

    await container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);
    const port = container.getTcpPort(BACKEND_PORT);
    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    let lastError;

    while (Date.now() < deadline) {
      try {
        const response = await port.fetch('http://container/', {
          signal: AbortSignal.timeout(2000),
        });
        await response.body?.cancel();
        if (response.ok) return;
        lastError = new Error(`Backend readiness check returned HTTP ${response.status}.`);
      } catch (error) {
        lastError = error;
      }
      await scheduler.wait(RETRY_DELAY_MS);
    }

    throw new Error('Shaaka backend did not become ready on port 5000.', {
      cause: lastError,
    });
  }
}

export default {
  fetch(request, env) {
    return env.BACKEND.getByName('shaaka-backend').fetch(request);
  },
};
