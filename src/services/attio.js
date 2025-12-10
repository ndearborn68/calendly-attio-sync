/**
 * Attio CRM API integration
 * Handles person lookup/creation and note creation
 */

const axios = require('axios');
const { log } = require('./logger');

const ATTIO_BASE_URL = 'https://api.attio.com/v2';

/**
 * Search for a person by email, create if not found, then add a note
 * @param {string} email - Guest email address
 * @param {string} name - Guest full name
 * @param {string} summary - Markdown summary to add as note
 * @param {object} config - Configuration object
 * @returns {object} - { personId, noteId, email }
 */
async function upsertPersonAndNote(email, name, summary, config) {
  const headers = {
    Authorization: `Bearer ${config.attioApiKey}`,
    'Content-Type': 'application/json'
  };

  // Step 1: Search for existing person
  let personId = await findPersonByEmail(email, headers);

  // Step 2: Create person if not found
  if (!personId) {
    log('info', 'Person not found, creating new record', { email });
    personId = await createPerson(email, name, headers);
  } else {
    log('info', 'Found existing person', { personId, email });
  }

  // Step 3: Create note
  const noteId = await createNote(personId, summary, headers);

  return { personId, noteId, email };
}

/**
 * Search for a person by email
 */
async function findPersonByEmail(email, headers) {
  try {
    // Use the correct Attio filter format for email addresses
    const response = await axios.post(
      `${ATTIO_BASE_URL}/objects/people/records/query`,
      {
        filter: {
          email_addresses: email
        }
      },
      { headers }
    );

    const records = response.data.data;
    if (records && records.length > 0) {
      return records[0].id.record_id;
    }

    return null;

  } catch (error) {
    // 404 or 400 means no results, which is fine - create new person
    if (error.response?.status === 404 || error.response?.status === 400) {
      log('info', 'No existing person found', { email });
      return null;
    }
    log('error', 'Attio search error', {
      status: error.response?.status,
      message: error.message
    });
    throw error;
  }
}

/**
 * Create a new person record
 */
async function createPerson(email, name, headers) {
  // Parse name into first/last
  const nameParts = name.trim().split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  try {
    const response = await axios.post(
      `${ATTIO_BASE_URL}/objects/people/records`,
      {
        data: {
          values: {
            email_addresses: [{ email_address: email }],
            name: [{
              full_name: name,
              first_name: firstName,
              last_name: lastName
            }]
          }
        }
      },
      { headers }
    );

    const personId = response.data.data.id.record_id;
    log('info', 'Created new person', { personId, email });
    return personId;

  } catch (error) {
    log('error', 'Attio create person error', {
      status: error.response?.status,
      message: error.message,
      data: error.response?.data
    });
    throw error;
  }
}

/**
 * Create a note attached to a person
 */
async function createNote(personId, summary, headers) {
  const today = new Date().toISOString().split('T')[0];
  const title = `Call Summary - ${today}`;

  try {
    const response = await axios.post(
      `${ATTIO_BASE_URL}/notes`,
      {
        data: {
          parent_object: 'people',
          parent_record_id: personId,
          title: title,
          format: 'markdown',
          content: summary
        }
      },
      { headers }
    );

    const noteId = response.data.data?.id;
    log('info', 'Created note', { noteId, personId, title });
    return noteId;

  } catch (error) {
    log('error', 'Attio create note error', {
      status: error.response?.status,
      message: error.message,
      data: error.response?.data
    });
    throw error;
  }
}

/**
 * Search for a person by LinkedIn URL
 * @param {string} linkedinUrl - LinkedIn profile URL
 * @param {object} config - Configuration object
 * @returns {string|null} - Person record ID or null
 */
