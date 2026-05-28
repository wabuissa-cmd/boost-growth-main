# Boost Growth — single service: API + React UI on one URL
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --legacy-peer-deps
COPY frontend/ ./
# Same-origin API: no REACT_APP_BACKEND_URL needed in production image
RUN npm run build

FROM python:3.11-slim
WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY --from=frontend-build /app/frontend/build ./static
ENV PYTHONUNBUFFERED=1
CMD uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}
