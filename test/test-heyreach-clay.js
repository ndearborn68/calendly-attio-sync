/**
 * Test script for HeyReach + Clay webhook integration
 * Run: node test/test-heyreach-clay.js
 */

const http = require('http');

const SERVER_URL = 'http://localhost:3000';

/**
 * Sample HeyReach webhook payload
 * Triggered when a lead is tagged as "interested"
 */
const sampleHeyReachPayload = {
  event: 'lead_tagged',
  tag: 'interested',
  timestamp: new Date().toISOString(),
  lead: {
    linkedin_url: 'https://www.linkedin.com/in/johndoe',
    name: 'John Doe',
    first_name: 'John',
    last_name: 'Doe',
    company: 'Acme Corp',
    title: 'VP of Engineering'
  },
  messages: [
    {
      sender: 'Me',
      text: 'Hi John, I came across your profile and was impressed by your work at Acme Corp.',
      sent_at: '2024-01-15T10:00:00Z',
      is_outbound: true
    },
    {
      sender: 'John Doe',
      text: 'Thanks for reaching out! I\'d be happy to learn more about what you\'re working on.',
      sent_at: '2024-01-15T14:30:00Z',
      is_outbound: false
    },
    {
      sender: 'Me',
      text: 'Great! We\'re building a platform that helps teams manage their workflows. Would you be open to a quick call this week?',
      sent_at: '2024-01-15T15:00:00Z',
      is_outbound: true
    },
    {
      sender: 'John Doe',
      text: 'Sure, I\'m interested. How about Thursday at 2pm?',
      sent_at: '2024-01-15T16:45:00Z',
      is_outbound: false
    }
  ]
};

/**
 * Sample Clay enrichment webhook payload
 * Sent after Clay enriches the lead data
 */
const sampleClayPayload = {
  event: 'enrichment_complete',
  data: {
    linkedin_url: 'https://www.linkedin.com/in/johndoe',
    email: 'john.doe@acme.com',
    phone: '+1-555-123-4567',
    full_name: 'John Doe',
    first_name: 'John',
    last_name: 'Doe',
    company: 'Acme Corp',
    title: 'VP of Engineering'
  }
};

/**
 * Send a POST request to the webhook endpoint
 */
function sendWebhook(endpoint, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, SERVER_URL);
    const data = JSON.stringify(payload);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: body ? JSON.parse(body) : null
        });
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('HeyReach + Clay Integration Test');
  console.log('='.repeat(60));

  try {
    // Test 1: Health check
    console.log('\n1. Testing health endpoint...');
    const healthRes = await sendWebhook('/health', {});
    console.log(`   Status: ${healthRes.statusCode === 404 ? 'Checking with GET...' : healthRes.statusCode}`);

    // Test 2: HeyReach webhook
    console.log('\n2. Sending HeyReach webhook (lead tagged as interested)...');
    console.log(`   LinkedIn: ${sampleHeyReachPayload.lead.linkedin_url}`);
    console.log(`   Lead: ${sampleHeyReachPayload.lead.name}`);
    console.log(`   Messages: ${sampleHeyReachPayload.messages.length} messages`);
    
    const heyreachRes = await sendWebhook('/webhook/heyreach', sampleHeyReachPayload);
    console.log(`   Response: ${heyreachRes.statusCode} - ${JSON.stringify(heyreachRes.body)}`);

    // Give it a moment to process
    console.log('\n   Waiting 2 seconds for processing...');
    await new Promise(r => setTimeout(r, 2000));

    // Test 3: Clay enrichment webhook
    console.log('\n3. Sending Clay enrichment webhook...');
    console.log(`   LinkedIn: ${sampleClayPayload.data.linkedin_url}`);
    console.log(`   Email: ${sampleClayPayload.data.email}`);
    console.log(`   Phone: ${sampleClayPayload.data.phone}`);
    
    const clayRes = await sendWebhook('/webhook/clay', sampleClayPayload);
    console.log(`   Response: ${clayRes.statusCode} - ${JSON.stringify(clayRes.body)}`);

    console.log('\n' + '='.repeat(60));
    console.log('Tests completed! Check server logs for processing details.');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\nTest failed:', error.message);
    console.log('\nMake sure the server is running: npm start');
    process.exit(1);
  }
}

// Run tests
runTests();
