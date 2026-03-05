/**
 * Authentication middleware with prefix-based routing.
 * - Agent API keys: prefix "agt_" — for /confessional/submit and /confessional/feed/agent
 * - Admin API keys: prefix "adm_" — for /confessional/admin/* and /confessional/sessions
 * - Cross-use rejected: agent keys fail on admin endpoints and vice versa
 */

function getApiKeys() {
  const agentKeys = (process.env.AGENT_API_KEYS || '').split(',').filter(k => k.trim());
  const adminKeys = (process.env.ADMIN_API_KEYS || '').split(',').filter(k => k.trim());
  return { agentKeys, adminKeys };
}

function extractBearerToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

/**
 * Middleware requiring a valid agt_ prefixed bearer token.
 */
function requireAgentAuth(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authorization header with Bearer token required' });
  }

  if (!token.startsWith('agt_')) {
    return res.status(401).json({ error: 'Agent endpoint requires agt_ prefixed key' });
  }

  const { agentKeys } = getApiKeys();
  if (!agentKeys.includes(token)) {
    return res.status(401).json({ error: 'Invalid agent API key' });
  }

  req.agentKey = token;
  next();
}

/**
 * Middleware requiring a valid adm_ prefixed bearer token.
 */
function requireAdminAuth(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authorization header with Bearer token required' });
  }

  if (!token.startsWith('adm_')) {
    return res.status(401).json({ error: 'Admin endpoint requires adm_ prefixed key' });
  }

  const { adminKeys } = getApiKeys();
  if (!adminKeys.includes(token)) {
    return res.status(401).json({ error: 'Invalid admin API key' });
  }

  // Store first 8 chars of admin key for audit logging
  req.adminKeyPrefix = token.substring(0, 8);
  next();
}

module.exports = { requireAgentAuth, requireAdminAuth, extractBearerToken };
