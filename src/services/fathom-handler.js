/**
 * Fathom webhook handler
 * Orchestrates the flow: Fathom → OpenAI → Attio
 */

const { getConfig } = require('./config');
const { log } = require('./logger');
const { processFathomWebhook } = require('./fathom');
const { generateSummary } = require('./openai');
const { upsertPersonAndNote } = require('./attio');
const { sendSlackError } = require('./slack');

/**
 * Handle incoming Fathom webhook
 * @param {object} payload - Webhook payload from Fathom
 */
async function handleFathomWebhook(payload) {
  const config = getConfig();
  let currentStep = 'parse_payload';

  try {
    log('info', 'Processing Fathom webhook', {
      type: payload.event || payload.type,
      meetingId: payload.meeting_id || payload.id
    });

    // Step 1: Process Fathom webhook and extract data
    currentStep = 'process_fathom';
    const meetingData = await processFathomWebhook(payload, config);

    log('info', 'Fathom data extracted', {
      guestEmail: meetingData.guestEmail,
      transcriptLength: meetingData.transcript?.length
    });

    // Step 2: Generate AI summary
    currentStep = 'generate_summary';
    log('info', 'Generating AI summary...');
    const summary = await generateSummary(meetingData.transcript, config);

    log('info', 'Summary generated', { length: summary.length });

    // Step 3: Upsert to Attio
    currentStep = 'attio_upsert';
    log('info', 'Upserting to Attio...');
    const result = await upsertPersonAndNote(
      meetingData.guestEmail,
      meetingData.guestName,
      summary,
      config
    );

    log('info', 'Successfully synced Fathom meeting to Attio', {
      personId: result.personId,
      noteId: result.noteId,
      guestEmail: meetingData.guestEmail,
      source: 'fathom'
    });

    return result;

  } catch (error) {
    log('error', `Fathom handler failed at step: ${currentStep}`, {
      error: error.message,
      stack: error.stack
    });

    // Send Slack notification if configured
    await sendSlackError(currentStep, error, config);

    throw error;
  }
}

module.exports = { handleFathomWebhook };
