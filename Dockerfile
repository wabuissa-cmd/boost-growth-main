# Build React frontend, then serve from Python (Railway always gets latest UI)
FROM node:20-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install --legacy-peer-deps
COPY frontend/ ./
ENV CI=true \
    GENERATE_SOURCEMAP=false \
    DISABLE_ESLINT_PLUGIN=true \
    SKIP_PREFLIGHT_CHECK=true \
    NODE_OPTIONS=--max-old-space-size=2048
RUN npm run build

FROM python:3.11-slim
WORKDIR /app/backend

ARG DEPLOY_REV=20260625-case-summary-rtl-kv
RUN echo "deploy ${DEPLOY_REV}" > /dev/null

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend /app/frontend/build ./static

ENV PYTHONUNBUFFERED=1
EXPOSE 8080

CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080}"]
