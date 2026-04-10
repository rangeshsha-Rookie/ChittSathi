const { OpenAI } = require('openai');
require('dotenv').config({ path: '.env' });

async function testCompletion() {
  const nvKey = process.env.NVIDIA_API_KEY;
  console.log("Using Key:", nvKey ? "FOUND" : "MISSING");
  
  const openai = new OpenAI({
    apiKey: nvKey,
    baseURL: 'https://integrate.api.nvidia.com/v1',
  });

  try {
    console.log("Calling NVIDIA NIM (Llama 3.1 70B)...");
    const completion = await openai.chat.completions.create({
      model: "nvidia/llama-3.1-nemotron-70b-instruct",
      messages: [{ role: "user", content: "Hello, tell me a short joke." }],
      temperature: 0.5,
      max_tokens: 50,
    });
    console.log("Success! Response:", completion.choices[0].message.content);
  } catch (error) {
    console.error("Completion Error:", error.message);
    if (error.response) console.log(error.response.data);
  }
}

testCompletion();
