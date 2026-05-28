#!/usr/bin/env bash
set -euo pipefail
echo "==> Installing Python deps..."
python3 -m pip install --upgrade pip
python3 -m pip install -r backend/requirements.txt
echo "==> Installing frontend deps..."
cd frontend
npm install --legacy-peer-deps
echo "==> Building frontend..."
export CI=true
export GENERATE_SOURCEMAP=false
export DISABLE_ESLINT_PLUGIN=true
export TSC_COMPILE_ON_ERROR=true
export SKIP_PREFLIGHT_CHECK=true
export NODE_OPTIONS=--max-old-space-size=2048
npm run build
cd ..
echo "==> Copying build to backend/static..."
rm -rf backend/static
mkdir -p backend/static
cp -r frontend/build/* backend/static/
echo "==> Build complete."
