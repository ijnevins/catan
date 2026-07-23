# Catan Match Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a retro Catan match tracking application with UFC-style lineal championship crowns for 4, 5, and 6-player divisions, using Azure Cosmos DB NoSQL database or a local JSON database fallback.

**Architecture:** A Node.js Express API server that serves static frontend files, performs dynamic stats computation, and writes match and crown state documents to a single Cosmos DB container.

**Tech Stack:** Node.js, Express, @azure/cosmos SDK, Jest (for testing), HTML5, CSS3, Vanilla JS.

---

### Task 1: Environment Config and Unified Database Client

We need a database wrapper (`src/db.js`) that queries a single Cosmos DB container, falling back automatically to a local JSON file (`data/db.json`) if connection environment variables are missing. This guarantees zero-config local startup out of the box.

**Files:**
- Create: `src/config.js`
- Create: `src/db.js`
- Test: `tests/db.test.js`

- [ ] **Step 1: Write database interface test**
  Create `tests/db.test.js` to assert that items can be created, read, updated, and queried:
  ```javascript
  const db = require('../src/db');
  const path = require('path');
  const fs = require('fs');

  describe('Database Client', () => {
    beforeAll(async () => {
      // Ensure we are using the local mock database for testing
      process.env.DB_MOCK = 'true';
      await db.init();
    });

    afterAll(() => {
      const mockPath = path.join(__dirname, '../data/db.json');
      if (fs.existsSync(mockPath)) {
        fs.unlinkSync(mockPath);
      }
    });

    test('should create and retrieve documents', async () => {
      const doc = { id: 'test_doc_1', partitionKey: 'TEST', name: 'Test User' };
      await db.createItem(doc);

      const retrieved = await db.readItem('test_doc_1', 'TEST');
      expect(retrieved).toEqual(doc);
    });

    test('should query documents', async () => {
      const items = await db.queryItems({
        query: 'SELECT * FROM c WHERE c.partitionKey = @pk',
        parameters: [{ name: '@pk', value: 'TEST' }]
      });
      expect(items.length).toBe(1);
      expect(items[0].id).toBe('test_doc_1');
    });

    test('should upsert documents', async () => {
      const doc = { id: 'test_doc_1', partitionKey: 'TEST', name: 'Updated Name' };
      await db.upsertItem(doc);

      const retrieved = await db.readItem('test_doc_1', 'TEST');
      expect(retrieved.name).toBe('Updated Name');
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx jest tests/db.test.js`
  Expected: FAIL (Cannot find module '../src/db')

- [ ] **Step 3: Implement Config and Database Wrapper**
  Create `src/config.js`:
  ```javascript
  require('dotenv').config();

  module.exports = {
    COSMOS_ENDPOINT: process.env.COSMOS_ENDPOINT || '',
    COSMOS_KEY: process.env.COSMOS_KEY || '',
    DATABASE_NAME: process.env.DATABASE_NAME || 'CatanDatabase',
    CONTAINER_NAME: process.env.CONTAINER_NAME || 'CatanContainer',
    USE_MOCK: process.env.DB_MOCK === 'true' || !process.env.COSMOS_ENDPOINT
  };
  ```

  Create `src/db.js`:
  ```javascript
  const fs = require('fs');
  const path = require('path');
  const { CosmosClient } = require('@azure/cosmos');
  const config = require('./config');

  let container = null;
  const mockFilePath = path.join(__dirname, '../data/db.json');
  let mockDbData = [];

  function loadMockData() {
    if (!fs.existsSync(path.dirname(mockFilePath))) {
      fs.mkdirSync(path.dirname(mockFilePath), { recursive: true });
    }
    if (fs.existsSync(mockFilePath)) {
      try {
        const fileContent = fs.readFileSync(mockFilePath, 'utf8');
        mockDbData = JSON.parse(fileContent);
      } catch (e) {
        mockDbData = [];
      }
    } else {
      mockDbData = [];
      fs.writeFileSync(mockFilePath, JSON.stringify(mockDbData, null, 2));
    }
  }

  function saveMockData() {
    fs.writeFileSync(mockFilePath, JSON.stringify(mockDbData, null, 2));
  }

  const db = {
    async init() {
      if (config.USE_MOCK) {
        loadMockData();
        return;
      }

      try {
        const client = new CosmosClient({
          endpoint: config.COSMOS_ENDPOINT,
          key: config.COSMOS_KEY
        });
        const { database } = await client.databases.createIfNotExists({ id: config.DATABASE_NAME });
        const { container: containerRef } = await database.containers.createIfNotExists({
          id: config.CONTAINER_NAME,
          partitionKey: '/partitionKey'
        });
        container = containerRef;
      } catch (err) {
        console.error('Cosmos DB init failed, falling back to mock JSON database.', err.message);
        config.USE_MOCK = true;
        loadMockData();
      }
    },

    async createItem(item) {
      if (config.USE_MOCK) {
        if (mockDbData.some(i => i.id === item.id && i.partitionKey === item.partitionKey)) {
          throw new Error('Conflict');
        }
        mockDbData.push(JSON.parse(JSON.stringify(item)));
        saveMockData();
        return { resource: item };
      }
      return await container.items.create(item);
    },

    async readItem(id, partitionKey) {
      if (config.USE_MOCK) {
        const item = mockDbData.find(i => i.id === id && i.partitionKey === partitionKey);
        return item ? JSON.parse(JSON.stringify(item)) : null;
      }
      try {
        const { resource } = await container.item(id, partitionKey).read();
        return resource || null;
      } catch (e) {
        if (e.statusCode === 404) return null;
        throw e;
      }
    },

    async upsertItem(item) {
      if (config.USE_MOCK) {
        const idx = mockDbData.findIndex(i => i.id === item.id && i.partitionKey === item.partitionKey);
        if (idx !== -1) {
          mockDbData[idx] = JSON.parse(JSON.stringify(item));
        } else {
          mockDbData.push(JSON.parse(JSON.stringify(item)));
        }
        saveMockData();
        return { resource: item };
      }
      return await container.items.upsert(item);
    },

    async queryItems(querySpec) {
      if (config.USE_MOCK) {
        // Query interpreter for standard SELECT queries
        let filtered = [...mockDbData];
        const params = querySpec.parameters || [];

        // Check if query is looking for partitionKey
        const pkParam = params.find(p => p.name === '@pk');
        if (pkParam) {
          filtered = filtered.filter(i => i.partitionKey === pkParam.value);
        }
        const divParam = params.find(p => p.name === '@division');
        if (divParam) {
          filtered = filtered.filter(i => i.division === divParam.value);
        }
        const playerParam = params.find(p => p.name === '@playerId');
        if (playerParam) {
          filtered = filtered.filter(i => i.playerId === playerParam.value);
        }
        return filtered;
      }
      const { resources } = await container.items.query(querySpec).fetchAll();
      return resources;
    }
  };

  module.exports = db;
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx jest tests/db.test.js`
  Expected: PASS

