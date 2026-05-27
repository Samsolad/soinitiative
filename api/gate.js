import { getClientIp, isConfigured, json, methodNotAllowed, rateLimit } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const ip = getClientIp(req);
  if (!rateLimit(`gate:${ip}`, 8, 15 * 60 * 1000)) {
    return json(res, 429, { ok: false, error: 'Too many attempts. Try again later.' });
  }

  if (!isConfigured('GATE_PASS')) {
    return json(res, 503, { ok: false, error: 'Preview gate is not configured.' });
  }

  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!password || password !== process.env.GATE_PASS) {
    return json(res, 401, { ok: false, error: 'Invalid preview password.' });
  }

  return json(res, 200, { ok: true });
}
