const fetch = require('node-fetch'); // Ensure node-fetch is available, or use axios
const axios = require('axios');
require('dotenv').config({ path: '.env' });

async function testNvidia() {
  const nvKey = process.env.NVIDIA_API_KEY;
  console.log("Key prefix:", nvKey ? nvKey.substring(0, 15) + "..." : "EMPTY");
  
  try {
    const { OpenAI } = require('openai');
    const openai = new OpenAI({
      apiKey: nvKey,
      baseURL: 'https://integrate.api.nvidia.com/v1',
    });

    const response = await axios.get(
      'https://integrate.api.nvidia.com/v1/models',
      {
        headers: {
          'Authorization': `Bearer ${nvKey.trim()}`
        }
      }
    );
    console.log("ALL AUTHORIZED MODELS:");
    response.data.data.forEach(m => console.log(m.id));
  } catch (error) {
    console.error("NVIDIA API Error:");
    console.error(error.message);
    if (error.response) console.error(error.response.data);
  }


}

testNvidia();
