"""
Mock Mood Detection Service - For Testing Without TensorFlow
This provides the same API as the full ML service but returns consistent demo moods
"""
from flask import Flask, request, jsonify
import random
import os

app = Flask(__name__)

# Enable CORS
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    return response

labels_dict = {0: 'Angry', 1: 'Disgust', 2: 'Fear', 3: 'Happy', 4: 'Neutral', 5: 'Sad', 6: 'Surprise'}

@app.route('/predict_emotion', methods=['POST', 'OPTIONS'])
def predict_emotion():
    """
    Mock mood detection endpoint
    Returns a random emotion from the 7 emotion categories
    """
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        print("Received prediction request")
        print("Files in request:", request.files.keys())
        
        # Check if an image file is included in the request
        if 'image' not in request.files:
            print("No 'image' field found in request")
            return jsonify({'error': 'No image provided'}), 400

        # Read the image file
        file = request.files['image']
        print(f"Received file: {file.filename}, content type: {file.content_type}")
        
        if file.filename == '':
            print("Empty filename")
            return jsonify({'error': 'No image file selected'}), 400
        
        # For mock: just save the debug image
        debug_dir = 'debug_images'
        if not os.path.exists(debug_dir):
            os.makedirs(debug_dir)
        file.seek(0)  
        file.save(os.path.join(debug_dir, 'latest_capture.jpg'))
        
        # Return a random emotion (for testing/demo purposes)
        random_label = random.randint(0, 6)
        emotion = labels_dict[random_label]
        
        print(f"Returned mock emotion: {emotion} (label: {random_label})")
        return jsonify({'mood': random_label, 'moodLabel': emotion})

    except Exception as e:
        print(f"Error in predict_emotion: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'running', 'service': 'mood-detection-mock'}), 200

if __name__ == '__main__':
    print("Starting Mock Mood Detection Service on http://0.0.0.0:5000")
    print("Endpoint: POST /predict_emotion")
    print("Mode: MOCK (returns random emotions for testing)")
    app.run(host='0.0.0.0', port=5000, debug=False)
