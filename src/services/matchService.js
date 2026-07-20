const db = require('../db');
const crownService = require('./crownService');
const { v4: uuidv4 } = require('uuid');

const matchService = {
  async createMatch(division, placements, playedAt) {
    if (![4, 5, 6].includes(division)) {
      throw new Error('Invalid division. Must be 4, 5, or 6 players.');
    }
    if (placements.length !== division) {
      throw new Error(`Placements list must match player division (${division})`);
    }

    const matchId = `match_${uuidv4()}`;
    const date = playedAt || new Date().toISOString();

    const match = {
      id: matchId,
      partitionKey: 'MATCH',
      type: 'match',
      division,
      playedAt: date,
      placements
    };

    await db.createItem(match);

    // Re-simulate the entire crown lineage chronologically by match playedAt dates
    await crownService.rebuildCrownTimeline();

    // Query and return the updated match with calculated crown states
    const matches = await this.getMatches();
    return matches.find(m => m.id === matchId) || match;
  },

  async getMatches() {
    return await db.queryItems({
      query: "SELECT * FROM c WHERE c.partitionKey = 'MATCH' AND c.type = 'match'"
    });
  }
};

module.exports = matchService;
