# Minimal deploy: Python API + pre-built React in backend/static (no npm on Railway)
FROM python:3.11-slim
WORKDIR /app/backend

# Bump deploy rev to invalidate Docker layer cache when static assets change
ARG DEPLOY_REV=20260605-client-info-layout
RUN echo "deploy ${DEPLOY_REV}" > /dev/null

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

ENV PYTHONUNBUFFERED=1
EXPOSE 8080

CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080}"]
