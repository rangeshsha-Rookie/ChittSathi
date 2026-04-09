const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env' });

async function list() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  
  try {
    console.log('--- Fetching All Supported Models ---');
    // Using the internal client to list models
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    
    if (data.models) {
      data.models.forEach(m => {
        if (m.supportedGenerationMethods.includes('embedContent')) {
          console.log(`✅ FOUND EMBEDDING MODEL: ${m.name}`);
        }
        if (m.supportedGenerationMethods.includes('generateContent')) {
          console.log(`✅ FOUND TEXT MODEL: ${m.name}`);
        }
      });
    } else {
      console.log('No models found. Response:', JSON.stringify(data));
    }
  } catch (err) {
    console.error('Fetch Failed:', err.message);
  }
}

list();
