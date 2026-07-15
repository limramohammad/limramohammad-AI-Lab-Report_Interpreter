FROM python:3.11-slim

# Install system dependencies for OCR, PDF conversion, and curl
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    poppler-utils \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set up project workspace
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Grant execution rights to the startup script
RUN chmod +x start.sh

# Run the startup script
CMD ["./start.sh"]
