const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');

let client;

const getClient = () => {
  if (!client) throw new Error('Turso is not initialized. Call connectDB() first.');
  return client;
};

const applyMigrationStatement = async (database, statement) => {
  const addition = statement.match(
    /^ALTER\s+TABLE\s+([A-Za-z_][A-Za-z0-9_]*)\s+ADD\s+COLUMN\s+([A-Za-z_][A-Za-z0-9_]*)\b/i,
  );
  if (addition) {
    const [, table, column] = addition;
    const tableInfo = await database.execute(`PRAGMA table_info("${table}")`);
    if (tableInfo.rows.some((row) => row.name === column)) return;
  }
  await database.execute(statement);
};

const applyMigrations = async (database) => {
  await database.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);

  const migrationDirectory = path.join(__dirname, '..', 'db', 'migrations');
  const migrationFiles = fs.readdirSync(migrationDirectory)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const name of migrationFiles) {
    const existing = await database.execute({
      sql: 'SELECT name FROM schema_migrations WHERE name = ?',
      args: [name],
    });
    if (existing.rows.length) continue;

    const sql = fs.readFileSync(path.join(migrationDirectory, name), 'utf8');
    for (const statement of sql.split(';').map((part) => part.trim()).filter(Boolean)) {
      await applyMigrationStatement(database, statement);
    }
    await database.execute({
      sql: 'INSERT OR IGNORE INTO schema_migrations (name) VALUES (?)',
      args: [name],
    });
  }
};

const connectDB = async () => {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    const error = new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be configured.');
    error.code = !url && !authToken
      ? 'TURSO_CONFIG_MISSING'
      : !url
        ? 'TURSO_DATABASE_URL_MISSING'
        : 'TURSO_AUTH_TOKEN_MISSING';
    throw error;
  }

  if (client) return client;
  const database = createClient({ url, authToken });
  try {
    await database.execute('SELECT 1');
    await database.execute('PRAGMA foreign_keys = ON');
    await applyMigrations(database);
    client = database;
    console.log('Turso database connected');
    return client;
  } catch (error) {
    database.close();
    console.error('Turso connection error:', error.code || error.cause?.code || 'CONNECTION_FAILED');
    throw error;
  }
};

const closeDB = async () => {
  if (!client) return;
  client.close();
  client = undefined;
};

module.exports = connectDB;
module.exports.getClient = getClient;
module.exports.closeDB = closeDB;
module.exports.applyMigrationStatement = applyMigrationStatement;
