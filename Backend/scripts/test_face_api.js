const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

async function testMoodDetection() {
  console.log('--- 🤖 TESTING AI-POWERED MOOD DETECTION ---');
  
  // Create a dummy image (1x1 transparent PNG)
  const dummyImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==', 'base64');
  const tempImagePath = path.join(__dirname, 'test_dummy_image.png');
  fs.writeFileSync(tempImagePath, dummyImage);

  try {
    const mlUrl = 'https://ramesh-20-chittsaathi-ml.hf.space/predict-face';
    console.log(`📡 Connecting to Live ML Face Service: ${mlUrl}`);

    const form = new FormData();
    form.append('image', fs.createReadStream(tempImagePath), { 
      filename: 'test_dummy_image.png',
      contentType: 'image/png'
    });

    console.log('📤 Uploading test image to Model...');
    const response = await axios.post(mlUrl, form, {
      headers: form.getHeaders(),
      timeout: 15000 
    });

    console.log('✅ RESPONSE RECEIVED:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success === false && response.data.error === 'No face detected') {
        console.log('🎉 SUCCESS: The API is active and successfully analyzed the image! (It correctly identified that there was no face in our 1x1 pixel test image).');
    }

  } catch (error) {
    if (error.response) {
      console.log('❌ API Error Response:', error.response.status, error.response.data);
    } else {
      console.log('❌ Connection Error:', error.message);
    }
  } finally {
    // Cleanup
    if (fs.existsSync(tempImagePath)) {
      fs.unlinkSync(tempImagePath);
    }
    console.log('--- TEST COMPLETE ---');
  }
}

testMoodDetection();
