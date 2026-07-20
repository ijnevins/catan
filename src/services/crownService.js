const db = require('../db');
const { v4: uuidv4 } = require('uuid');

const crownService = {
  async processMatchCrown(matchId, division, placements, playedAt) {
    const crownStateId = `crown_division_${division}`;
    let crownState = await db.readItem(crownStateId, 'CROWN');
    const winner = placements.find(p => p.place === 1);

    if (!winner) {
      throw new Error('Match placements must have a first-place winner (place = 1)');
    }

    if (!crownState) {
      // Inaugural reign
      crownState = {
        id: crownStateId,
        partitionKey: 'CROWN',
        type: 'crown_state',
        division,
        currentHolderId: winner.playerId,
        currentHolderName: winner.playerName,
        acquiredMatchId: matchId,
        acquiredAt: playedAt,
        defensesCount: 0
      };
      await db.createItem(crownState);

      const reign = {
        id: `reign_${uuidv4()}`,
        partitionKey: 'CROWN_REIGN',
        type: 'crown_reign',
        division,
        playerId: winner.playerId,
        playerName: winner.playerName,
        startedMatchId: matchId,
        startedAt: playedAt,
        endedMatchId: null,
        endedAt: null,
        successfulDefenses: 0
      };
      await db.createItem(reign);

      return {
        crownChallenged: true,
        crownDefended: false,
        crownHolderBefore: null,
        crownHolderAfter: winner.playerId
      };
    }

    const currentHolderId = crownState.currentHolderId;
    const holderWon = winner.playerId === currentHolderId;

    if (holderWon) {
      crownState.defensesCount += 1;
      await db.upsertItem(crownState);

      const reigns = await db.queryItems({
        query: "SELECT * FROM c WHERE c.partitionKey = 'CROWN_REIGN' AND c.division = @division AND c.playerId = @playerId",
        parameters: [
          { name: '@division', value: division },
          { name: '@playerId', value: currentHolderId }
        ]
      });
      const activeReign = reigns.find(r => r.endedMatchId === null);
      if (activeReign) {
        activeReign.successfulDefenses += 1;
        await db.upsertItem(activeReign);
      }

      return {
        crownChallenged: true,
        crownDefended: true,
        crownHolderBefore: currentHolderId,
        crownHolderAfter: currentHolderId
      };
    } else {
      const previousHolderId = currentHolderId;

      // End active reign
      const reigns = await db.queryItems({
        query: "SELECT * FROM c WHERE c.partitionKey = 'CROWN_REIGN' AND c.division = @division AND c.playerId = @playerId",
        parameters: [
          { name: '@division', value: division },
          { name: '@playerId', value: currentHolderId }
        ]
      });
      const activeReign = reigns.find(r => r.endedMatchId === null);
      if (activeReign) {
        activeReign.endedMatchId = matchId;
        activeReign.endedAt = playedAt;
        await db.upsertItem(activeReign);
      }

      // Start new reign
      const newReign = {
        id: `reign_${uuidv4()}`,
        partitionKey: 'CROWN_REIGN',
        type: 'crown_reign',
        division,
        playerId: winner.playerId,
        playerName: winner.playerName,
        startedMatchId: matchId,
        startedAt: playedAt,
        endedMatchId: null,
        endedAt: null,
        successfulDefenses: 0
      };
      await db.createItem(newReign);

      // Update state
      crownState.currentHolderId = winner.playerId;
      crownState.currentHolderName = winner.playerName;
      crownState.acquiredMatchId = matchId;
      crownState.acquiredAt = playedAt;
      crownState.defensesCount = 0;
      await db.upsertItem(crownState);

      return {
        crownChallenged: true,
        crownDefended: false,
        crownHolderBefore: previousHolderId,
        crownHolderAfter: winner.playerId
      };
    }
  },

  async getReigns() {
    return await db.queryItems({
      query: "SELECT * FROM c WHERE c.partitionKey = 'CROWN_REIGN'"
    });
  },

  async getCurrentCrowns() {
    return await db.queryItems({
      query: "SELECT * FROM c WHERE c.partitionKey = 'CROWN'"
    });
  },

  async rebuildCrownTimeline() {
    // 1. Delete all current crown state records and reigns
    const crowns = await this.getCurrentCrowns();
    for (const c of crowns) {
      await db.deleteItem(c.id, 'CROWN');
    }
    const reigns = await this.getReigns();
    for (const r of reigns) {
      await db.deleteItem(r.id, 'CROWN_REIGN');
    }

    // 2. Get all matches sorted chronologically
    const matches = await db.queryItems({
      query: "SELECT * FROM c WHERE c.partitionKey = 'MATCH' AND c.type = 'match'"
    });
    matches.sort((a, b) => new Date(a.playedAt) - new Date(b.playedAt));

    // 3. Re-process matches in order
    for (const match of matches) {
      const crownResult = await this.processMatchCrown(match.id, match.division, match.placements, match.playedAt);
      
      // Update match with new crown results
      match.crownChallenged = crownResult.crownChallenged;
      match.crownDefended = crownResult.crownDefended;
      match.crownHolderBefore = crownResult.crownHolderBefore;
      match.crownHolderAfter = crownResult.crownHolderAfter;
      
      await db.upsertItem(match);
    }
  }
};

module.exports = crownService;
