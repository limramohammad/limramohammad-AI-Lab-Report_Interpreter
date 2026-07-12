#!/bin/bash

# Start the Flask Backend Server using Gunicorn on port 7860
echo "Starting Flask App..."
gunicorn --bind 0.0.0.0:7860 app:app

