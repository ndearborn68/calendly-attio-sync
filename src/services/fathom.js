/**
 * Fathom AI Notetaker integration
 * Handles webhook events and transcript fetching
 * Docs: https://developers.fathom.ai
 */

const axios = require('axios');
const { log } = require('./logger');

const FATHOM_API_BASE = 'https://api.fathom.ai/external/v1';

/**
 * Process Fathom webhook payload
 * Fathom sends meeting data including transcript when configured
 * @param {object} payload - Webhook payload from Fathom
 * @param {object} fathomConfig - Fathom account config { apiKey, webhookSecret }
 * @returns {object} - { transcript, guestEmail, guestName }
 */
async function processFathomWebhook(payload, fathomConfig) {
  log('info', 'Processing Fathom webhook', {
    meetingId: payload.meeting_id || payload.id
  });

  // Extract transcript from webhook payload if included
  let transcript = payload.transcript || payload.transcription;

  // If transcript not in payload, fetch it via API
  if (!transcript && payload.recording_id) {
    transcript = await fetchFathomTranscript(payload.recording_id, fathomConfig);
  }

  // Extract attendee info
  // Fathom includes attendees/participants in the payload
  const attendees = payload.attendees || payload.participants || [];

  // Find the first external attendee (not the host)
  const hostEmail = payload.host_email || payload.recorded_by;
  const guest = attendees.find(a => {
    const email = a.email || a.email_address;
    return email && email !== hostEmail;
  }) || attendees[0] || {};

  const guestEmail = guest.email || guest.email_address || payload.guest_email;
  const guestName = guest.name || guest.display_name ||
                    payload.guest_name || 'Unknown Attendee';

  // Format transcript if it's an array of segments
  if (Array.isArray(transcript)) {
    transcript = formatTranscriptSegments(transcript);
  }

  if (!transcript) {
    throw new Error('No transcript available from Fathom');
  }

  if (!guestEmail) {
    throw new Error('No guest email found in Fathom webhook');
  }

  return {
    transcript,
    guestEmail,
    guestName,
    source: 'fathom',
    meetingTitle: payload.title || payload.meeting_title || 'Fathom Meeting'
  };
}

/**
 * Fetch transcript from Fathom API
 * @param {string} recordingId - The recording ID
 * @param {object} fathomConfig - Fathom account config { apiKey, webhookSecret }
 * @returns {string} - Transcript text
 */
async function fetchFathomTranscript(recordingId, fathomConfig) {
  log('info', 'Fetching transcript from Fathom API', { recordingId });

  try {
    const response = await axios.get(
      `${FATHOM_API_BASE}/recordings/${recordingId}/transcript`,
      {
        headers: {
          'X-Api-Key': fathomConfig.apiKey
        }
      }
    );

    const data = response.data;

    // Handle different transcript formats
    if (typeof data === 'string') {
      return data;
    }

    if (data.transcript) {
      return typeof data.transcript === 'string'
        ? data.transcript
        : formatTranscriptSegments(data.transcript);
    }

    if (Array.isArray(data)) {
      return formatTranscriptSegments(data);
    }

    log('warn', 'Unexpected transcript format from Fathom', {
      type: typeof data
    });
    return JSON.stringify(data);

  } catch (error) {
    log('error', 'Failed to fetch Fathom transcript', {
      status: error.response?.status,
      message: error.message
    });
    throw error;
  }
}

/**
 * Format transcript segments into readable text
 * @param {array} segments - Array of transcript segments
 * @returns {string} - Formatted transcript
 */
function formatTranscriptSegments(segments) {
  return segments.map(segment => {
    const speaker = segment.speaker || segment.speaker_name || 'Speaker';
    const text = segment.text || segment.content || segment.words || '';
    const timestamp = segment.start_time || segment.timestamp || '';

    if (timestamp) {
      const time = formatTimestamp(timestamp);
      return `(${time}) ${speaker}: ${text}`;
    }
    return `${speaker}: ${text}`;
  }).join('\n\n');
}

/**
 * Format timestamp to readable format
 * @param {number|string} timestamp - Timestamp in seconds or ms
 * @returns {string} - Formatted time string
 */
function formatTimestamp(timestamp) {
  const seconds = typeof timestamp === 'number'
    ? (timestamp > 10000 ? timestamp / 1000 : timestamp)
    : parseFloat(timestamp);

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Verify Fathom webhook signature
 * @param {string} signature - webhook-signature header
 * @param {string} body - Raw request body
 * @param {string} secret - Webhook secret
 * @returns {boolean} - True if valid
 */
function verifyFathomWebhook(signature, body, secret) {
  // If no secret configured, skip verification
  if (!secret) {
    log('warn', 'Fathom webhook secret not configured, skipping verification');
    return true;
  }

  try {
    const crypto = require('crypto');
    // Fathom uses format: v1,base64signature
    const [version, sig] = signature.split(',');
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('base64');

    return sig === expectedSig;
  } catch (error) {
    log('error', 'Failed to verify Fathom webhook', { error: error.message });
    return false;
  }
}

module.exports = {
  processFathomWebhook,
  fetchFathomTranscript,
  verifyFathomWebhook
};
