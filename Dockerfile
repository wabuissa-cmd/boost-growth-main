# Boost Growth — Docker build (optional; Railway uses nixpacks.toml by default)
FROM node:18-bookworm-slim AS frontend-build
WORKDIR /app/frontend
ENV CI=true
ENV GENERATE_SOURCEMAP=false
ENV NODE_OPTIONS=--max-old-space-size=2048
COPY frontend/package.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim-bookworm
WORKDIR /app/backend
ENV PYTHONUNBUFFERED=1
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY --from=frontend-build /app/frontend/build ./static
CMD uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}
