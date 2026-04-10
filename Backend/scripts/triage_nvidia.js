require('dotenv').config();
const { OpenAI } = require('openai');

async function testNvidiaModels() {
  const nvKey = process.env.NVIDIA_API_KEY;
  const modelsToTry = [
    "nvidia/llama-3.1-nemotron-70b-instruct",
    "meta/llama-3.1-70b-instruct",
    "meta/llama3-70b-instruct",
    "mistralai/mixtral-8x7b-instruct-v0.1"
  ];

  console.log('--- 🧪 TESTING NVIDIA CHAT MODELS ---\n');

  for (const modelId of modelsToTry) {
    console.log(`Testing: ${modelId}...`);
    try {
      const openai = new OpenAI({
        apiKey: nvChatKey = nvKey.trim(),
        baseURL: 'https://integrate.api.nvidia.com/v1',
      });
      const completion = await openai.chat.completions.create({
        model: modelId,
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 5
      });
      console.log(`✅ Success with ${modelId}:`, completion.choices[0].message.content.trim());
      return; // Stop if we find one that works
    } catch (err) {
      console.log(`❌ Failed ${modelId}:`, err.status, err.message);
    }
  }
}

testNvidiaModels();
