/**
 * Calendly API integration
 * Handles polling for meeting transcripts
 */

const axios = require('axios');
const { log } = require('./logger');

/**
 * Poll Calendly API for transcript with exponential backoff
 * @param {string} eventUuid - The Calendly event UUID
 * @param {object} config - Configuration object
 * @returns {string|null} - Transcript text or null if not available
 */
async function pollForTranscript(eventUuid, config) {
  const { maxAttempts, baseDelayMs } = config.retry;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log('info', `Polling transcript attempt ${attempt}/${maxAttempts}`);

    try {
      const response = await axios.get(
        `https://api.calendly.com/scheduled_events/${eventUuid}`,
        {
          headers: {
            Authorization: `Bearer ${config.calendlyPat}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Look for transcript in various possible locations
      const resource = response.data.resource || response.data;
      const meetingNotes = resource.meeting_notes;

      // Try different fields where transcript might be
      const transcript =
        meetingNotes?.transcript ||
        meetingNotes?.transcription ||
        meetingNotes?.summary ||
        resource.transcript ||
        resource.transcription;

      // Validate transcript has meaningful content (at least 50 chars)
      if (transcript && transcript.length > 50) {
        log('info', 'Transcript found', { length: transcript.length });
        return transcript;
      }

      log('info', 'Transcript not ready yet');

    } catch (error) {
      // Log but continue retrying on 404 (not ready yet)
      if (error.response?.status === 404) {
        log('warn', 'Event not found, may not be ready');
      } else {
        log('error', 'Calendly API error', {
          status: error.response?.status,
          message: error.message
        });
      }
    }

    // Don't sleep after the last attempt
    if (attempt < maxAttempts) {
      // Exponential backoff: 30s, 60s, 120s, 240s, 480s
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      log('info', `Waiting ${delayMs / 1000}s before next attempt`);
      await sleep(delayMs);
    }
  }

  return null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { pollForTranscript };
