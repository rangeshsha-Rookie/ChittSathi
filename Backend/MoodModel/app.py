from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from transformers import pipeline
from PIL import Image
import io
import torch

app = FastAPI(title="ChittSaathi Mood Prediction Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load pretrained ViT model once at startup
# trpakov/vit-face-expression trained on FER+ — ~85% real-world accuracy
print("INFO: Loading pretrained ViT emotion model...")
try:
    emotion_pipe = pipeline(
        "image-classification",
        model="trpakov/vit-face-expression",
        device=0 if torch.cuda.is_available() else -1
    )
    print("INFO: Model loaded successfully")
except Exception as e:
    print(f"ERROR: Failed to load model: {e}")
    emotion_pipe = None

# Label map — matches mood.js moodEmojis keys exactly
LABEL_MAP = {
    "angry":    {"label": "Angry",    "value": 0},
    "disgust":  {"label": "Disgust",  "value": 1},
    "fear":     {"label": "Fear",     "value": 2},
    "happy":    {"label": "Happy",    "value": 3},
    "neutral":  {"label": "Neutral",  "value": 4},
    "sad":      {"label": "Sad",      "value": 5},
    "surprise": {"label": "Surprise", "value": 6},
}

@app.get("/")
async def root():
    return {
        "message": "ChittSaathi Mood Prediction API is LIVE",
        "model": "trpakov/vit-face-expression",
        "status": "Online",
        "model_loaded": emotion_pipe is not None
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "model_ready": emotion_pipe is not None}

@app.post("/predict-face")
async def predict_face(image: UploadFile = File(...)):
    if emotion_pipe is None:
        return {
            "success": False,
            "error": "Model not loaded",
            "mood": 4,
            "moodLabel": "Neutral",
            "confidence": 0.0
        }

    try:
        contents = await image.read()
        img = Image.open(io.BytesIO(contents)).convert("RGB")

        # Run ViT inference
        results = emotion_pipe(img)
        top = results[0]
        raw_label = top["label"].lower()
        confidence = round(top["score"], 4)

        mapped = LABEL_MAP.get(raw_label, {"label": "Neutral", "value": 4})

        return {
            "success": True,
            "mood": mapped["value"],
            "moodLabel": mapped["label"],
            "confidence": confidence,
            "raw_label": raw_label
        }

    except Exception as e:
        print(f"ERROR in prediction: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "mood": 4,
            "moodLabel": "Neutral",
            "confidence": 0.0
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
