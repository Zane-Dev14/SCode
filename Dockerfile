# =========================================
# STAGE 1: Backend (Python 3.10 Slim)
# =========================================
FROM python:3.10-slim AS backend

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy backend code
COPY backend /app/backend

# =========================================
# STAGE 2: Frontend (Node.js + TypeScript + Three.js)
# =========================================
FROM node:20-slim AS frontend

# Set working directory
WORKDIR /app

# Install frontend dependencies
COPY package.json package-lock.json ./
RUN npm install

# Build frontend
COPY src /app/src
COPY media /app/media
COPY tsconfig.json webpack.config.js ./
RUN npm run build

# =========================================
# FINAL IMAGE: Combine Backend + Frontend
# =========================================
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies for the final image
RUN apt-get update && apt-get install -y \
    python3 \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Copy backend and frontend artifacts
COPY --from=backend /app /app
COPY --from=frontend /app/dist /app/frontend

# Expose necessary ports
EXPOSE 5000 8080

# Start backend and frontend services
CMD ["bash", "-c", "python /app/backend/analyzer.py & npx serve /app/frontend -l 8080"]
