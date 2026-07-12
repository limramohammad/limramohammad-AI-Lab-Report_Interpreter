#!/bin/bash

# Start the Flask Backend Server using Gunicorn on dynamic $PORT (fallback to 7860)
echo "Starting Flask App..."
gunicorn --bind 0.0.0.0:${PORT:-7860} app:app