async function findPersonByLinkedIn(linkedinUrl, config) {
  const headers = {
    Authorization: `Bearer ${config.attioApiKey}`,
    'Content-Type': 'application/json'
  };

  try {
    // Attio stores LinkedIn URLs in the linkedin attribute
    const response = await axios.post(
      `${ATTIO_BASE_URL}/objects/people/records/query`,
      {
        filter: {
          linkedin: linkedinUrl
        }
      },
      { headers }
    );

    const records = response.data.data;
    if (records && records.length > 0) {
      const personId = records[0].id.record_id;
      log('info', 'Found person by LinkedIn URL', { personId, linkedinUrl });
      return personId;
    }

    return null;

  } catch (error) {
    // 404 or 400 means no results
    if (error.response?.status === 404 || error.response?.status === 400) {
      log('info', 'No person found by LinkedIn URL', { linkedinUrl });
      return null;
    }
    log('error', 'Attio LinkedIn search error', {
      status: error.response?.status,
      message: error.message
    });
    throw error;
  }
}

/**
 * Update a person's email and phone fields
 * @param {string} personId - Attio person record ID
 * @param {object} fields - Fields to update { email, phone }
 * @param {object} config - Configuration object
 * @returns {boolean} - Success status
 */
async function updatePersonFields(personId, fields, config) {
  const headers = {
    Authorization: `Bearer ${config.attioApiKey}`,
    'Content-Type': 'application/json'
  };

  const values = {};

  // Add email if provided
  if (fields.email) {
    values.email_addresses = [{ email_address: fields.email }];
  }

  // Add phone if provided
  if (fields.phone) {
    values.phone_numbers = [{ phone_number: fields.phone }];
  }

  // Skip if nothing to update
  if (Object.keys(values).length === 0) {
    log('info', 'No fields to update', { personId });
    return true;
  }

  try {
    await axios.patch(
      `${ATTIO_BASE_URL}/objects/people/records/${personId}`,
      {
        data: {
          values
        }
      },
      { headers }
    );

    log('info', 'Updated person fields', { 
      personId, 
      hasEmail: !!fields.email, 
      hasPhone: !!fields.phone 
    });
    return true;

  } catch (error) {
    log('error', 'Attio update person error', {
      personId,
      status: error.response?.status,
      message: error.message,
      data: error.response?.data
    });
    throw error;
  }
}

/**
 * Create a conversation note attached to a person
 * Formats HeyReach conversation as a structured Attio note
 * @param {string} personId - Attio person record ID
 * @param {object} leadData - Lead data with conversation
 * @param {object} config - Configuration object
 * @returns {string} - Note ID
 */
async function createConversationNote(personId, leadData, config) {
  const headers = {
    Authorization: `Bearer ${config.attioApiKey}`,
    'Content-Type': 'application/json'
  };

  const today = new Date().toISOString().split('T')[0];
  const title = `HeyReach Conversation - ${today}`;

  // Format the conversation as markdown
  let content = `## LinkedIn Conversation with ${leadData.name || 'Lead'}\n\n`;
  
  if (leadData.company) {
    content += `**Company:** ${leadData.company}\n`;
  }
  if (leadData.title) {
    content += `**Title:** ${leadData.title}\n`;
  }
  if (leadData.linkedinUrl) {
    content += `**LinkedIn:** ${leadData.linkedinUrl}\n`;
  }
  
  content += `**Tagged as:** ${leadData.tag || 'interested'}\n`;
  content += `**Tagged at:** ${leadData.taggedAt || today}\n\n`;
  content += `---\n\n`;
  content += `### Conversation Transcript\n\n`;
  content += leadData.conversation || '_No conversation data available_';

  try {
    const response = await axios.post(
      `${ATTIO_BASE_URL}/notes`,
      {
        data: {
          parent_object: 'people',
          parent_record_id: personId,
          title: title,
          format: 'markdown',
          content: content
        }
      },
      { headers }
    );

    const noteId = response.data.data?.id;
    log('info', 'Created HeyReach conversation note', { noteId, personId, title });
    return noteId;

  } catch (error) {
    log('error', 'Attio create conversation note error', {
      status: error.response?.status,
      message: error.message,
      data: error.response?.data
    });
    throw error;
  }
}

module.exports = { 
  upsertPersonAndNote,
  findPersonByLinkedIn,
  updatePersonFields,
  createConversationNote
};
