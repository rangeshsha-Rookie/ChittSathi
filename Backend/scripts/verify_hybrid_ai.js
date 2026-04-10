require('dotenv').config();
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testHybridAI() {
  console.log('--- 🚀 FINAL HYBRID AI DIAGNOSTICS (V3) ---\n');

  // 1. Check Google Gemini
  console.log('Checking Tier 1 (Google Gemini)...');
  const gemKey = process.env.GOOGLE_AI_API_KEY;
  if (!gemKey) {
    console.log('❌ Google Gemini Key missing!');
  } else {
    try {
      const genAI = new GoogleGenerativeAI(gemKey.trim());
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent("Say 'Gemini 2.0 OK'");
      console.log('✅ Gemini Response:', result.response.text().trim());
    } catch (err) {
      console.log('🔸 Gemini Status:', err.message.substring(0, 100), '... [Expected if quota exceeded]');
    }
  }

  // 2. Check NVIDIA Chat
  console.log('\nChecking Tier 2 (NVIDIA Chat - Llama)...');
  const nvChatKey = process.env.NVIDIA_API_KEY;
  if (!nvChatKey || nvChatKey.includes('your_nvidia')) {
    console.log('❌ NVIDIA Chat Key missing or placeholder!');
  } else {
    try {
      const openai = new OpenAI({
        apiKey: nvChatKey.trim(),
        baseURL: 'https://integrate.api.nvidia.com/v1',
      });
      // UPDATED TO THE SLUG THAT WORKED IN TRIAGE
      const completion = await openai.chat.completions.create({
        model: "meta/llama-3.1-70b-instruct",
        messages: [{ role: "user", content: "Say 'NVIDIA Chat OK'" }],
        max_tokens: 20
      });
      console.log('✅ NVIDIA Chat Response:', completion.choices[0].message.content.trim());
    } catch (err) {
      console.log('❌ NVIDIA Chat Error:', err.status, err.message);
    }
  }

  // 3. Check NVIDIA Embeddings (RAG)
  console.log('\nChecking Tier 3 (NVIDIA Embeddings - RAG)...');
  const nvEmbedKey = process.env.NVIDIA_EMBED_API_KEY || process.env.NVIDIA_API_KEY;
  if (!nvEmbedKey || nvEmbedKey.includes('your_nvidia')) {
    console.log('❌ NVIDIA Embedding Key missing!');
  } else {
    try {
      const embedder = new OpenAI({
        apiKey: nvEmbedKey.trim(),
        baseURL: 'https://integrate.api.nvidia.com/v1',
      });
      const embResult = await embedder.embeddings.create({
        input: "test query",
        model: "nvidia/nv-embedqa-e5-v5",
        input_type: "query"
      });
      console.log('✅ NVIDIA Embedding OK (Vector Length:', embResult.data[0].embedding.length, ')');
    } catch (err) {
      console.log('❌ NVIDIA Embedding Error:', err.message);
    }
  }

  console.log('\n--- 🏁 DIAGNOSTICS COMPLETE ---');
}

testHybridAI();
