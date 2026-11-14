const assert = require('node:assert/strict');
const http = require('node:http');
const { after, before, test } = require('node:test');
const connectDB = require('./config/db');

process.env.PORT = '0';
process.env.TURSO_DATABASE_URL = 'file::memory:';
process.env.TURSO_AUTH_TOKEN = 'server-test';
const { app, server, startServer, shutdown } = require('./server');

let testServer;
let testBaseUrl;
const originalGetClient = connectDB.getClient;

before(async () => {
  testServer = http.createServer(app);
  await new Promise((resolve, reject) => {
    testServer.once('error', reject);
    testServer.listen(0, '127.0.0.1', resolve);
  });
  testBaseUrl = `http://127.0.0.1:${testServer.address().port}`;
});

after(async () => {
  connectDB.getClient = originalGetClient;
  if (testServer?.listening) {
    await new Promise((resolve, reject) => {
      testServer.close(error => error ? reject(error) : resolve());
    });
  }
  if (server.listening) await shutdown();
});

test('GET /health is public, reports liveness, and does not depend on Turso', async () => {
  connectDB.getClient = () => {
    throw new Error('Database unavailable');
  };
  const response = await fetch(`${testBaseUrl}/health`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.status, 'healthy');
  assert.equal(body.service, 'shaaka-backend');
  assert.ok(Number.isFinite(Date.parse(body.timestamp)));
});

test('GET /ready reports database readiness without exposing database errors', async () => {
  connectDB.getClient = () => ({
    execute: async query => {
      assert.equal(query, 'SELECT 1');
      return { rows: [{ 1: 1 }] };
    },
  });
  const readyResponse = await fetch(`${testBaseUrl}/ready`);
  assert.equal(readyResponse.status, 200);
  assert.equal((await readyResponse.json()).status, 'ready');

  connectDB.getClient = () => {
    throw new Error('Private database details');
  };
  const unavailableResponse = await fetch(`${testBaseUrl}/ready`);
  assert.equal(unavailableResponse.status, 503);
  const unavailableBody = await unavailableResponse.json();
  assert.equal(unavailableBody.status, 'not_ready');
  assert.equal(JSON.stringify(unavailableBody).includes('Private database details'), false);
});

test('GET /ready times out when a database query does not complete', async () => {
  connectDB.getClient = () => ({ execute: () => new Promise(() => {}) });
  const startedAt = Date.now();
  const response = await fetch(`${testBaseUrl}/ready`);
  assert.equal(response.status, 503);
  assert.ok(Date.now() - startedAt < 3000);
});

test('server honors PORT, serves Socket.IO, and shuts down gracefully', async () => {
  const oldCloseDB = connectDB.closeDB;
  let databaseClosed = false;
  connectDB.getClient = originalGetClient;
  connectDB.closeDB = async () => {
    databaseClosed = true;
    await oldCloseDB();
  };

  try {
    const runtime = await startServer({
      initializeCron: false,
    });
    const address = runtime.server.address();
    assert.equal(address.address, '0.0.0.0');
    assert.ok(address.port > 0);

    const healthResponse = await fetch(`http://127.0.0.1:${address.port}/health`);
    assert.equal(healthResponse.status, 200);
    const socketResponse = await fetch(
      `http://127.0.0.1:${address.port}/socket.io/?EIO=4&transport=polling`
    );
    assert.equal(socketResponse.status, 200);
    assert.match(await socketResponse.text(), /"sid"/);

    const readyByDeadline = Date.now() + 5000;
    let readyResponse;
    while (Date.now() < readyByDeadline) {
      readyResponse = await fetch(`http://127.0.0.1:${address.port}/ready`);
      if (readyResponse.status === 200) break;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.equal(readyResponse.status, 200);

    await shutdown();
    assert.equal(runtime.server.listening, false);
    assert.equal(databaseClosed, true);
  } finally {
    connectDB.closeDB = oldCloseDB;
  }
});
