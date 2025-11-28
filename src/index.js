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

// Fathom AI webhook endpoint - generic (uses legacy keys)
app.post('/webhook/fathom', async (req, res) => {
  try {
    // Acknowledge receipt immediately
    res.status(200).json({ received: true });

    // Process the webhook asynchronously
    const signature = req.headers['webhook-signature'] || req.headers['x-fathom-signature'];
    await handleFathomWebhook(req.body, null, signature, JSON.stringify(req.body));

  } catch (error) {
    log('error', 'Fathom webhook processing failed', { error: error.message });
  }
});

// Fathom AI webhook endpoint - RecruitCloud account
app.post('/webhook/fathom/recruitcloud', async (req, res) => {
  try {
    res.status(200).json({ received: true });
    const signature = req.headers['webhook-signature'] || req.headers['x-fathom-signature'];
    await handleFathomWebhook(req.body, 'recruitcloud', signature, JSON.stringify(req.body));
  } catch (error) {
    log('error', 'Fathom (RecruitCloud) webhook processing failed', { error: error.message });
  }
});

// Fathom AI webhook endpoint - DataLabs Corp account
app.post('/webhook/fathom/datalabs', async (req, res) => {
  try {
    res.status(200).json({ received: true });
    const signature = req.headers['webhook-signature'] || req.headers['x-fathom-signature'];
    await handleFathomWebhook(req.body, 'datalabs', signature, JSON.stringify(req.body));
  } catch (error) {
    log('error', 'Fathom (DataLabs) webhook processing failed', { error: error.message });
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
  log('info', `Fathom webhook (generic): http://localhost:${PORT}/webhook/fathom`);
  log('info', `Fathom webhook (RecruitCloud): http://localhost:${PORT}/webhook/fathom/recruitcloud`);
  log('info', `Fathom webhook (DataLabs): http://localhost:${PORT}/webhook/fathom/datalabs`);
  log('info', `Health check: http://localhost:${PORT}/health`);
});
