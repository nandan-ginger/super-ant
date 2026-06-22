'use strict';
const mongoose = require('mongoose');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Connect to MongoDB using Mongoose.
 * Single connection shared across the entire application.
 */
async function connectDB() {
  try {
    await mongoose.connect(config.mongodb.uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logger.info('MongoDB connection established');
    return true;
  } catch (err) {
    logger.error('MongoDB connection failed', { error: err.message });
    return false;
  }
}

/**
 * Gracefully close the MongoDB connection (used on process exit).
 */
async function disconnectDB() {
  await mongoose.disconnect();
  logger.info('MongoDB connection closed');
}

// Log connection events
mongoose.connection.on('error', (err) => {
  logger.error('Unexpected MongoDB error', { error: err.message });
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});

module.exports = { connectDB, disconnectDB, mongoose };
