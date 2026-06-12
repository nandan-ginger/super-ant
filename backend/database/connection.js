'use strict';
const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * PostgreSQL connection pool.
 * Single pool shared across the entire application.
 */
const poolConfig = config.pg.connectionString
  ? {
      connectionString: config.pg.connectionString,
      ssl: config.pg.ssl ? { rejectUnauthorized: false } : false,
    }
  : {
      host: config.pg.host,
      port: config.pg.port,
      database: config.pg.database,
      user: config.pg.user,
      password: config.pg.password,
      ssl: config.pg.ssl ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool({
  ...poolConfig,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', { error: err.message });
});

pool.on('connect', () => {
  logger.debug('New PostgreSQL client connected');
});

/**
 * Run a parameterised query against the pool.
 * @param {string} text  SQL query with $1, $2 placeholders
 * @param {any[]} [params]  Query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { query: text.slice(0, 80), duration, rows: result.rowCount });
    return result;
  } catch (err) {
    logger.error('Query failed', { query: text.slice(0, 80), error: err.message });
    throw err;
  }
}

/**
 * Test the database connection.
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  try {
    await pool.query('SELECT NOW()');
    logger.info('PostgreSQL connection established');
    return true;
  } catch (err) {
    logger.error('PostgreSQL connection failed', { error: err.message });
    return false;
  }
}

/**
 * Gracefully close the pool (used on process exit).
 */
async function closePool() {
  await pool.end();
  logger.info('PostgreSQL pool closed');
}

module.exports = { query, testConnection, closePool, pool };
