const { Pool } = require('pg');
const { URL } = require('url');

const connectionString = 'postgresql://postgres:SdcrNWbXKBayflAwimJIhBArGiGlGnIZ@hopper.proxy.rlwy.net:57367/railway';

const dbUrl = new URL(connectionString);

const pool = new Pool({
  user: dbUrl.username,
  host: dbUrl.hostname,
  database: dbUrl.pathname.substring(1),
  password: dbUrl.password,
  port: dbUrl.port,
});

pool.connect()
  .then(() => console.log("✅ Database connected successfully!"))
  .catch((err) => console.error("❌ Database connection error:", err));

// Export pool to use in server.js
module.exports = pool;
