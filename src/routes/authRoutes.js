const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const playerService = require('../services/playerService');
const { requireAuth, optionalAuth } = require('../middleware/auth');

router.post('/register', async (req, res) => {
  try {
    const { username, password, playerId, newPlayerName } = req.body;
    const user = await userService.createUser(username, password, playerId, newPlayerName);
    const session = await userService.createSession(user.id);
    
    // Omit sensitive details from user response
    const userResponse = {
      id: user.id,
      username: user.username,
      playerId: user.playerId,
      tilePreference: user.tilePreference,
      isAdmin: user.isAdmin
    };

    res.status(201).json({
      token: session.id,
      user: userResponse
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await userService.authenticateUser(username, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const session = await userService.createSession(user.id);

    const userResponse = {
      id: user.id,
      username: user.username,
      playerId: user.playerId,
      tilePreference: user.tilePreference,
      isAdmin: user.isAdmin
    };

    res.json({
      token: session.id,
      user: userResponse
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  try {
    await userService.invalidateSession(req.session.id);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    
    // Fetch associated player details if linked
    let player = null;
    if (user.playerId) {
      const db = require('../db');
      player = await db.readItem(user.playerId, 'PLAYER');
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        playerId: user.playerId,
        tilePreference: user.tilePreference,
        isAdmin: user.isAdmin
      },
      player
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/unlinked-players', async (req, res) => {
  try {
    const players = await userService.getUnlinkedPlayers();
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/profile/tile', requireAuth, async (req, res) => {
  try {
    const { tilePreference } = req.body;
    const updatedUser = await userService.updateTilePreference(req.user.id, tilePreference);
    res.json({
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        playerId: updatedUser.playerId,
        tilePreference: updatedUser.tilePreference,
        isAdmin: updatedUser.isAdmin
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
