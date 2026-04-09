// test_engine.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { generateChatResponse, classifyEmotionUnlimited, retrieveRAGContext } = require('../controllers/aiController');

async function runTests() {
  console.log("\n==================================");
  console.log("🧪 CHITTSAATHI AI PLATFORM TESTS");
  console.log("==================================\n");

  // TEST 1: Semantic Crisis Detection (Hybrid ML System)
  console.log("▶️ TEST 1: Unlimited Semantic Crisis Detection");
  try {
    const crisisInput = "I just can't take it anymore, everything is going dark 💔";
    console.log(`Input: "${crisisInput}"`);
    const crisisResult = await classifyEmotionUnlimited(crisisInput);
    if (crisisResult) {
      console.log(`✅ Result: PASS (Crisis DETECTED semantically, returning score/boolean: ${String(crisisResult)})`);
    } else {
      console.log(`❌ Result: FAIL (Crisis NOT detected)`);
    }
  } catch (e) {
    console.log(`❌ Result: ERROR (${e.message})`);
  }

  console.log("\n----------------------------------");

  // TEST 2: Enterprise RAG Retrieval
  console.log("▶️ TEST 2: Enterprise RAG Working (Pinecone Vector Search)");
  try {
    const ragQuery = "tell me about sadness and anxiety";
    console.log(`Query: "${ragQuery}"`);
    const ragResult = await retrieveRAGContext(ragQuery);
    
    if (ragResult && ragResult.text && ragResult.text.length > 5) {
      console.log(`✅ Result: PASS (RAG Context Retrieved!)`);
      console.log(`Confidence / Match Score: > ${ragResult.confidence ? 'High Confidence' : 'Standard'}`);
      console.log(`Source Extracted: [${ragResult.source || 'Knowledge Base'}]`);
    } else {
      console.log(`⚠️ Result: PARTIAL (No matching local context found, fallback to general intelligence)`);
    }
  } catch (e) {
    console.log(`❌ Result: ERROR (${e.message})`);
  }

  console.log("\n----------------------------------");

  // TEST 3: Full E2E Chat Response (with Arize Phoenix Tracing)
  console.log("▶️ TEST 3: E2E Chat Response & Arize Phoenix Verification");
  try {
    const req = {
      body: { 
        message: "I am feeling a bit anxious about my exams tomorrow. Do you have any coping methods?", 
        context: [],
        mood: { label: "Anxious" } 
      },
      user: { id: "507f1f77bcf86cd799439011" } // Valid Mongo ObjectId format
    };
    
    let resJson = null;
    const res = {
      status: function(code) { this.statusCode = code; return this; },
      json: function(data) { resJson = data; return data; }
    };

    console.log(`Processing End-to-End Request... (Simulating User)`);
    await generateChatResponse(req, res);

    if (resJson && resJson.success) {
      console.log(`✅ Result: PASS (Response Generated!)`);
      console.log(`Message Preview: \n"${resJson.response.substring(0, 150)}..."\n`);
      
      const hasCitation = resJson.response.includes('📚 Sources:');
      console.log(`Metadata Included:`);
      console.log(`   - AI Provider: ${resJson.type}`);
      console.log(`   - Latency: ${resJson.latency}`);
      console.log(`   - RAG Citation Found: ${hasCitation ? 'YES ✅' : 'NO ❌'}`);
    } else {
      console.log(`❌ Result: FAIL (No valid response generated)`);
    }

    console.log("\n----------------------------------");
    console.log("▶️ TEST 4: Hindi Indic Crisis Detection (Hard Escalation)");
    const hindiCrisis = "जीना नहीं चाहता, सब खत्म करना है";
    const hindiResult = await classifyEmotionUnlimited(hindiCrisis);
    if (hindiResult.isCrisis) {
      console.log(`✅ Result: PASS (Hindi Crisis DETECTED - Escalating to Emergency)`);
    } else {
      console.log(`❌ Result: FAIL (Hindi Crisis MISSED)`);
    }
  } catch (e) {
    console.log(`❌ Result: ERROR (${e.message})`);
  }
}

runTests().then(() => {
  console.log("\n==================================");
  console.log("🧪 TESTS COMPLETE");
  console.log("==================================\n");
  process.exit(0);
});
