const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config({ path: '.env' });

async function test() {
  const pcKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX_NAME;
  
  const pc = new Pinecone({ apiKey: pcKey });
  const index = pc.index(indexName);
  
  try {
    const record = {
      id: "test_1",
      values: Array(3072).fill(0.1),
      metadata: { text: "test" }
    };
    console.log("Upserting with object {records: [record]}...");
    await index.upsert({ records: [record] });
    console.log("Object upsert successful");
  } catch (err) {
    console.error("Array upsert failed:", err.message);
  }
}

test();
