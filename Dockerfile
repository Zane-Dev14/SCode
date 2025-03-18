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
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy backend code
COPY backend /app/backend

# Initialize DB
RUN python /app/backend/init_db.py

# =========================================
# STAGE 2: Frontend (Node.js + TypeScript)
# =========================================
FROM node:20-slim AS frontend

WORKDIR /app

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

WORKDIR /app

# Copy backend + frontend artifacts
COPY --from=backend /app /app
COPY --from=frontend /app/dist /app/frontend

EXPOSE 5000 8080

# Start backend + frontend services
CMD ["bash", "-c", "python /app/backend/analyzer.py & npx serve /app/frontend -l 8080"]
