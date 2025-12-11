/**
 * Clay Enrichment Webhook Handler
 * Handles callbacks from Clay after lead enrichment completes
 * Updates Attio person records with enriched email and phone data
 */

const { log } = require('./logger');
const { getConfig } = require('./config');
const { getPendingLead, normalizeLinkedInUrl } = require('./heyreach-store');
const { 
  findPersonByLinkedIn, 
  updatePersonFields, 
  createConversationNote 
} = require('./attio');

/**
 * Handle incoming Clay enrichment webhook
 * @param {object} payload - Clay webhook payload with enriched data
 */
async function handleClayWebhook(payload) {
  const config = getConfig();
  
  try {
    // Extract data from Clay payload first (data is typically nested)
    const enrichedData = extractClayData(payload);
    
    log('info', 'Processing Clay enrichment webhook', {
      linkedinUrl: enrichedData.linkedinUrl,
      hasEmail: !!enrichedData.email,
      hasPhone: !!enrichedData.phone,
      phoneValue: enrichedData.phone // Log actual phone value
    });
    
    if (!enrichedData.linkedinUrl) {
      log('warn', 'Clay webhook missing LinkedIn URL', { payload });
      return { success: false, error: 'Missing LinkedIn URL' };
    }

    // Find the corresponding Attio person by LinkedIn URL
    log('info', 'Searching for Attio person by LinkedIn URL', { 
      linkedinUrl: enrichedData.linkedinUrl 
    });
    
    let personId = await findPersonByLinkedIn(enrichedData.linkedinUrl, config);
    
    if (!personId) {
      log('warn', 'No Attio person found for LinkedIn URL - person may not exist or LinkedIn URL format mismatch', { 
        linkedinUrl: enrichedData.linkedinUrl,
        tip: 'Check if LinkedIn URL in Attio matches exactly'
      });
      // The person should have been added via Chrome extension
      // Log but don't fail - they may add it later
      return { 
        success: false, 
        error: 'Attio person not found',
        linkedinUrl: enrichedData.linkedinUrl
      };
    }
    
    log('info', 'Found Attio person, proceeding with update', { personId });

    // Update the person with enriched email and phone
    const updateResult = await updatePersonFields(personId, {
      email: enrichedData.email,
      phone: enrichedData.phone
    }, config);

    log('info', 'Attio person update complete', {
      personId,
      emailUpdated: updateResult.emailUpdated,
      phoneUpdated: updateResult.phoneUpdated
    });

    // Check if we have a pending lead with conversation to add
    const pendingLead = getPendingLead(enrichedData.linkedinUrl);
    
    if (pendingLead && pendingLead.conversation) {
      log('info', 'Found pending HeyReach conversation, adding note', { personId });
      
      try {
        await createConversationNote(personId, pendingLead, config);
        log('info', 'Added HeyReach conversation note to Attio', { personId });
      } catch (noteError) {
        log('warn', 'Failed to add conversation note', { 
          error: noteError.message,
          personId 
        });
      }
    }

    return {
      success: true,
      personId,
      updated: {
        email: enrichedData.email,
        phone: enrichedData.phone
      },
      noteAdded: !!(pendingLead && pendingLead.conversation)
    };

  } catch (error) {
    log('error', 'Clay webhook processing failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Extract enrichment data from Clay payload
 * Clay payloads can have various structures depending on the table/workflow
 * @param {object} payload - Clay webhook payload
 * @returns {object} - Normalized enrichment data
 */
function extractClayData(payload) {
  // Clay may nest data differently based on configuration
  const data = payload.data || payload.row || payload.record || payload;
  
  // Extract LinkedIn URL
  const linkedinUrl = 
    data.linkedin_url || 
    data.linkedinUrl || 
    data.linkedin || 
    data.LinkedIn ||
    data.profile_url ||
    data['LinkedIn URL'] ||
    payload.linkedin_url ||
    null;

  // Extract email - check various Clay field names
  const email = 
    data.email || 
    data.Email || 
    data.work_email || 
    data.personal_email ||
    data['Work Email'] ||
    data['Personal Email'] ||
    data.email_address ||
    null;

  // Extract phone - check various Clay field names
  const phone = 
    data.phone || 
    data.Phone || 
    data.phone_number || 
    data.mobile ||
    data.Mobile ||
    data['Phone Number'] ||
    data['Mobile Number'] ||  // User's Clay column name
    data['Mobile Phone'] ||
    data.direct_phone ||
    data['Phone Clean'] ||    // User's formula column
    null;

  // Extract name info (in case we need to create person)
  const name = 
    data.name || 
    data.full_name || 
    data['Full Name'] ||
    `${data.first_name || data.firstName || ''} ${data.last_name || data.lastName || ''}`.trim();

  return {
    linkedinUrl: normalizeLinkedInUrl(linkedinUrl),
    email: email ? email.trim().toLowerCase() : null,
    phone: phone ? phone.trim() : null,
    name: name,
    firstName: data.first_name || data.firstName || '',
    lastName: data.last_name || data.lastName || '',
    company: data.company || data.Company || data.company_name || '',
    title: data.title || data.Title || data.job_title || ''
  };
}

module.exports = { handleClayWebhook, extractClayData };