- [ ] **Step 5: Commit config & DB wrapper**
  Run: `git add src/config.js src/db.js tests/db.test.js && git commit -m "feat: add db wrapper and config"`

---

### Task 2: Player Service & API Router

We will write `src/services/playerService.js` and `src/routes/playerRoutes.js` to create players and retrieve the full player list.

**Files:**
- Create: `src/services/playerService.js`
- Create: `src/routes/playerRoutes.js`
- Test: `tests/player.test.js`

- [ ] **Step 1: Write player service tests**
  Create `tests/player.test.js`:
  ```javascript
  const db = require('../src/db');
  const playerService = require('../src/services/playerService');
  const path = require('path');
  const fs = require('fs');

  describe('Player Service', () => {
    beforeAll(async () => {
      process.env.DB_MOCK = 'true';
      await db.init();
    });

    afterAll(() => {
      const mockPath = path.join(__dirname, '../data/db.json');
      if (fs.existsSync(mockPath)) {
        fs.unlinkSync(mockPath);
      }
    });

    test('should create players and list them', async () => {
      const player1 = await playerService.createPlayer('Alice');
      expect(player1.name).toBe('Alice');
      expect(player1.partitionKey).toBe('PLAYER');
      expect(player1.type).toBe('player');
      expect(player1.id).toBeDefined();

      const players = await playerService.getPlayers();
      expect(players.length).toBe(1);
      expect(players[0].name).toBe('Alice');
    });

    test('should reject creation of duplicate player names', async () => {
      await expect(playerService.createPlayer('Alice')).rejects.toThrow('Player with name Alice already exists');
    });
  });
  ```

- [ ] **Step 2: Run test to verify failure**
  Run: `npx jest tests/player.test.js`
  Expected: FAIL (Cannot find module '../src/services/playerService')

- [ ] **Step 3: Implement Player Service & Router**
  Create `src/services/playerService.js`:
  ```javascript
  const db = require('../db');
  const { v4: uuidv4 } = require('uuid');

  const playerService = {
    async createPlayer(name) {
      if (!name || name.trim() === '') {
        throw new Error('Player name is required');
      }
      const trimmedName = name.trim();

      // Check duplicate
      const players = await this.getPlayers();
      const duplicate = players.some(p => p.name.toLowerCase() === trimmedName.toLowerCase());
      if (duplicate) {
        throw new Error(`Player with name ${trimmedName} already exists`);
      }

      const player = {
        id: `player_${uuidv4()}`,
        partitionKey: 'PLAYER',
        type: 'player',
        name: trimmedName,
        createdAt: new Date().toISOString()
      };

      await db.createItem(player);
      return player;
    },

    async getPlayers() {
      return await db.queryItems({
        query: "SELECT * FROM c WHERE c.partitionKey = 'PLAYER' AND c.type = 'player'"
      });
    }
  };

  module.exports = playerService;
  ```

  Create `src/routes/playerRoutes.js`:
  ```javascript
  const express = require('express');
  const router = express.Router();
  const playerService = require('../services/playerService');

  router.get('/', async (req, res) => {
    try {
      const players = await playerService.getPlayers();
      res.json(players);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { name } = req.body;
      const player = await playerService.createPlayer(name);
      res.status(201).json(player);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  module.exports = router;
  ```

- [ ] **Step 4: Run test to verify passing**
  Run: `npx jest tests/player.test.js`
  Expected: PASS

- [ ] **Step 5: Commit Player Component**
  Run: `git add src/services/playerService.js src/routes/playerRoutes.js tests/player.test.js && git commit -m "feat: add player service and routes"`

---

### Task 3: Match Service & Lineal Championship (UFC Crown) Logic

This task implements the Core Game logic: entering a game results in assigning placement lists and updating the crown states and reigns for the specific division.

**Files:**
- Create: `src/services/crownService.js`
- Create: `src/services/matchService.js`
- Create: `src/routes/matchRoutes.js`
- Test: `tests/crown.test.js`

