from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
from keras.models import load_model
import uvicorn
import os
import io

# Global variables
model = None
faceDetect = None

app = FastAPI(title="ChittSaathi Mood Prediction Service")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ROUTES FIRST ---
@app.get("/")
async def root():
    return {
        "message": "Welcome to ChittSaathi Mood Prediction API",
        "status": "Online",
        "endpoints": {
            "health": "/health",
            "predict": "/predict-face (POST)",
            "documentation": "/docs"
        }
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "cascade_loaded": faceDetect is not None
    }

# --- MODEL LOADING SECOND ---
MODEL_PATH = 'model_file_30epochs.h5'
if not os.path.exists(MODEL_PATH):
    MODEL_PATH = 'model_file.h5'

print(f"DEBUG: Loading model from {MODEL_PATH}...")
try:
    if os.path.exists(MODEL_PATH):
        model = load_model(MODEL_PATH)
        print("DEBUG: Model loaded successfully")
    else:
        print(f"DEBUG: Model file {MODEL_PATH} not found")
        model = None
except Exception as e:
    print(f"DEBUG: Failed to load model: {e}")
    model = None

CASCADE_PATH = 'haarcascade_frontalface_default.xml'
if os.path.exists(CASCADE_PATH):
    faceDetect = cv2.CascadeClassifier(CASCADE_PATH)
    print("DEBUG: Cascade loaded successfully")
else:
    print(f"DEBUG: Cascade file {CASCADE_PATH} not found")
    faceDetect = None

labels_dict = {0: 'Angry', 1: 'Disgust', 2: 'Fear', 3: 'Happy', 4: 'Neutral', 5: 'Sad', 6: 'Surprise'}

@app.post("/predict-face")
async def predict_face(image: UploadFile = File(...)):
    if model is None or faceDetect is None:
        raise HTTPException(status_code=503, detail="Model service not fully initialized")

    try:
        contents = await image.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Empty image file received (0 bytes)")
            
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            raise HTTPException(status_code=400, detail=f"Failed to decode image. Received {len(contents)} bytes. Filename: {image.filename}")

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = faceDetect.detectMultiScale(gray, 1.3, 3)

        if len(faces) == 0:
            return {"success": False, "error": "No face detected", "mood": None, "moodLabel": "Unknown"}

        x, y, w, h = faces[0]
        sub_face_img = gray[y:y+h, x:x+w]
        resized = cv2.resize(sub_face_img, (48, 48))
        normalize = resized / 255.0
        reshaped = np.reshape(normalize, (1, 48, 48, 1))
        
        result = model.predict(reshaped)
        label = int(np.argmax(result, axis=1)[0])
        emotion = labels_dict.get(label, "Unknown")

        return {
            "success": True,
            "mood": label,
            "moodLabel": emotion,
            "confidence": float(np.max(result))
        }

    except Exception as e:
        print(f"Error in prediction: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
