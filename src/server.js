const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const playerRoutes = require('./routes/playerRoutes');
const matchRoutes = require('./routes/matchRoutes');
const statsRoutes = require('./routes/statsRoutes');
const crownService = require('./services/crownService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Static Assets Folder
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/players', playerRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/stats', statsRoutes);

// UFC Crown endpoint specifically requested in checklist
app.get('/api/crowns', async (req, res) => {
  try {
    const crowns = await crownService.getCurrentCrowns();
    res.json(crowns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback to single page app index
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

async function startServer() {
  await db.init();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Only start the server if not running inside a test suite
if (process.env.NODE_ENV !== 'test') {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
  });
}

module.exports = app;