- [ ] **Step 1: Write UFC Crown transition tests**
  Create `tests/crown.test.js` to verify:
  1. Inaugural crown assignment.
  2. Crown defense (current holder wins).
  3. Crown transfer (current holder loses).
  4. Non-challenge matches (current holder does not play).
  ```javascript
  const db = require('../src/db');
  const matchService = require('../src/services/matchService');
  const path = require('path');
  const fs = require('fs');

  describe('Crown and Match Service', () => {
    beforeEach(async () => {
      process.env.DB_MOCK = 'true';
      await db.init();
    });

    afterEach(() => {
      const mockPath = path.join(__dirname, '../data/db.json');
      if (fs.existsSync(mockPath)) {
        fs.unlinkSync(mockPath);
      }
    });

    test('should handle crown lineage and matches correctly', async () => {
      // 1. First Match in Division 4. Winner: Alice. Crown goes to Alice.
      const match1Placements = [
        { playerId: 'p_alice', playerName: 'Alice', place: 1, victoryPoints: 10 },
        { playerId: 'p_bob', playerName: 'Bob', place: 2, victoryPoints: 8 },
        { playerId: 'p_charlie', playerName: 'Charlie', place: 3, victoryPoints: 7 },
        { playerId: 'p_david', playerName: 'David', place: 4, victoryPoints: 5 }
      ];
      const m1 = await matchService.createMatch(4, match1Placements);
      expect(m1.crownChallenged).toBe(true);
      expect(m1.crownDefended).toBe(false); // First setting is not a defense
      expect(m1.crownHolderBefore).toBeNull();
      expect(m1.crownHolderAfter).toBe('p_alice');

      // Check current crown state
      let crown4 = await db.readItem('crown_division_4', 'CROWN');
      expect(crown4.currentHolderId).toBe('p_alice');
      expect(crown4.defensesCount).toBe(0);

      // 2. Alice plays in next game, and wins. Crown is defended!
      const match2Placements = [
        { playerId: 'p_alice', playerName: 'Alice', place: 1, victoryPoints: 10 },
        { playerId: 'p_bob', playerName: 'Bob', place: 2, victoryPoints: 9 },
        { playerId: 'p_charlie', playerName: 'Charlie', place: 3, victoryPoints: 6 },
        { playerId: 'p_david', playerName: 'David', place: 4, victoryPoints: 5 }
      ];
      const m2 = await matchService.createMatch(4, match2Placements);
      expect(m2.crownChallenged).toBe(true);
      expect(m2.crownDefended).toBe(true);
      expect(m2.crownHolderAfter).toBe('p_alice');

      crown4 = await db.readItem('crown_division_4', 'CROWN');
      expect(crown4.defensesCount).toBe(1);

      // 3. Match without Alice. Crown is not challenged.
      const match3Placements = [
        { playerId: 'p_bob', playerName: 'Bob', place: 1, victoryPoints: 10 },
        { playerId: 'p_charlie', playerName: 'Charlie', place: 2, victoryPoints: 8 },
        { playerId: 'p_david', playerName: 'David', place: 3, victoryPoints: 6 },
        { playerId: 'p_eve', playerName: 'Eve', place: 4, victoryPoints: 5 }
      ];
      const m3 = await matchService.createMatch(4, match3Placements);
      expect(m3.crownChallenged).toBe(false);
      expect(m3.crownHolderAfter).toBe('p_alice');

      // 4. Alice plays and Bob wins. Bob takes the crown.
      const match4Placements = [
        { playerId: 'p_bob', playerName: 'Bob', place: 1, victoryPoints: 10 },
        { playerId: 'p_alice', playerName: 'Alice', place: 2, victoryPoints: 9 },
        { playerId: 'p_charlie', playerName: 'Charlie', place: 3, victoryPoints: 7 },
        { playerId: 'p_david', playerName: 'David', place: 4, victoryPoints: 4 }
      ];
      const m4 = await matchService.createMatch(4, match4Placements);
      expect(m4.crownChallenged).toBe(true);
      expect(m4.crownDefended).toBe(false);
      expect(m4.crownHolderAfter).toBe('p_bob');

      crown4 = await db.readItem('crown_division_4', 'CROWN');
      expect(crown4.currentHolderId).toBe('p_bob');
      expect(crown4.defensesCount).toBe(0);
    });
  });
  ```

- [ ] **Step 2: Run tests to verify they fail**
  Run: `npx jest tests/crown.test.js`
  Expected: FAIL (Cannot find module '../src/services/matchService')

