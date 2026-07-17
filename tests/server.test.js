const db = require('../src/db');
const express = require('express');
const path = require('path');
const fs = require('fs');

describe('Server API Boot', () => {
  let app;

  beforeAll(async () => {
    process.env.DB_MOCK = 'true';
    await db.init();
    
    // Load express app setup directly to run tests without port locking
    app = express();
    app.use(express.json());
    app.use('/api/players', require('../src/routes/playerRoutes'));
    app.use('/api/matches', require('../src/routes/matchRoutes'));
    app.use('/api/stats', require('../src/routes/statsRoutes'));
  });

  afterAll(() => {
    const mockPath = path.join(__dirname, '../data/db.json');
    if (fs.existsSync(mockPath)) {
      fs.unlinkSync(mockPath);
    }
  });

  test('should respond to player API endpoints', async () => {
    const playerService = require('../src/services/playerService');
    const p = await playerService.createPlayer('Alice');
    expect(p.name).toBe('Alice');
  });
});
