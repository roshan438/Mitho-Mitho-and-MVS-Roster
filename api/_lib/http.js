export function readBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;

  if (!header || !header.startsWith("Bearer ")) return null;

  return header.slice("Bearer ".length).trim();
}

export function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}
