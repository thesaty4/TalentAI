require('dotenv').config({ path: require('path').resolve(__dirname, '../../..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on('error', (err) => {
  console.error('Idle client error', err);
  process.exit(-1);
});

module.exports = pool;