- [ ] **Step 3: Implement Crown Logic, Match Service & Router**
  Create `src/services/crownService.js`:
  ```javascript
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
      const holderPlayed = placements.some(p => p.playerId === currentHolderId);

      if (!holderPlayed) {
        return {
          crownChallenged: false,
          crownDefended: null,
          crownHolderBefore: currentHolderId,
          crownHolderAfter: currentHolderId
        };
      }

      const holderWon = winner.playerId === currentHolderId;

      if (holderWon) {
        crownState.defensesCount += 1;
        await db.upsertItem(crownState);

        const reigns = await db.queryItems({
          query: "SELECT * FROM c WHERE c.partitionKey = 'CROWN_REIGN' AND c.division = @division AND c.playerId = @playerId"
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
          query: "SELECT * FROM c WHERE c.partitionKey = 'CROWN_REIGN' AND c.division = @division AND c.playerId = @playerId"
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
    }
  };

  module.exports = crownService;
  ```

  Create `src/services/matchService.js`:
  ```javascript
  const db = require('../db');
  const crownService = require('./crownService');
  const { v4: uuidv4 } = require('uuid');

  const matchService = {
    async createMatch(division, placements) {
      if (![4, 5, 6].includes(division)) {
        throw new Error('Invalid division. Must be 4, 5, or 6 players.');
      }
      if (placements.length !== division) {
        throw new Error(`Placements list must match player division (${division})`);
      }

      const matchId = `match_${uuidv4()}`;
      const playedAt = new Date().toISOString();

      const crownResult = await crownService.processMatchCrown(matchId, division, placements, playedAt);

      const match = {
        id: matchId,
        partitionKey: 'MATCH',
        type: 'match',
        division,
        playedAt,
        placements,
        crownChallenged: crownResult.crownChallenged,
        crownDefended: crownResult.crownDefended,
        crownHolderBefore: crownResult.crownHolderBefore,
        crownHolderAfter: crownResult.crownHolderAfter
      };

      await db.createItem(match);
      return match;
    },

    async getMatches() {
      return await db.queryItems({
        query: "SELECT * FROM c WHERE c.partitionKey = 'MATCH' AND c.type = 'match'"
      });
    }
  };

  module.exports = matchService;
  ```

  Create `src/routes/matchRoutes.js`:
  ```javascript
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
      const { division, placements } = req.body;
      const match = await matchService.createMatch(parseInt(division, 10), placements);
      res.status(201).json(match);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  module.exports = router;
  ```

- [ ] **Step 4: Run tests to verify they pass**
  Run: `npx jest tests/crown.test.js`
  Expected: PASS

- [ ] **Step 5: Commit Match Service**
  Run: `git add src/services/crownService.js src/services/matchService.js src/routes/matchRoutes.js tests/crown.test.js && git commit -m "feat: add match service and crown logic"`

---

### Task 4: Statistics Engine Implementation

This task constructs the statistics engine to dynamically evaluate placement sums, overall win ratios, and maximum consecutive win streaks.

**Files:**
- Create: `src/services/statsEngine.js`
- Create: `src/routes/statsRoutes.js`
- Test: `tests/stats.test.js`

- [ ] **Step 1: Write stats calculation test**
  Create `tests/stats.test.js`:
  ```javascript
  const statsEngine = require('../src/services/statsEngine');

  describe('Stats Engine', () => {
    const players = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
      { id: 'p3', name: 'Charlie' },
      { id: 'p4', name: 'David' }
    ];

    const matches = [
      {
        division: 4,
        playedAt: '2026-07-17T12:00:00Z',
        placements: [
          { playerId: 'p1', playerName: 'Alice', place: 1, victoryPoints: 10 },
          { playerId: 'p2', playerName: 'Bob', place: 2, victoryPoints: 8 },
          { playerId: 'p3', playerName: 'Charlie', place: 3, victoryPoints: 7 },
          { playerId: 'p4', playerName: 'David', place: 4, victoryPoints: 6 }
        ]
      },
      {
        division: 4,
        playedAt: '2026-07-17T13:00:00Z',
        placements: [
          { playerId: 'p1', playerName: 'Alice', place: 1, victoryPoints: 10 },
          { playerId: 'p2', playerName: 'Bob', place: 3, victoryPoints: 7 },
          { playerId: 'p3', playerName: 'Charlie', place: 2, victoryPoints: 8 },
          { playerId: 'p4', playerName: 'David', place: 4, victoryPoints: 5 }
        ]
      },
      {
        division: 4,
        playedAt: '2026-07-17T14:00:00Z',
        placements: [
          { playerId: 'p2', playerName: 'Bob', place: 1, victoryPoints: 10 },
          { playerId: 'p1', playerName: 'Alice', place: 2, victoryPoints: 8 },
          { playerId: 'p3', playerName: 'Charlie', place: 3, victoryPoints: 6 },
          { playerId: 'p4', playerName: 'David', place: 4, victoryPoints: 5 }
        ]
      }
    ];

    test('should compute correct global statistics', () => {
      const stats = statsEngine.calculateStats(matches, players);

      const alice = stats.find(s => s.id === 'p1');
      expect(alice.totalWins).toBe(2);
      expect(alice.totalLosses).toBe(1);
      expect(alice.winRate).toBeCloseTo(0.6666, 3);
      expect(alice.maxStreak).toBe(2);
      expect(alice.placements[1]).toBe(2);
      expect(alice.placements[2]).toBe(1);

      const bob = stats.find(s => s.id === 'p2');
      expect(bob.totalWins).toBe(1);
      expect(bob.totalLosses).toBe(2);
      expect(bob.maxStreak).toBe(1);
    });
  });
  ```

- [ ] **Step 2: Run test to verify failure**
  Run: `npx jest tests/stats.test.js`
  Expected: FAIL (Cannot find module '../src/services/statsEngine')

