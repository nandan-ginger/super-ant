'use strict';
const express = require('express');
const router = express.Router();

// Import chatbot sub-routes
const dashboardRouter  = require('./routes/dashboard');
const widgetsRouter    = require('./routes/widgets');
const livechatsRouter  = require('./routes/livechats');
const visitorsRouter   = require('./routes/visitors');
const leadsRouter      = require('./routes/leads');
const chatRouter       = require('./routes/chat');
const pageRulesRouter  = require('./routes/pageRules');

// Mount sub-routes
router.use('/dashboard',  dashboardRouter);
router.use('/widgets',    widgetsRouter);
router.use('/livechats',  livechatsRouter);
router.use('/visitors',   visitorsRouter);
router.use('/leads',      leadsRouter);
router.use('/chat',       chatRouter);
router.use('/page-rules', pageRulesRouter);

// Import socket handler
const { attachChatHandlers } = require('./sockets/chatHandler');

module.exports = {
  router,
  attachChatHandlers,
};
