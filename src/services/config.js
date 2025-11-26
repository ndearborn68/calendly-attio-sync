/**
 * Configuration and environment validation
 * Fails fast if required variables are missing
 */

const REQUIRED_ENV_VARS = [
  'CALENDLY_PAT',
  'ATTIO_API_KEY',
  'OPENAI_API_KEY'
];

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
    // API Keys
    calendlyPat: process.env.CALENDLY_PAT,
    attioApiKey: process.env.ATTIO_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
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
      maxTokens: 400
    }
  };
}

module.exports = { validateEnv, getConfig };
