/**
 * Fathom webhook handler
 * Orchestrates the flow: Fathom → OpenAI → Attio
 */

const { getConfig, getFathomAccountConfig } = require('./config');
const { log } = require('./logger');
const { processFathomWebhook, verifyFathomWebhook } = require('./fathom');
const { generateSummary } = require('./openai');
const { upsertPersonAndNote } = require('./attio');
const { sendSlackError } = require('./slack');
const { findMatch } = require('./meeting-store');

/**
 * Handle incoming Fathom webhook
 * @param {object} payload - Webhook payload from Fathom
 * @param {string} accountId - Account identifier (recruitcloud, datalabs)
 * @param {string} signature - Webhook signature header (optional)
 * @param {string} rawBody - Raw request body for signature verification
 */
async function handleFathomWebhook(payload, accountId = null, signature = null, rawBody = null) {
  const config = getConfig();
  const fathomConfig = getFathomAccountConfig(accountId);
  let currentStep = 'parse_payload';

  try {
    log('info', 'Processing Fathom webhook', {
      type: payload.event || payload.type,
      meetingId: payload.meeting_id || payload.id,
      account: accountId || 'default'
    });

    // Verify webhook signature if configured
    if (signature && fathomConfig.webhookSecret) {
      const isValid = verifyFathomWebhook(signature, rawBody, fathomConfig.webhookSecret);
      if (!isValid) {
        throw new Error('Invalid Fathom webhook signature');
      }
    }

    // Step 1: Process Fathom webhook and extract data
    currentStep = 'process_fathom';
    const meetingData = await processFathomWebhook(payload, fathomConfig);

    log('info', 'Fathom data extracted', {
      guestEmail: meetingData.guestEmail,
      transcriptLength: meetingData.transcript?.length
    });

    // Step 2: Generate AI summary
    currentStep = 'generate_summary';
    log('info', 'Generating AI summary...');
    const summary = await generateSummary(meetingData.transcript, config);

    // Correlate with Calendly booking (best-effort)
    const matched = findMatch({
      meetingUrl: meetingData.meetingUrl,
      guestEmail: meetingData.guestEmail,
      hostEmail: meetingData.hostEmail,
      startTime: meetingData.startTime
    });

    const correlationNote = matched
      ? `Matched Calendly event: ${matched.eventUuid}\nMeeting URL: ${matched.meetingUrl || 'n/a'}\nStart: ${matched.startTime || 'n/a'}`
      : 'No Calendly match found';

    const summaryWithContext = `${summary}\n\n---\n${correlationNote}`;

    log('info', 'Summary generated', { length: summary.length });

    // Step 3: Upsert to Attio
    currentStep = 'attio_upsert';
    log('info', 'Upserting to Attio...');
    const result = await upsertPersonAndNote(
      meetingData.guestEmail,
      meetingData.guestName,
      summaryWithContext,
      config
    );

    log('info', 'Successfully synced Fathom meeting to Attio', {
      personId: result.personId,
      noteId: result.noteId,
      guestEmail: meetingData.guestEmail,
      source: 'fathom',
      account: accountId || 'default'
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
