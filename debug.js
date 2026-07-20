const db = require('./src/db');
require('dotenv').config();

async function debug() {
  await db.init();
  const matches = await db.queryItems({
    query: "SELECT * FROM c WHERE c.partitionKey = 'MATCH' AND c.type = 'match' AND c.division = 4"
  });
  matches.sort((a,b) => new Date(a.playedAt) - new Date(b.playedAt));
  console.log('Total matches: ' + matches.length);
  matches.forEach(m => {
    console.log(`${m.playedAt} | Chal: ${m.crownChallenged} | Def: ${m.crownDefended} | Int: ${m.interimUpdated} | Name: ${m.placements[0]?.playerName}`);
  });
}

debug().catch(console.error);
