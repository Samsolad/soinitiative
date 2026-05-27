const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const rateBuckets = new Map();

export function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

export function methodNotAllowed(res) {
  json(res, 405, { ok: false, error: 'Method not allowed' });
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}

export function sanitizeString(value, maxLen = 500) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLen);
}

export function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_RE.test(email);
}

export function isConfigured(name) {
  return typeof process.env[name] === 'string' && process.env[name].length > 0;
}

export async function forwardToSheet(payload) {
  const url = process.env.SHEET_URL;
  if (!url) throw new Error('SHEET_URL is not configured');

  const body = { ...payload };
  const headers = { 'Content-Type': 'application/json' };
  if (isConfigured('SHEET_SECRET')) {
    body._secret = process.env.SHEET_SECRET;
    headers['X-SoInitiative-Secret'] = process.env.SHEET_SECRET;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  let data = { ok: response.ok };
  try {
    data = await response.json();
  } catch {
    data = { ok: response.ok };
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || 'Upstream request failed');
  }

  return data;
}
