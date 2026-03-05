const rateLimit = require('express-rate-limit');

/**
 * Rate limiting configuration per endpoint.
 * - POST /confessional/submit: 10 req per agent key per minute
 * - GET /confessional/feed: 60 req per IP per minute
 * - GET /confessional/feed/agent: 60 req per agent key per minute
 * - GET /confessional/count: 60 req per IP per minute
 */

const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    // Rate limit by agent key
    const auth = req.headers.authorization || '';
    return auth.startsWith('Bearer ') ? auth.slice(7) : req.ip;
  },
  message: { error: 'rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
});

const feedLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.ip,
  message: { error: 'rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
});

const agentFeedLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => {
    const auth = req.headers.authorization || '';
    return auth.startsWith('Bearer ') ? auth.slice(7) : req.ip;
  },
  message: { error: 'rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
});

const countLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.ip,
  message: { error: 'rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { submitLimiter, feedLimiter, agentFeedLimiter, countLimiter };
