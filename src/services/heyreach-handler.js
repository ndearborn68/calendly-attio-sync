/**
 * HeyReach Webhook Handler
 * Handles webhooks when a lead is tagged as "interested" in HeyReach
 * Stores lead info and conversation for Clay enrichment correlation
 */

const { log } = require('./logger');
const { getConfig } = require('./config');
const { addPendingLead, normalizeLinkedInUrl } = require('./heyreach-store');
const { findPersonByLinkedIn, createConversationNote } = require('./attio');

/**
 * Handle incoming HeyReach webhook
 * Triggered when a lead is tagged as "interested"
 * @param {object} payload - HeyReach webhook payload
 */
async function handleHeyReachWebhook(payload) {
  const config = getConfig();
  
  try {
    log('info', 'Processing HeyReach webhook', { 
      event: payload.event || 'lead_tagged',
      leadName: payload.lead?.name || payload.name
    });

    // Extract lead data from HeyReach payload
    // HeyReach webhook structure may vary - handle common formats
    const lead = extractLeadData(payload);
    
    if (!lead.linkedinUrl) {
      log('warn', 'HeyReach webhook missing LinkedIn URL', { payload });
      return { success: false, error: 'Missing LinkedIn URL' };
    }

    log('info', 'Extracted HeyReach lead data', {
      linkedinUrl: lead.linkedinUrl,
      name: lead.name,
      hasConversation: !!lead.conversation
    });

    // Store lead for Clay enrichment correlation
    const normalizedUrl = addPendingLead(lead);
    log('info', 'Added lead to pending store', { linkedinUrl: normalizedUrl });

    // Also try to find existing Attio person and add conversation note immediately
    // (Clay enrichment will update email/phone separately)
    if (lead.conversation) {
      try {
        const personId = await findPersonByLinkedIn(lead.linkedinUrl, config);
        
        if (personId) {
          log('info', 'Found existing Attio person, adding conversation note', { personId });
          await createConversationNote(personId, lead, config);
        } else {
          log('info', 'No existing Attio person found, note will be added after Clay enrichment');
        }
      } catch (attioError) {
        // Don't fail the webhook if Attio note fails
        log('warn', 'Failed to add conversation note to Attio', { 
          error: attioError.message 
        });
      }
    }

    return { 
      success: true, 
      linkedinUrl: normalizedUrl,
      message: 'Lead stored, awaiting Clay enrichment'
    };

  } catch (error) {
    log('error', 'HeyReach webhook processing failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Extract lead data from various HeyReach payload formats
 * @param {object} payload - HeyReach webhook payload
 * @returns {object} - Normalized lead data
 */
function extractLeadData(payload) {
  // Handle different possible payload structures
  const lead = payload.lead || payload.contact || payload;
  const messages = payload.messages || payload.conversation || lead.messages || [];
  
  // Build conversation transcript
  let conversation = '';
  if (Array.isArray(messages)) {
    conversation = messages
      .map(msg => {
        const sender = msg.sender || msg.from || (msg.is_outbound ? 'Me' : lead.name || 'Lead');
        const timestamp = msg.sent_at || msg.timestamp || msg.created_at || '';
        const text = msg.text || msg.content || msg.body || '';
        return `[${timestamp}] ${sender}: ${text}`;
      })
      .join('\n\n');
  } else if (typeof messages === 'string') {
    conversation = messages;
  }

  // Extract LinkedIn URL from various fields
  const linkedinUrl = 
    lead.linkedin_url || 
    lead.linkedinUrl || 
    lead.linkedin || 
    lead.profile_url ||
    payload.linkedin_url ||
    payload.linkedinUrl ||
    null;

  return {
    linkedinUrl: normalizeLinkedInUrl(linkedinUrl),
    name: lead.name || lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
    firstName: lead.first_name || lead.firstName || '',
    lastName: lead.last_name || lead.lastName || '',
    company: lead.company || lead.company_name || lead.organization || '',
    title: lead.title || lead.job_title || lead.position || '',
    conversation: conversation,
    taggedAt: payload.tagged_at || payload.timestamp || new Date().toISOString(),
    tag: payload.tag || payload.label || 'interested'
  };
}

module.exports = { handleHeyReachWebhook, extractLeadData };