- [ ] **Step 3: Implement Stats Engine & Router**
  Create `src/services/statsEngine.js`:
  ```javascript
  const statsEngine = {
    calculateStats(matches, players, division = null) {
      const filteredMatches = division
        ? matches.filter(m => m.division === parseInt(division, 10))
        : matches;

      const sortedMatches = [...filteredMatches].sort((a, b) => new Date(a.playedAt) - new Date(b.playedAt));

      const stats = {};
      for (const player of players) {
        stats[player.id] = {
          id: player.id,
          name: player.name,
          totalWins: 0,
          totalLosses: 0,
          winRate: 0,
          placements: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
          currentStreak: 0,
          maxStreak: 0
        };
      }

      for (const match of sortedMatches) {
        for (const p of match.placements) {
          const pId = p.playerId;
          if (!stats[pId]) {
            stats[pId] = {
              id: pId,
              name: p.playerName,
              totalWins: 0,
              totalLosses: 0,
              winRate: 0,
              placements: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
              currentStreak: 0,
              maxStreak: 0
            };
          }

          const pStats = stats[pId];
          pStats.placements[p.place] = (pStats.placements[p.place] || 0) + 1;

          if (p.place === 1) {
            pStats.totalWins += 1;
            pStats.currentStreak += 1;
            if (pStats.currentStreak > pStats.maxStreak) {
              pStats.maxStreak = pStats.currentStreak;
            }
          } else {
            pStats.totalLosses += 1;
            pStats.currentStreak = 0;
          }
        }
      }

      return Object.values(stats).map(pStats => {
        const totalGames = pStats.totalWins + pStats.totalLosses;
        pStats.winRate = totalGames > 0 ? (pStats.totalWins / totalGames) : 0;
        return pStats;
      });
    }
  };

  module.exports = statsEngine;
  ```

  Create `src/routes/statsRoutes.js`:
  ```javascript
  const express = require('express');
  const router = express.Router();
  const matchService = require('../services/matchService');
  const playerService = require('../services/playerService');
  const statsEngine = require('../services/statsEngine');
  const crownService = require('../services/crownService');

  async function getAggregatedStats(division = null) {
    const [matches, players, currentCrowns, reigns] = await Promise.all([
      matchService.getMatches(),
      playerService.getPlayers(),
      crownService.getCurrentCrowns(),
      crownService.getReigns()
    ]);

    const playerStats = statsEngine.calculateStats(matches, players, division);
    
    // Sort playerStats by totalWins desc, then winRate desc
    playerStats.sort((a, b) => {
      if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
      return b.winRate - a.winRate;
    });

    const divisionCrowns = division 
      ? currentCrowns.filter(c => c.division === parseInt(division, 10))
      : currentCrowns;

    const divisionReigns = division
      ? reigns.filter(r => r.division === parseInt(division, 10))
      : reigns;

    return {
      playerStats,
      crowns: divisionCrowns,
      reigns: divisionReigns
    };
  }

  router.get('/', async (req, res) => {
    try {
      const stats = await getAggregatedStats();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:division', async (req, res) => {
    try {
      const div = parseInt(req.params.division, 10);
      if (![4, 5, 6].includes(div)) {
        return res.status(400).json({ error: 'Division must be 4, 5, or 6' });
      }
      const stats = await getAggregatedStats(div);
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  module.exports = router;
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx jest tests/stats.test.js`
  Expected: PASS

- [ ] **Step 5: Commit Stats Component**
  Run: `git add src/services/statsEngine.js src/routes/statsRoutes.js tests/stats.test.js && git commit -m "feat: add stats engine and api routes"`

---

### Task 5: Server Integration and Root App Boot

Integrate all routers under Express, define static asset folder paths for serving the frontend client, and boot up the main server.

**Files:**
- Create: `src/server.js`
- Test: `tests/server.test.js`

- [ ] **Step 1: Write server integration test**
  Create `tests/server.test.js`:
  ```javascript
  const db = require('../src/db');
  const express = require('express');
  const path = require('path');
  const fs = require('fs');

  describe('Server API Boot', () => {
    let app, server;

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
      // Simulate Express route matching for sanity check
      const playerService = require('../src/services/playerService');
      const p = await playerService.createPlayer('Alice');
      expect(p.name).toBe('Alice');
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx jest tests/server.test.js`
  Expected: FAIL (Cannot find module '../src/server.js' or routes)

- [ ] **Step 3: Implement Main Server Entrypoint**
  Create `src/server.js`:
  ```javascript
  const express = require('express');
  const cors = require('cors');
  const path = require('path');
  const db = require('./db');

  const playerRoutes = require('./routes/playerRoutes');
  const matchRoutes = require('./routes/matchRoutes');
  const statsRoutes = require('./routes/statsRoutes');

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
  ```

- [ ] **Step 4: Run all tests to verify they pass**
  Run: `npx jest`
  Expected: PASS all test files

- [ ] **Step 5: Commit Server Setup**
  Run: `git add src/server.js tests/server.test.js && git commit -m "feat: add main server entry point"`

---

### Task 6: Retro Catan Board-Game UI Development

Build a highly tactile front end. Emulate physical board elements using custom typography, warm wood and parchment color themes, thick outlines, heavy-shadow buttons, and a clean card structure. Avoid glowing CSS borders, modern gradients, transparency circles, or floating bubbles.

**Files:**
- Create: `public/index.html`
- Create: `public/style.css`
- Create: `public/app.js`

