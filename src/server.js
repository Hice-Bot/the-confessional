require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initializeSchema, getDb, closeDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3003;

// Initialize database schema on startup
initializeSchema();

// Middleware
app.use(cors());
app.use(express.json());

// Trust proxy for rate limiting behind reverse proxies
app.set('trust proxy', 1);

// Health endpoint
app.get('/api/health', (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare('SELECT 1 as ok').get();
    res.json({
      status: 'ok',
      database: result.ok === 1 ? 'connected' : 'error',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: err.message,
    });
  }
});

// Root path redirects to the confessional
app.get('/', (req, res) => {
  res.redirect(302, '/confessional');
});

// Route mounting
const confessionalRoutes = require('./routes/confessional');
const submitRoutes = require('./routes/submit');
const agentFeedRoutes = require('./routes/agent-feed');
const adminRoutes = require('./routes/admin');
const sessionRoutes = require('./routes/sessions');

app.use('/confessional', confessionalRoutes);
app.use('/confessional/submit', submitRoutes);
app.use('/confessional/feed/agent', agentFeedRoutes);
app.use('/confessional/admin', adminRoutes);
app.use('/confessional/sessions', sessionRoutes);

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`[Server] The Confessional is listening on port ${PORT}`);
  console.log(`[Server] Human page: http://localhost:${PORT}/confessional`);
  console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down gracefully...');
  closeDb();
  server.close(() => {
    console.log('[Server] Goodbye.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  closeDb();
  server.close(() => process.exit(0));
});

module.exports = app;
