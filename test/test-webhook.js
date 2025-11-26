/**
 * Test script to simulate a Calendly webhook
 * Run with: npm test
 */

const axios = require('axios');

const TEST_PAYLOAD = {
  event: 'invitee.created',
  payload: {
    email: 'test@example.com',
    name: 'Test User',
    scheduled_event: {
      uri: 'https://api.calendly.com/scheduled_events/TEST-EVENT-123',
      start_time: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      end_time: new Date(Date.now() - 1800000).toISOString()    // 30 min ago
    }
  }
};

async function testWebhook() {
  const url = process.env.WEBHOOK_URL || 'http://localhost:3000/webhook/calendly';

  console.log('Sending test webhook to:', url);
  console.log('Payload:', JSON.stringify(TEST_PAYLOAD, null, 2));

  try {
    const response = await axios.post(url, TEST_PAYLOAD, {
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('\n✅ Webhook accepted');
    console.log('Response:', response.data);
  } catch (error) {
    console.error('\n❌ Webhook failed');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data || error.message);
  }
}

testWebhook();
