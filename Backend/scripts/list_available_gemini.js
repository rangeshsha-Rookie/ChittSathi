const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env' });

async function listModels() {
  const gemKey = process.env.GOOGLE_AI_API_KEY;
  if (!gemKey) return;

  const genAI = new GoogleGenerativeAI(gemKey);

  try {
    console.log("Listing available Google AI Models...");
    // The SDK doesn't have a direct model list on the top level easily in all v0.x
    // but we can try to find them.
    // Actually, I will try 'gemini-1.5-flash-latest' and 'gemini-pro'
    
    const models = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro', 'gemini-pro'];
    
    for (const modelName of models) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("hi");
            console.log(`✅ Model ${modelName} is WORKING.`);
            break;
        } catch (e) {
            console.log(`❌ Model ${modelName} FAILED: ${e.message.substring(0, 50)}...`);
        }
    }
  } catch (error) {
    console.error("List Models Error:", error.message);
  }
}

listModels();
