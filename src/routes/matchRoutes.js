const express = require('express');
const router = express.Router();
const matchService = require('../services/matchService');

router.get('/', async (req, res) => {
  try {
    const matches = await matchService.getMatches();
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { division, placements, playedAt, isSimpleMatch } = req.body;
    const match = await matchService.createMatch(parseInt(division, 10), placements, playedAt, isSimpleMatch);
    res.status(201).json(match);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
