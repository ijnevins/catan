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
      let filtered = [...mockDbData];
      const params = querySpec.parameters || [];

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
