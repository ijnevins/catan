require('dotenv').config();

module.exports = {
  COSMOS_ENDPOINT: process.env.COSMOS_ENDPOINT || '',
  COSMOS_KEY: process.env.COSMOS_KEY || '',
  DATABASE_NAME: process.env.DATABASE_NAME || 'CatanDatabase',
  CONTAINER_NAME: process.env.CONTAINER_NAME || 'CatanContainer',
  USE_MOCK: process.env.DB_MOCK === 'true' || !process.env.COSMOS_ENDPOINT
};
