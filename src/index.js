/**
 * Meeting Notetaker → Attio CRM Integration
 * Main entry point - Express server that receives webhooks from multiple sources
 * Supported: Calendly Notetaker, Fathom AI
 */
require('dotenv').config();

const express = require('express');
const { validateEnv } = require('./services/config');
const { handleCalendlyWebhook } = require('./services/webhook-handler');
const { handleFathomWebhook } = require('./services/fathom-handler');
const { log } = require('./services/logger');

// Validate environment variables on startup
validateEnv();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  log('info', `${req.method} ${req.path}`);
  next();
});

// Health check endpoint - use this to verify server is running
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Calendly webhook endpoint
app.post('/webhook/calendly', async (req, res) => {
  try {
    // Acknowledge receipt immediately (Calendly expects fast response)
    res.status(200).json({ received: true });

    // Process the webhook asynchronously
    await handleCalendlyWebhook(req.body);

  } catch (error) {
    log('error', 'Calendly webhook processing failed', { error: error.message });
  }
});

// Fathom AI webhook endpoint
app.post('/webhook/fathom', async (req, res) => {
  try {
    // Acknowledge receipt immediately
    res.status(200).json({ received: true });

    // Process the webhook asynchronously
    await handleFathomWebhook(req.body);

  } catch (error) {
    log('error', 'Fathom webhook processing failed', { error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  log('error', 'Unhandled error', { error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  log('info', `Server running on port ${PORT}`);
  log('info', `Calendly webhook: http://localhost:${PORT}/webhook/calendly`);
  log('info', `Fathom webhook: http://localhost:${PORT}/webhook/fathom`);
  log('info', `Health check: http://localhost:${PORT}/health`);
});