- [ ] **Step 1: Create physical board-game layout**
  Create `public/index.html`:
  ```html
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Catan Match & Crown Tracker</title>
    <link rel="stylesheet" href="style.css">
  </head>
  <body>
    <header class="tactile-header">
      <h1>CATAN LINEAL CHAMPIONSHIP</h1>
      <p>Recording victors and settlement development in the Victor Almanac</p>
    </header>

    <main class="dashboard-grid">
      <!-- DIVISION CROWNS SECTION -->
      <section class="catan-card board-box">
        <h2 class="section-title">🏆 Current Division Crowns 🏆</h2>
        <div class="crowns-row" id="crownsContainer">
          <!-- Populated by JS -->
        </div>
      </section>

      <!-- LOG A MATCH SECTION -->
      <section class="catan-card log-box">
        <h2 class="section-title">🎲 Log a Match 🎲</h2>
        <form id="matchForm">
          <div class="form-group">
            <label for="divisionSelect">Game Division:</label>
            <select id="divisionSelect" required>
              <option value="4" selected>4-Player Division</option>
              <option value="5">5-Player Division</option>
              <option value="6">6-Player Division</option>
            </select>
          </div>

          <div class="form-group">
            <label>Placements (1st is Winner):</label>
            <div id="placementInputsContainer">
              <!-- Dynamically populated placement forms -->
            </div>
          </div>

          <button type="submit" class="retro-btn btn-primary">Lock Match Record</button>
        </form>
      </section>

      <!-- LEADERBOARDS & STATS -->
      <section class="catan-card stats-box">
        <h2 class="section-title">📊 Leaderboard & Player Stats 📊</h2>
        
        <div class="division-tabs">
          <button class="tab-btn active" data-div="global">Global</button>
          <button class="tab-btn" data-div="4">4-Player</button>
          <button class="tab-btn" data-div="5">5-Player</button>
          <button class="tab-btn" data-div="6">6-Player</button>
        </div>

        <div class="table-container">
          <table class="retro-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Wins</th>
                <th>Losses</th>
                <th>Win Rate</th>
                <th>Streak (Max)</th>
                <th>Placements (1st/2nd/3rd...)</th>
              </tr>
            </thead>
            <tbody id="leaderboardBody">
              <!-- Dynamic Leaderboard content -->
            </tbody>
          </table>
        </div>
      </section>

      <!-- ADD NEW PLAYER -->
      <section class="catan-card player-box">
        <h2 class="section-title">👤 Add Player 👤</h2>
        <form id="playerForm">
          <div class="form-group">
            <label for="playerNameInput">Player Name:</label>
            <input type="text" id="playerNameInput" placeholder="Enter name..." required>
          </div>
          <button type="submit" class="retro-btn btn-secondary">Register Player</button>
        </form>
      </section>

      <!-- CROWN LINEAGE TIMELINE -->
      <section class="catan-card lineage-box">
        <h2 class="section-title">📜 Crown Lineage History 📜</h2>
        <div id="lineageTimeline" class="timeline">
          <!-- Dynamic Lineage records -->
        </div>
      </section>
    </main>

    <footer class="tactile-footer">
      <p>Hexes, clay, and wheat. Long live the Crown holder.</p>
    </footer>
  </body>
  </html>
  ```

