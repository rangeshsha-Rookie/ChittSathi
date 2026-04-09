const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env' });

async function list() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  
  try {
    // We'll use the basic fetch/list method if available or just try a few common ones
    console.log('--- Checking Available Models ---');
    console.log('Key:', apiKey.substring(0, 10) + '...');
    
    // In newer SDKs, listModels isn't always directly exposed on genAI
    // But we can try to "peek" by attempting a small embedding on several types
    const types = ["embedding-001", "text-embedding-004", "models/embedding-001", "models/text-embedding-004"];
    
    for (const t of types) {
      try {
        const model = genAI.getGenerativeModel({ model: t });
        await model.embedContent("test");
        console.log(`✅ SUCCESS: Model "${t}" is working!`);
      } catch (e) {
        console.log(`❌ FAILED: Model "${t}" -> ${e.message.split('\n')[0]}`);
      }
    }
  } catch (err) {
    console.error('List Failed:', err.message);
  }
}

list();
