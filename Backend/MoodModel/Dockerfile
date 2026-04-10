# Use Python 3.9 as base
FROM python:3.9-slim

# Set working directory
WORKDIR /code

# Install system dependencies for OpenCV and TensorFlow
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy everything else
COPY . .

# Hugging Face Spaces run on port 7860 by default
EXPOSE 7860

# Run the app
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
