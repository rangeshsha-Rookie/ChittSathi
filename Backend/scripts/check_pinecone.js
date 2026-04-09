const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config({ path: '.env' });

async function checkIndexes() {
  try {
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    console.log('--- Checking Pinecone Indexes ---');
    
    // Check existing indexes
    const indexes = await pc.listIndexes();
    console.log("Existing Indexes on your account:");
    if (indexes && indexes.indexes && indexes.indexes.length > 0) {
      indexes.indexes.forEach(idx => {
        console.log(`- Name: ${idx.name} | Dimension: ${idx.dimension} | Region: ${idx.spec.serverless ? idx.spec.serverless.region : idx.spec.pod.environment}`);
      });
    } else {
      console.log("None! (Your Pinecone account has 0 indexes right now).");
    }
    
  } catch (err) {
    console.error("Failed to connect to Pinecone:", err.message);
  }
}

checkIndexes();
