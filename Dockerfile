# Use a glibc-based image for compatibility with pip wheels
FROM python:3.10-slim

WORKDIR /app

# Install SQLite (if needed by your app)
RUN apt-get update && apt-get install -y sqlite3

# Copy and install requirements
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy your application code
COPY backend /app/backend

# Expose the port
EXPOSE 5000

# Start your application
CMD ["python", "/app/backend/api.py"]