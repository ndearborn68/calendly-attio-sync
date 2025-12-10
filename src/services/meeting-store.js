/**
 * Lightweight in-memory store for Calendly bookings to match with Fathom webhooks.
 * Not persisted; intended for short-lived correlation within ~24h.
 */

const bookings = new Map(); // key: eventUuid -> record
const TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

/**
 * Add a booking record from Calendly.
 * @param {object} record - { eventUuid, meetingUrl, startTime, endTime, guestEmail, guestName, hostEmail }
 */
function addBooking(record) {
  const now = Date.now();
  bookings.set(record.eventUuid, { ...record, createdAt: now });
  cleanup(now);
}

/**
 * Find a booking that best matches the incoming Fathom webhook.
 * Matching strategy:
 * 1) Exact meeting URL match (normalized, hash removed) with email alignment.
 * 2) Otherwise, start time within ±15 minutes with email alignment.
 */
function findMatch({ meetingUrl, guestEmail, hostEmail, startTime }) {
  const now = Date.now();
  cleanup(now);
  if (!meetingUrl && !startTime) return null;

  for (const [, rec] of bookings.entries()) {
    // URL match
    if (meetingUrl && rec.meetingUrl && normalizeUrl(rec.meetingUrl) === normalizeUrl(meetingUrl)) {
      if (emailsAlign(rec, guestEmail, hostEmail)) return rec;
    }

    // Time proximity match (±15 minutes) with matching guest/host
    if (startTime && rec.startTime) {
      const delta = Math.abs(new Date(rec.startTime).getTime() - new Date(startTime).getTime());
      if (delta <= 15 * 60 * 1000 && emailsAlign(rec, guestEmail, hostEmail)) return rec;
    }
  }

  return null;
}

function emailsAlign(rec, guestEmail, hostEmail) {
  const matchGuest =
    rec.guestEmail && guestEmail && rec.guestEmail.toLowerCase() === guestEmail.toLowerCase();
  const matchHost =
    !rec.hostEmail || !hostEmail || rec.hostEmail.toLowerCase() === hostEmail.toLowerCase();
  return matchGuest && matchHost;
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}

function cleanup(now = Date.now()) {
  for (const [key, rec] of bookings.entries()) {
    if (now - rec.createdAt > TTL_MS) bookings.delete(key);
  }
}

module.exports = { addBooking, findMatch };

