const db = require('../db');
const playerService = require('./playerService');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

const userService = {
  async getUserByUsername(username) {
    if (!username) return null;
    const users = await db.queryItems({
      query: "SELECT * FROM c WHERE c.partitionKey = 'USER' AND c.type = 'user'"
    });
    return users.find(u => u.username.toLowerCase() === username.trim().toLowerCase()) || null;
  },

  async createUser(username, password, playerId, newPlayerName) {
    if (!username || username.trim() === '') {
      throw new Error('Username is required');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    const trimmedUsername = username.trim();

    // Check duplicate username
    const existingUser = await this.getUserByUsername(trimmedUsername);
    if (existingUser) {
      throw new Error(`Username "${trimmedUsername}" is already taken`);
    }

    let finalPlayerId = null;
    let playerObj = null;

    if (playerId) {
      // Link existing player
      playerObj = await db.readItem(playerId, 'PLAYER');
      if (!playerObj || playerObj.type !== 'player') {
        throw new Error('Selected player does not exist');
      }
      if (playerObj.userId) {
        throw new Error('Selected player is already linked to another account');
      }
      finalPlayerId = playerId;
    } else if (newPlayerName && newPlayerName.trim() !== '') {
      // Create new player name
      playerObj = await playerService.createPlayer(newPlayerName);
      finalPlayerId = playerObj.id;
    } else {
      throw new Error('Must link to an existing player or enter a new player name');
    }

    const userId = `user_${uuidv4()}`;
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const tilePreference = 'wheat'; // default preference

    const user = {
      id: userId,
      partitionKey: 'USER',
      type: 'user',
      username: trimmedUsername,
      salt,
      passwordHash,
      playerId: finalPlayerId,
      tilePreference,
      isAdmin: false,
      createdAt: new Date().toISOString()
    };

    // Save user
    await db.createItem(user);

    // Update player to link to user and store default tile preference
    playerObj.userId = userId;
    playerObj.tilePreference = tilePreference;
    await db.upsertItem(playerObj);

    return user;
  },

  async authenticateUser(username, password) {
    if (!username || !password) return null;
    const user = await this.getUserByUsername(username);
    if (!user) return null;

    const hash = hashPassword(password, user.salt);
    if (hash !== user.passwordHash) return null;

    return user;
  },

  async createSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7-day session

    const session = {
      id: token,
      partitionKey: 'SESSION',
      type: 'session',
      userId,
      expiresAt: expiresAt.toISOString()
    };

    await db.createItem(session);
    return session;
  },

  async invalidateSession(token) {
    await db.deleteItem(token, 'SESSION');
  },

  async updateTilePreference(userId, tilePreference) {
    const validTypes = ['clay', 'wheat', 'forest', 'ore', 'pasture', 'desert'];
    if (!validTypes.includes(tilePreference)) {
      throw new Error(`Invalid tile preference style: ${tilePreference}`);
    }

    const user = await db.readItem(userId, 'USER');
    if (!user || user.type !== 'user') {
      throw new Error('User not found');
    }

    user.tilePreference = tilePreference;
    await db.upsertItem(user);

    // If user has a linked player, update player tile preference
    if (user.playerId) {
      const playerObj = await db.readItem(user.playerId, 'PLAYER');
      if (playerObj && playerObj.type === 'player') {
        playerObj.tilePreference = tilePreference;
        await db.upsertItem(playerObj);
      }
    }

    return user;
  },

  async getUnlinkedPlayers() {
    const allPlayers = await playerService.getPlayers();
    return allPlayers.filter(p => !p.userId);
  }
};

module.exports = userService;
