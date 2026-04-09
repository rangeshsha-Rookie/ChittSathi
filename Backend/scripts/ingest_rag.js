const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAI } = require('openai');
const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const fsNode = require('fs');
const natural = require('natural');
require('dotenv').config({ path: '.env' });

// Setup CLI
program
  .option('-d, --datasets <types>', 'Datasets to ingest (comma separated)')
  .parse(process.argv);

const options = program.opts();

async function chunkText(text, size = 512) {
  const tokenizer = new natural.WordTokenizer();
  const tokens = tokenizer.tokenize(text);
  const chunks = [];
  for (let i = 0; i < tokens.length; i += size) {
    chunks.push(tokens.slice(i, i + size).join(' '));
  }
  return chunks;
}

async function ingest() {
  console.log('--- Enterprise RAG Ingestion (NVIDIA NIM Upgrade) ---');
  
  const nvKey = process.env.NVIDIA_API_KEY;
  const pcKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX_NAME;

  if (!nvKey || !pcKey || pcKey === 'your_pinecone_api_key_here') {
    throw new Error('Missing NVIDIA_API_KEY or PINECONE_API_KEY in .env');
  }

  const openai = new OpenAI({
    apiKey: nvKey.trim(),
    baseURL: 'https://integrate.api.nvidia.com/v1',
  });
  const pc = new Pinecone({ apiKey: pcKey });
  
  // --- Enterprise Auto-Provisioning ---
  console.log(`[DEBUG] Checking for index: ${indexName}...`);
  const indexList = await pc.listIndexes();
  const indexExists = indexList.indexes && indexList.indexes.some(idx => idx.name === indexName);
  
  if (!indexExists) {
    console.log(`⚠️ Index "${indexName}" not found. Creating serverless index now (this takes ~30 seconds)...`);
    await pc.createIndex({
      name: indexName,
      dimension: 1024, // Required by NVIDIA nv-embedqa-e5-v5
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1'
        }
      }
    });
    console.log(`✅ Index "${indexName}" created successfully! Waiting for initialization...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  const index = pc.index(indexName);

  const dataPath = fsNode.realpathSync(path.join(__dirname, '../data/emotion.jsonl'));
  const fileStream = fsNode.createReadStream(dataPath);
  const rl = require('readline').createInterface({ input: fileStream, crlfDelay: Infinity });

  let count = 0;
  for await (const line of rl) {
    const item = JSON.parse(line);
    const chunks = await chunkText(item.text, 512);

    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      console.log(`Ingesting chunk ${i+1}/${chunks.length} for ${item.metadata.title}`);
      
      const response = await openai.embeddings.create({
        input: chunkText,
        model: "nvidia/nv-embedqa-e5-v5",
        encoding_format: "float",
        input_type: "passage",
        truncate: "NONE"
      });
      
      const embedding = response.data[0].embedding;

      if (embedding && Array.isArray(embedding)) {
        const record = {
          id: `${item.metadata.title.replace(/\s/g, '_')}_${count}_${i}`,
          values: embedding,
          metadata: { 
            text: chunkText,
            ...item.metadata,
            source: item.metadata.title,
            chunk_index: i
          }
        };

        console.log(`[DEBUG] Upserting ID: ${record.id} | Vector Size: ${record.values.length}`);
        
        try {
          await index.upsert({ records: [record] });
          console.log(`✅ Success: Ingested chunk ${i+1}`);
        } catch (pcError) {
          console.error(`❌ Pinecone Error for ID ${record.id}:`, pcError.message);
          throw pcError; // Stop and show the real error
        }
      } else {
        console.warn(`⚠️ Warning: No embedding generated for chunk ${i} of ${item.metadata.title}`);
      }
    }
    count++;
  }

  console.log('--- Enterprise Ingestion Successful ---');
}

ingest().catch(err => console.error('Ingestion Failed:', err.message));
