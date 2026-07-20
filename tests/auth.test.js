const db = require('../src/db');
const userService = require('../src/services/userService');
const playerService = require('../src/services/playerService');
const path = require('path');
const fs = require('fs');

describe('User Authentication & Customization Service', () => {
  let player1;
  let player2;

  beforeAll(async () => {
    process.env.DB_MOCK = 'true';
    await db.init();

    // Create a couple of players for testing linkages
    player1 = await playerService.createPlayer('Charlie');
    player2 = await playerService.createPlayer('Dana');
  });

  afterAll(() => {
    const mockPath = path.join(__dirname, '../data/db.json');
    if (fs.existsSync(mockPath)) {
      fs.unlinkSync(mockPath);
    }
  });

  test('should register user and link to existing player', async () => {
    const user = await userService.createUser('charlie_user', 'password123', player1.id, null);
    
    expect(user.username).toBe('charlie_user');
    expect(user.playerId).toBe(player1.id);
    expect(user.tilePreference).toBe('wheat');
    expect(user.passwordHash).not.toBe('password123'); // must be hashed

    // Verify player link updated in database
    const updatedPlayer = await db.readItem(player1.id, 'PLAYER');
    expect(updatedPlayer.userId).toBe(user.id);
    expect(updatedPlayer.tilePreference).toBe('wheat');
  });

  test('should reject duplicate usernames', async () => {
    await expect(
      userService.createUser('charlie_user', 'newpassword', player2.id, null)
    ).rejects.toThrow('Username "charlie_user" is already taken');
  });

  test('should reject linking to already claimed players', async () => {
    await expect(
      userService.createUser('new_user', 'password123', player1.id, null)
    ).rejects.toThrow('Selected player is already linked to another account');
  });

  test('should create user and link to newly created player name', async () => {
    const user = await userService.createUser('elena_user', 'securepass', null, 'Elena');
    
    expect(user.username).toBe('elena_user');
    expect(user.playerId).toBeDefined();

    // Verify new player created
    const newPlayer = await db.readItem(user.playerId, 'PLAYER');
    expect(newPlayer.name).toBe('Elena');
    expect(newPlayer.userId).toBe(user.id);
  });

  test('should successfully authenticate user with correct credentials', async () => {
    const user = await userService.authenticateUser('charlie_user', 'password123');
    expect(user).not.toBeNull();
    expect(user.username).toBe('charlie_user');

    const failedUser = await userService.authenticateUser('charlie_user', 'wrongpassword');
    expect(failedUser).toBeNull();
  });

  test('should update user tile preference and sync to linked player', async () => {
    const user = await userService.getUserByUsername('charlie_user');
    const updatedUser = await userService.updateTilePreference(user.id, 'clay');
    
    expect(updatedUser.tilePreference).toBe('clay');

    const updatedPlayer = await db.readItem(player1.id, 'PLAYER');
    expect(updatedPlayer.tilePreference).toBe('clay');
  });

  test('should reject invalid tile preferences', async () => {
    const user = await userService.getUserByUsername('charlie_user');
    await expect(
      userService.updateTilePreference(user.id, 'invalid_resource')
    ).rejects.toThrow('Invalid tile preference style: invalid_resource');
  });
});
