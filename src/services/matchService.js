const db = require('../db');
const crownService = require('./crownService');
const { v4: uuidv4 } = require('uuid');

const matchService = {
  async createMatch(division, placements, playedAt, isSimpleMatch = false) {
    if (![4, 5, 6].includes(division)) {
      throw new Error('Invalid division. Must be 4, 5, or 6 players.');
    }
    if (placements.length !== division) {
      throw new Error(`Placements list must match player division (${division})`);
    }

    const matchId = `match_${uuidv4()}`;
    const date = playedAt || new Date().toISOString();

    const players = await db.queryItems({
      query: "SELECT * FROM c WHERE c.partitionKey = 'PLAYER' AND c.type = 'player'"
    });

    const resolvedPlacements = [];
    for (let idx = 0; idx < placements.length; idx++) {
      resolvedPlacements.push(await crownService.resolvePlacement(placements[idx], idx, players, division));
    }

    resolvedPlacements.sort((a, b) => {
      if (a.place !== undefined && b.place !== undefined) {
        return a.place - b.place;
      }
      return (b.victoryPoints || 0) - (a.victoryPoints || 0);
    });
    
    let currentRank = 1;
    resolvedPlacements.forEach((p, idx) => {
      if (p.place !== undefined) {
        currentRank = p.place;
      } else {
        if (idx > 0 && (p.victoryPoints || 0) < (resolvedPlacements[idx - 1].victoryPoints || 0)) {
          currentRank = idx + 1;
        }
        p.place = currentRank;
      }
    });

    const match = {
      id: matchId,
      partitionKey: 'MATCH',
      type: 'match',
      division: parseInt(division),
      playedAt: date,
      placements: resolvedPlacements,
      isSimpleMatch: !!isSimpleMatch,
      crownChallenged: false,
      crownDefended: false,
      crownHolderBefore: null,
      crownHolderAfter: null,
      interimUpdated: false,
      interimHolderBefore: null,
      interimHolderAfter: null,
      interimPromotion: false
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
