/**
 * Configuration and environment validation
 * Fails fast if required variables are missing
 */

// Only Attio is required - other keys are optional depending on which features you use
const REQUIRED_ENV_VARS = [
  'ATTIO_API_KEY'
];

// Optional features:
// - CALENDLY_PAT + OPENAI_API_KEY: For Calendly meeting transcript summaries
// - FATHOM_API_KEY: For Fathom AI transcript integration
// - HeyReach + Clay: No additional keys needed (just Attio)

/**
 * Validate that all required environment variables are set
 * Call this on startup to fail fast if misconfigured
 */
function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('\n❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nCopy .env.example to .env and fill in your API keys.\n');
    process.exit(1);
  }

  console.log('✅ Environment variables validated');
}

/**
 * Get configuration object with all settings
 */
function getConfig() {
  return {
    // API Keys - Core (required)
    calendlyPat: process.env.CALENDLY_PAT,
    attioApiKey: process.env.ATTIO_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,

    // Fathom accounts - multiple accounts supported
    // Each account has its own API key and webhook secret
    fathomAccounts: {
      recruitcloud: {
        apiKey: process.env.FATHOM_RECRUITCLOUD_API_KEY || null,
        webhookSecret: process.env.FATHOM_RECRUITCLOUD_WEBHOOK_SECRET || null
      },
      datalabs: {
        apiKey: process.env.FATHOM_DATALABS_API_KEY || null,
        webhookSecret: process.env.FATHOM_DATALABS_WEBHOOK_SECRET || null
      }
    },

    // Legacy single Fathom keys (for backwards compatibility)
    fathomApiKey: process.env.FATHOM_API_KEY || null,
    fathomWebhookSecret: process.env.FATHOM_WEBHOOK_SECRET || null,

    // HeyReach integration (optional webhook secret for verification)
    heyreachWebhookSecret: process.env.HEYREACH_WEBHOOK_SECRET || null,

    // Clay enrichment integration (optional webhook secret for verification)
    clayWebhookSecret: process.env.CLAY_WEBHOOK_SECRET || null,

    // Notifications (optional)
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || null,

    // Server settings
    port: parseInt(process.env.PORT, 10) || 3000,

    // Retry settings for transcript polling
    retry: {
      maxAttempts: 5,
      baseDelayMs: 30000,  // 30 seconds
      maxDelayMs: 900000   // 15 minutes
    },

    // OpenAI settings
    openai: {
      model: 'gpt-4o',
      temperature: 0.3,
      maxTokens: 1500
    }
  };
}

/**
 * Get Fathom config for a specific account
 * @param {string} accountId - Account identifier (recruitcloud, datalabs)
 * @returns {object} - { apiKey, webhookSecret }
 */
function getFathomAccountConfig(accountId) {
  const config = getConfig();
  const account = config.fathomAccounts[accountId];

  if (account && account.apiKey) {
    return account;
  }

  // Fall back to legacy single key
  return {
    apiKey: config.fathomApiKey,
    webhookSecret: config.fathomWebhookSecret
  };
}

module.exports = { validateEnv, getConfig, getFathomAccountConfig };
