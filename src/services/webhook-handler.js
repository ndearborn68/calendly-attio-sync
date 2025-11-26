/**
 * Main webhook handler
 * Orchestrates the full flow: Calendly → OpenAI → Attio
 */

const { getConfig } = require('./config');
const { log } = require('./logger');
const { pollForTranscript } = require('./calendly');
const { generateSummary } = require('./openai');
const { upsertPersonAndNote } = require('./attio');
const { sendSlackError } = require('./slack');

/**
 * Handle incoming Calendly webhook
 * This is the main orchestration function
 */
async function handleCalendlyWebhook(payload) {
  const config = getConfig();
  let currentStep = 'parse_payload';

  try {
    // Step 1: Parse the webhook payload
    log('info', 'Processing Calendly webhook', { event: payload.event });

    // Only process invitee.created events
    if (payload.event !== 'invitee.created') {
      log('info', 'Skipping non-invitee event', { event: payload.event });
      return;
    }

    const eventData = payload.payload;
    const eventUri = eventData.scheduled_event?.uri;
    const eventUuid = eventUri?.split('/').pop();
    const guestEmail = eventData.email;
    const guestName = eventData.name || '';
    const endTime = new Date(eventData.scheduled_event?.end_time);

    if (!eventUuid || !guestEmail) {
      throw new Error('Missing required fields: eventUuid or guestEmail');
    }

    log('info', 'Parsed webhook data', { eventUuid, guestEmail, endTime });

    // Step 2: Wait for meeting to end (if not already)
    currentStep = 'wait_for_meeting';
    const now = new Date();
    if (now < endTime) {
      const waitMs = endTime - now + 60000; // Wait until end + 1 minute
      log('info', `Meeting not ended, waiting ${waitMs}ms`);
      await sleep(waitMs);
    }

    // Step 3: Poll for transcript
    currentStep = 'poll_transcript';
    log('info', 'Polling for transcript...');
    const transcript = await pollForTranscript(eventUuid, config);

    if (!transcript) {
      throw new Error('Transcript not available after maximum retries');
    }

    log('info', 'Transcript retrieved', { length: transcript.length });

    // Step 4: Generate AI summary
    currentStep = 'generate_summary';
    log('info', 'Generating AI summary...');
    const summary = await generateSummary(transcript, config);

    log('info', 'Summary generated', { length: summary.length });

    // Step 5: Upsert to Attio
    currentStep = 'attio_upsert';
    log('info', 'Upserting to Attio...');
    const result = await upsertPersonAndNote(guestEmail, guestName, summary, config);

    log('info', 'Successfully synced to Attio', {
      personId: result.personId,
      noteId: result.noteId,
      guestEmail
    });

    return result;

  } catch (error) {
    log('error', `Failed at step: ${currentStep}`, {
      error: error.message,
      stack: error.stack
    });

    // Send Slack notification if configured
    await sendSlackError(currentStep, error, config);

    throw error;
  }
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { handleCalendlyWebhook };
