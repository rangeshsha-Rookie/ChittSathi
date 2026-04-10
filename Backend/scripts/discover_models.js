require('dotenv').config();
const { OpenAI } = require('openai');
const fetch = require('node-fetch'); // Ensure node-fetch is available or use native fetch if Node 18+

async function listModels() {
  console.log('--- 🔎 DISCOVERING AVAILABLE MODELS ---\n');

  // 1. NVIDIA LIST
  const nvKey = process.env.NVIDIA_API_KEY;
  if (nvKey) {
    try {
      console.log('Fetching NVIDIA Models...');
      const response = await fetch('https://integrate.api.nvidia.com/v1/models', {
        headers: { 'Authorization': `Bearer ${nvKey}` }
      });
      const data = await response.json();
      console.log('NVIDIA Models Found:', data.data?.slice(0, 10).map(m => m.id).join(', ') || 'None');
      const llama = data.data?.find(m => m.id.includes('llama-3.1-nemotron-70b-instruct'));
      if (llama) console.log('✅ FOUND LLAMA NIM:', llama.id);
      else console.log('❌ Llama 3.1 Nemotron 70B Instruct NOT found in your available list.');
    } catch (err) {
      console.log('NVIDIA Model List Error:', err.message);
    }
  }

  // 2. GEMINI LIST
  const gemKey = process.env.GOOGLE_AI_API_KEY;
  if (gemKey) {
    try {
      console.log('\nFetching Gemini Models...');
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${gemKey}`);
      const data = await response.json();
      const flash = data.models?.filter(m => m.name.includes('flash'));
      console.log('Gemini Flash Models Found:', flash?.map(m => m.name).join(', ') || 'None');
    } catch (err) {
      console.log('Gemini Model List Error:', err.message);
    }
  }
}

listModels();