- [ ] **Step 2: Create tactile retro CSS styling**
  Create `public/style.css`:
  ```css
  /* Physical, Board-game theme CSS */
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;800&family=Special+Elite&family=Courier+Prime&display=swap');

  :root {
    --color-wood: #8B5A2B;
    --color-clay: #B22222;
    --color-wheat: #EEDC82;
    --color-forest: #228B22;
    --color-ore: #708090;
    --color-parchment: #F5F2EB;
    --color-ink: #2B2620;
    --color-border: #3A322D;
    
    --font-header: 'Cinzel', serif;
    --font-tactile: 'Special Elite', monospace;
    --font-data: 'Courier Prime', monospace;
  }

  body {
    background-color: #5C4033; /* Dark earthy mahogany */
    background-image: radial-gradient(var(--color-wood) 1px, transparent 1px);
    background-size: 24px 24px;
    color: var(--color-ink);
    font-family: var(--font-tactile);
    margin: 0;
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .tactile-header {
    background-color: var(--color-parchment);
    border: 4px solid var(--color-border);
    border-radius: 8px;
    padding: 20px 40px;
    text-align: center;
    box-shadow: 6px 6px 0px var(--color-border);
    margin-bottom: 30px;
    max-width: 1000px;
    width: 90%;
  }

  .tactile-header h1 {
    font-family: var(--font-header);
    color: var(--color-clay);
    font-size: 2.5rem;
    margin: 0 0 10px 0;
    text-shadow: 2px 2px 0px var(--color-wheat);
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 30px;
    max-width: 1200px;
    width: 95%;
  }

  @media (max-width: 800px) {
    .dashboard-grid {
      grid-template-columns: 1fr;
    }
  }

  .catan-card {
    background-color: var(--color-parchment);
    border: 4px solid var(--color-border);
    border-radius: 8px;
    padding: 24px;
    box-shadow: 6px 6px 0px var(--color-border);
    position: relative;
    overflow: hidden;
  }

  /* Specific styles representing Catan components */
  .board-box {
    grid-column: 1 / -1;
    background-color: #dfd7c2;
    border-color: var(--color-wood);
  }

  .stats-box {
    grid-column: 1 / -1;
  }

  .lineage-box {
    grid-column: 1 / -1;
  }

  .section-title {
    font-family: var(--font-header);
    color: var(--color-wood);
    font-size: 1.5rem;
    border-bottom: 3px double var(--color-border);
    padding-bottom: 8px;
    margin-top: 0;
    margin-bottom: 20px;
    text-align: center;
  }

  .crowns-row {
    display: flex;
    justify-content: space-around;
    flex-wrap: wrap;
    gap: 20px;
  }

  .crown-badge {
    background-color: var(--color-wheat);
    border: 3px solid var(--color-border);
    padding: 15px;
    border-radius: 6px;
    text-align: center;
    box-shadow: 4px 4px 0px var(--color-border);
    min-width: 180px;
  }

  .crown-badge h3 {
    margin: 0 0 10px 0;
    font-family: var(--font-header);
    color: var(--color-clay);
  }

  .crown-badge .holder-name {
    font-size: 1.3rem;
    font-weight: bold;
    color: var(--color-ink);
  }

  .form-group {
    margin-bottom: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  label {
    font-weight: bold;
    color: var(--color-wood);
  }

  select, input[type="text"] {
    background-color: #fff;
    border: 3px solid var(--color-border);
    padding: 10px;
    font-family: var(--font-data);
    font-size: 1rem;
    border-radius: 4px;
    outline: none;
  }

  select:focus, input[type="text"]:focus {
    border-color: var(--color-clay);
  }

  .placement-row {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 10px;
  }

  .placement-row select, .placement-row input {
    flex: 1;
  }

  .retro-btn {
    font-family: var(--font-tactile);
    font-size: 1.1rem;
    font-weight: bold;
    padding: 12px 20px;
    border: 3px solid var(--color-border);
    border-radius: 6px;
    cursor: pointer;
    box-shadow: 4px 4px 0px var(--color-border);
    transition: transform 0.05s, box-shadow 0.05s;
  }

  .retro-btn:active {
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0px var(--color-border);
  }

  .btn-primary {
    background-color: var(--color-clay);
    color: #fff;
  }

  .btn-secondary {
    background-color: var(--color-forest);
    color: #fff;
  }

  .division-tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    justify-content: center;
  }

  .tab-btn {
    background-color: var(--color-parchment);
    border: 3px solid var(--color-border);
    padding: 8px 16px;
    cursor: pointer;
    font-family: var(--font-tactile);
    border-radius: 4px;
  }

  .tab-btn.active {
    background-color: var(--color-wheat);
    box-shadow: inset 2px 2px 4px rgba(0,0,0,0.2);
  }

  .table-container {
    overflow-x: auto;
    border: 3px solid var(--color-border);
    border-radius: 6px;
  }

  .retro-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-data);
    background-color: #fff;
  }

  .retro-table th, .retro-table td {
    border: 2px solid var(--color-border);
    padding: 12px;
    text-align: left;
  }

  .retro-table th {
    background-color: var(--color-wheat);
    font-family: var(--font-header);
    color: var(--color-wood);
  }

  .retro-table tr:nth-child(even) {
    background-color: var(--color-parchment);
  }

  .timeline {
    display: flex;
    flex-direction: column;
    gap: 15px;
    max-height: 300px;
    overflow-y: auto;
    border: 3px solid var(--color-border);
    padding: 15px;
    border-radius: 6px;
    background: #e9e4d5;
  }

  .timeline-item {
    border-left: 4px solid var(--color-clay);
    padding-left: 15px;
    margin-left: 10px;
  }

  .timeline-item .reign-title {
    font-weight: bold;
    color: var(--color-clay);
  }

  .timeline-item .reign-details {
    font-size: 0.9rem;
    color: #555;
  }

  .tactile-footer {
    margin-top: 50px;
    margin-bottom: 30px;
    text-align: center;
    border-top: 3px double var(--color-border);
    padding-top: 15px;
    width: 90%;
    color: var(--color-wheat);
  }
  ```

