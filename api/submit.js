import {
  forwardToSheet,
  getClientIp,
  isConfigured,
  isValidEmail,
  json,
  methodNotAllowed,
  rateLimit,
  sanitizeString,
} from './_lib.js';

const ALLOWED_CAMPAIGNS = new Set(['So Family', 'So Business', 'So Wedding', 'So Hero']);

function rejectHoneypot(body) {
  const hp = sanitizeString(body?.website, 200);
  return hp.length > 0;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  if (!isConfigured('SHEET_URL')) {
    return json(res, 503, { ok: false, error: 'Form backend is not configured.' });
  }

  const ip = getClientIp(req);
  if (!rateLimit(`submit:${ip}`, 12, 60 * 60 * 1000)) {
    return json(res, 429, { ok: false, error: 'Too many submissions. Try again later.' });
  }

  const body = req.body || {};
  if (rejectHoneypot(body)) {
    return json(res, 200, { ok: true });
  }

  const campaign = sanitizeString(body.campaign, 40);
  if (!ALLOWED_CAMPAIGNS.has(campaign)) {
    return json(res, 400, { ok: false, error: 'Invalid campaign.' });
  }

  const nominatorEmail = sanitizeString(body.nominator_email, 254);
  if (!isValidEmail(nominatorEmail)) {
    return json(res, 400, { ok: false, error: 'A valid nominator email is required.' });
  }

  const payload = {
    campaign,
    category: sanitizeString(body.category, 80),
    country: sanitizeString(body.country, 80),
    nominee: sanitizeString(body.nominee, 200),
    role: sanitizeString(body.role, 120),
    org: sanitizeString(body.org, 200),
    location: sanitizeString(body.location, 120),
    what: sanitizeString(body.what, 500),
    story: sanitizeString(body.story, 4000),
    reason: sanitizeString(body.reason, 4000),
    link: sanitizeString(body.link, 500),
    duration: sanitizeString(body.duration, 80),
    aware: sanitizeString(body.aware, 80),
    relationship: sanitizeString(body.relationship, 120),
    nominator_name: sanitizeString(body.nominator_name, 120),
    nominator_email: nominatorEmail,
    nominator_phone: sanitizeString(body.nominator_phone, 40),
    nominator_country: sanitizeString(body.nominator_country, 80),
  };

  if (!payload.nominee || !payload.country) {
    return json(res, 400, { ok: false, error: 'Missing required nomination fields.' });
  }

  try {
    await forwardToSheet(payload);
    return json(res, 200, { ok: true });
  } catch {
    return json(res, 502, { ok: false, error: 'Could not save nomination. Please try again.' });
  }
}
