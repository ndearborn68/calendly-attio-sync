/**
 * HeyReach Lead Store
 * Stores lead info keyed by LinkedIn URL for Clay enrichment correlation
 */

// In-memory store for leads pending enrichment
// Key: normalized LinkedIn URL, Value: lead data
const pendingLeads = new Map();

/**
 * Normalize LinkedIn URL to consistent format
 * @param {string} linkedinUrl - LinkedIn profile URL
 * @returns {string} - Normalized URL
 */
function normalizeLinkedInUrl(linkedinUrl) {
  if (!linkedinUrl) return null;
  
  // Remove trailing slashes and query params
  let url = linkedinUrl.toLowerCase().trim();
  url = url.split('?')[0];
  url = url.replace(/\/+$/, '');
  
  // Extract the profile path
  const match = url.match(/linkedin\.com\/in\/([^\/]+)/);
  if (match) {
    return `https://www.linkedin.com/in/${match[1]}`;
  }
  
  return url;
}

/**
 * Add a lead to the pending store
 * @param {object} lead - Lead data from HeyReach
 * @param {string} lead.linkedinUrl - LinkedIn profile URL
 * @param {string} lead.name - Lead name
 * @param {string} lead.conversation - Full conversation transcript
 * @param {string} lead.taggedAt - When lead was tagged as interested
 */
function addPendingLead(lead) {
  const normalizedUrl = normalizeLinkedInUrl(lead.linkedinUrl);
  if (!normalizedUrl) return null;
  
  pendingLeads.set(normalizedUrl, {
    ...lead,
    linkedinUrl: normalizedUrl,
    addedAt: new Date().toISOString()
  });
  
  return normalizedUrl;
}

/**
 * Get and remove a pending lead by LinkedIn URL
 * @param {string} linkedinUrl - LinkedIn profile URL
 * @returns {object|null} - Lead data or null if not found
 */
function getPendingLead(linkedinUrl) {
  const normalizedUrl = normalizeLinkedInUrl(linkedinUrl);
  if (!normalizedUrl) return null;
  
  const lead = pendingLeads.get(normalizedUrl);
  if (lead) {
    pendingLeads.delete(normalizedUrl);
  }
  return lead;
}

/**
 * Check if a lead is pending
 * @param {string} linkedinUrl - LinkedIn profile URL
 * @returns {boolean}
 */
function hasPendingLead(linkedinUrl) {
  const normalizedUrl = normalizeLinkedInUrl(linkedinUrl);
  return normalizedUrl ? pendingLeads.has(normalizedUrl) : false;
}

/**
 * Get count of pending leads
 * @returns {number}
 */
function getPendingCount() {
  return pendingLeads.size;
}

module.exports = {
  normalizeLinkedInUrl,
  addPendingLead,
  getPendingLead,
  hasPendingLead,
  getPendingCount
};
