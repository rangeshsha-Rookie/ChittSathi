# ChittSaathi Setup Guide

## Prerequisites

- Node.js 16+
- Python 3.10 to 3.13 (TensorFlow 2.21.0 compatible)
- MongoDB (local or Atlas)

## 1. Clone Repository

```bash
git clone https://github.com/Saurabhtbj1201/ChittSaathi/.git
cd ChittSaathi-Digital-Mental-Health-Support-Platform-main
```

## 2. Backend Setup

```bash
cd Backend
npm install
copy .env.example .env
npm run dev
```

Backend default URL: `http://localhost:5001`

## 3. ML Service Setup

```bash
cd Backend/MoodModel
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python mood.py
```

ML service default URL: `http://127.0.0.1:5000/predict_emotion`

## 4. Frontend Setup

```bash
cd Frontend
copy .env.example .env
```

Then serve `Frontend` with one of these options:

- VS Code Live Server (recommended for this project)
- Any static server (for example `npx serve .` inside `Frontend`)

## 5. Quick Run Order

1. Start MongoDB.
2. Start backend (`Backend`, port 5001).
3. Start ML service (`Backend/MoodModel`, port 5000).
4. Open frontend from `Frontend/index.html` (or via Live Server).

<!-- Updated: Production deployment completed April 10 2026 -->
