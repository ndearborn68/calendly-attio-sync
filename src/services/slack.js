/**
 * Slack notification service
 * Sends error alerts to configured webhook
 */

const axios = require('axios');
const { log } = require('./logger');

/**
 * Send error notification to Slack (if configured)
 * @param {string} step - The step that failed
 * @param {Error} error - The error object
 * @param {object} config - Configuration object
 */
async function sendSlackError(step, error, config) {
  const webhookUrl = config.slackWebhookUrl;

  if (!webhookUrl) {
    log('info', 'Slack webhook not configured, skipping notification');
    return;
  }

  const payload = {
    text: '❌ Calendly → Attio Sync Failed',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '❌ Calendly → Attio Sync Failed',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Step:*\n${step}`
          },
          {
            type: 'mrkdwn',
            text: `*Time:*\n${new Date().toISOString()}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error:*\n\`\`\`${error.message}\`\`\``
        }
      }
    ]
  };

  try {
    await axios.post(webhookUrl, payload);
    log('info', 'Slack notification sent');
  } catch (slackError) {
    // Don't throw - just log the failure
    log('error', 'Failed to send Slack notification', {
      error: slackError.message
    });
  }
}

module.exports = { sendSlackError };
