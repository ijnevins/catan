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

    // 3. Match without Alice. Crown goes to the winner (Bob).
    const match3Placements = [
      { playerId: 'p_bob', playerName: 'Bob', place: 1, victoryPoints: 10 },
      { playerId: 'p_charlie', playerName: 'Charlie', place: 2, victoryPoints: 8 },
      { playerId: 'p_david', playerName: 'David', place: 3, victoryPoints: 6 },
      { playerId: 'p_eve', playerName: 'Eve', place: 4, victoryPoints: 5 }
    ];
    const m3 = await matchService.createMatch(4, match3Placements);
    expect(m3.crownChallenged).toBe(false);
    expect(m3.crownDefended).toBe(false);
    expect(m3.crownHolderBefore).toBe('p_alice');
    expect(m3.crownHolderAfter).toBe('p_alice');

    crown4 = await db.readItem('crown_division_4', 'CROWN');
    expect(crown4.currentHolderId).toBe('p_alice');
    expect(crown4.interimHolderId).toBe('p_bob');
    expect(crown4.defensesCount).toBe(1);

    // 4. Bob defeats the champion (Alice is present). Crown is won by Bob!
    const match4Placements = [
      { playerId: 'p_bob', playerName: 'Bob', place: 1, victoryPoints: 10 },
      { playerId: 'p_alice', playerName: 'Alice', place: 2, victoryPoints: 9 },
      { playerId: 'p_charlie', playerName: 'Charlie', place: 3, victoryPoints: 7 },
      { playerId: 'p_david', playerName: 'David', place: 4, victoryPoints: 4 }
    ];
    const m4 = await matchService.createMatch(4, match4Placements);
    expect(m4.crownChallenged).toBe(true);
    expect(m4.crownDefended).toBe(false); // Alice lost, so not a defense
    expect(m4.crownHolderBefore).toBe('p_alice');
    expect(m4.crownHolderAfter).toBe('p_bob');

    crown4 = await db.readItem('crown_division_4', 'CROWN');
    expect(crown4.currentHolderId).toBe('p_bob');
    expect(crown4.defensesCount).toBe(0);
  });

  test('should resolve string placements and tie rankings correctly', async () => {
    const matchPlacements = [
      'Alice',
      { playerName: 'Bob', victoryPoints: 8 },
      { playerName: 'Charlie', victoryPoints: 6 },
      { playerName: 'David', victoryPoints: 5 }
    ];

    const m = await matchService.createMatch(4, matchPlacements);

    expect(m.placements[0].playerName).toBe('Alice');
    expect(m.placements[0].place).toBe(1);
    expect(m.placements[0].victoryPoints).toBe(13);
    expect(m.placements[0].playerId).toBeDefined();

    expect(m.placements[1].playerName).toBe('Bob');
    expect(m.placements[1].place).toBe(2);
    expect(m.placements[1].victoryPoints).toBe(8);

    expect(m.placements[2].playerName).toBe('Charlie');
    expect(m.placements[2].place).toBe(3);

    expect(m.placements[3].playerName).toBe('David');
    expect(m.placements[3].place).toBe(4);

    const tiePlacements = [
      { playerName: 'Bob', victoryPoints: 8 },
      { playerName: 'David', victoryPoints: 7 },
      { playerName: 'Alice', victoryPoints: 10 },
      { playerName: 'Charlie', victoryPoints: 8 }
    ];

    const m2 = await matchService.createMatch(4, tiePlacements);
    const alice = m2.placements.find(p => p.playerName === 'Alice');
    const bob = m2.placements.find(p => p.playerName === 'Bob');
    const charlie = m2.placements.find(p => p.playerName === 'Charlie');
    const david = m2.placements.find(p => p.playerName === 'David');

    expect(alice.place).toBe(1);
    expect(bob.place).toBe(2);
    expect(charlie.place).toBe(2);
    expect(david.place).toBe(4);
  });
});