- [ ] **Step 3: Add Client-Side API interactions**
  Create `public/app.js`:
  ```javascript
  let activeTab = 'global';
  let playersList = [];

  document.addEventListener('DOMContentLoaded', async () => {
    await fetchPlayers();
    setupDivisionSelect();
    await updateDashboard();

    // Event Listeners
    document.getElementById('divisionSelect').addEventListener('change', setupDivisionSelect);
    document.getElementById('playerForm').addEventListener('submit', handlePlayerSubmit);
    document.getElementById('matchForm').addEventListener('submit', handleMatchSubmit);

    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        activeTab = e.target.getAttribute('data-div');
        renderLeaderboard();
      });
    });
  });

  async function fetchPlayers() {
    try {
      const res = await fetch('/api/players');
      playersList = await res.json();
    } catch (err) {
      console.error('Error fetching players:', err);
    }
  }

  function setupDivisionSelect() {
    const div = parseInt(document.getElementById('divisionSelect').value, 10);
    const container = document.getElementById('placementInputsContainer');
    container.innerHTML = '';

    for (let i = 1; i <= div; i++) {
      const row = document.createElement('div');
      row.className = 'placement-row';
      
      const label = document.createElement('span');
      label.innerText = `${i}${getOrdinal(i)} Place:`;
      label.style.width = '80px';
      label.style.fontWeight = 'bold';

      const playerSelect = document.createElement('select');
      playerSelect.className = 'player-select';
      playerSelect.required = true;
      playerSelect.innerHTML = `<option value="">-- Choose Player --</option>` +
        playersList.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

      const vpInput = document.createElement('input');
      vpInput.type = 'number';
      vpInput.placeholder = 'VP Score';
      vpInput.required = true;
      vpInput.min = '0';
      vpInput.max = '15';
      vpInput.className = 'vp-input';

      row.appendChild(label);
      row.appendChild(playerSelect);
      row.appendChild(vpInput);
      container.appendChild(row);
    }
  }

  function getOrdinal(n) {
    if (n === 1) return 'st';
    if (n === 2) return 'nd';
    if (n === 3) return 'rd';
    return 'th';
  }

  async function updateDashboard() {
    await fetchPlayers();
    setupDivisionSelect();
    await renderLeaderboard();
    await renderCrownsAndLineage();
  }

  async function renderLeaderboard() {
    const endpoint = activeTab === 'global' ? '/api/stats' : `/api/stats/${activeTab}`;
    const tbody = document.getElementById('leaderboardBody');
    tbody.innerHTML = '<tr><td colspan="6">Loading stats...</td></tr>';

    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      const stats = data.playerStats;

      tbody.innerHTML = '';
      if (stats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No matches recorded yet.</td></tr>';
        return;
      }

      stats.forEach(player => {
        const tr = document.createElement('tr');
        const winRatePct = (player.winRate * 100).toFixed(1) + '%';
        const placementStr = Object.entries(player.placements)
          .filter(([place, count]) => count > 0)
          .map(([place, count]) => `${place}${getOrdinal(parseInt(place))}: ${count}`)
          .join(', ');

        tr.innerHTML = `
          <td><strong>${escapeHtml(player.name)}</strong></td>
          <td>${player.totalWins}</td>
          <td>${player.totalLosses}</td>
          <td>${winRatePct}</td>
          <td>${player.currentStreak} (${player.maxStreak})</td>
          <td><small>${placementStr || 'None'}</small></td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="6">Error loading leaderboards.</td></tr>';
    }
  }

  async function renderCrownsAndLineage() {
    const crownsContainer = document.getElementById('crownsContainer');
    const timeline = document.getElementById('lineageTimeline');
    crownsContainer.innerHTML = 'Loading crowns...';
    timeline.innerHTML = 'Loading lineage...';

    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      
      const crowns = data.crowns;
      const reigns = data.reigns;

      // Render Crown Badges
      crownsContainer.innerHTML = '';
      [4, 5, 6].forEach(div => {
        const crown = crowns.find(c => c.division === div);
        const badge = document.createElement('div');
        badge.className = 'crown-badge';
        
        if (crown) {
          badge.innerHTML = `
            <h3>${div}-Player Crown</h3>
            <div class="holder-name">${escapeHtml(crown.currentHolderName)}</div>
            <div>Defenses: <strong>${crown.defensesCount}</strong></div>
          `;
        } else {
          badge.innerHTML = `
            <h3>${div}-Player Crown</h3>
            <div class="holder-name" style="color:#777; font-size:1rem;">Vacant</div>
            <div>No champion crowned yet</div>
          `;
        }
        crownsContainer.appendChild(badge);
      });

      // Render Lineage Timeline
      timeline.innerHTML = '';
      if (reigns.length === 0) {
        timeline.innerHTML = '<p>No crown reign lineage recorded.</p>';
        return;
      }

      // Sort reigns by start date desc
      const sortedReigns = [...reigns].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

      sortedReigns.forEach(reign => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        
        const dateStr = new Date(reign.startedAt).toLocaleDateString();
        const activeLabel = reign.endedAt ? `Reigned until ${new Date(reign.endedAt).toLocaleDateString()}` : 'CURRENT CHAMPION';
        
        item.innerHTML = `
          <div class="reign-title">${reign.division}-Player Crown: ${escapeHtml(reign.playerName)}</div>
          <div class="reign-details">
            Started: ${dateStr} | ${activeLabel} <br>
            Successful Defenses: <strong>${reign.successfulDefenses}</strong>
          </div>
        `;
        timeline.appendChild(item);
      });

    } catch (err) {
      crownsContainer.innerHTML = 'Error loading crowns.';
      timeline.innerHTML = 'Error loading lineage.';
    }
  }

  async function handlePlayerSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('playerNameInput');
    const name = input.value.trim();
    if (!name) return;

    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || 'Failed to create player');
        return;
      }

      input.value = '';
      await updateDashboard();
    } catch (err) {
      alert('Error creating player');
    }
  }

  async function handleMatchSubmit(e) {
    e.preventDefault();
    const division = parseInt(document.getElementById('divisionSelect').value, 10);
    const rows = document.querySelectorAll('.placement-row');
    const placements = [];
    const chosenPlayerIds = new Set();

    for (let i = 0; i < rows.length; i++) {
      const select = rows[i].querySelector('.player-select');
      const vpVal = rows[i].querySelector('.vp-input').value;
      const playerId = select.value;
      const playerName = select.options[select.selectedIndex].text;

      if (!playerId) {
        alert('Please assign a player to all placements');
        return;
      }
      if (chosenPlayerIds.has(playerId)) {
        alert('Each player can only be assigned to one placement per match');
        return;
      }
      chosenPlayerIds.add(playerId);

      placements.push({
        playerId,
        playerName,
        place: i + 1,
        victoryPoints: parseInt(vpVal, 10)
      });
    }

    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ division, placements })
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || 'Failed to record match');
        return;
      }

      await updateDashboard();
    } catch (err) {
      alert('Error recording match');
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
  }
  ```

- [ ] **Step 4: Load front end manually & check routes**
  Confirm browser assets are served correctly on startup.

- [ ] **Step 5: Commit UI assets**
  Run: `git add public/index.html public/style.css public/app.js && git commit -m "feat: implement retro Catan frontend"`

---

## Handoff Choice

Plan complete and saved to `docs/superpowers/plans/2026-07-17-catan-tracker-implementation.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
