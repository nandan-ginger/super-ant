'use strict';

const { google } = require('googleapis');
const config = require('../../common/config');
const logger = require('../../common/utils/logger');

// ---------------------------------------------------------------------------
// Google — OAuth 2.0 client and Business Profile API factory
// ---------------------------------------------------------------------------

/**
 * Create and configure an OAuth2 client with the stored refresh token.
 * The client automatically handles access token refresh.
 */
function createOAuth2Client() {
  const googleConfig = config.reviewAgent.google;

  const client = new google.auth.OAuth2(
    googleConfig.clientId,
    googleConfig.clientSecret,
    googleConfig.redirectUri
  );

  // Set stored refresh token — the client will auto-refresh access tokens
  client.setCredentials({
    refresh_token: googleConfig.refreshToken,
  });

  // Log token refresh events
  client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      logger.info('Google OAuth — new refresh token received');
    }
    logger.debug('Google OAuth — access token refreshed');
  });

  return client;
}

/**
 * Create a Google My Business (Business Profile) API client instance.
 * Uses the v4 "My Business Account Management" and the legacy
 * "mybusinessbusinessinformation" API for location data.
 */
function createBusinessProfileClient(authClient) {
  return {
    auth: authClient,
    baseUrl: 'https://mybusiness.googleapis.com/v4',
    httpClient: google.options({ auth: authClient }),
  };
}

module.exports = { createOAuth2Client, createBusinessProfileClient };
