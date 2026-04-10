const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env' });

async function testGemini() {
  const gemKey = process.env.GOOGLE_AI_API_KEY;
  console.log("Using Key:", gemKey ? gemKey.substring(0, 10) + "..." : "MISSING");
  
  if (!gemKey) return;

  const genAI = new GoogleGenerativeAI(gemKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    console.log("Calling Gemini 1.5 Flash...");
    const result = await model.generateContent("Hello, tell me a short joke.");
    const response = await result.response;
    console.log("Success! Response:", response.text());
  } catch (error) {
    console.error("Gemini Error:", error.message);
  }
}

testGemini();
