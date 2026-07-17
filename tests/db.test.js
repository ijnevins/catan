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
