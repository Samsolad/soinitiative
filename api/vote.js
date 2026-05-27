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

const ALLOWED_CAMPAIGNS = new Set(['sowedding', 'hero-workplace', 'hero-campus']);

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  if (!isConfigured('SHEET_URL')) {
    return json(res, 503, { ok: false, error: 'Vote backend is not configured.' });
  }

  const ip = getClientIp(req);
  if (!rateLimit(`vote:${ip}`, 20, 60 * 60 * 1000)) {
    return json(res, 429, { ok: false, error: 'Too many votes. Try again later.' });
  }

  const body = req.body || {};
  if (sanitizeString(body.website, 200)) {
    return json(res, 200, { ok: true });
  }

  const campaign = sanitizeString(body.campaign, 40);
  const nominee = sanitizeString(body.nominee, 200);
  const email = sanitizeString(body.email, 254);

  if (!ALLOWED_CAMPAIGNS.has(campaign)) {
    return json(res, 400, { ok: false, error: 'Invalid vote campaign.' });
  }
  if (!nominee) {
    return json(res, 400, { ok: false, error: 'Nominee is required.' });
  }
  if (!isValidEmail(email)) {
    return json(res, 400, { ok: false, error: 'A valid email is required to vote.' });
  }

  try {
    await forwardToSheet({ type: 'vote', campaign, nominee, email });
    return json(res, 200, { ok: true });
  } catch (err) {
    const message = err?.message === 'duplicate_vote'
      ? 'This email has already voted in this campaign.'
      : 'Could not record vote. Please try again.';
    return json(res, 502, { ok: false, error: message });
  }
}
