#!/usr/bin/env bash
# Fallback build when not using Docker (Railway Nixpacks)
set -euo pipefail
pip install -r backend/requirements.txt
cd frontend
npm install --legacy-peer-deps
npm run build
rm -rf ../backend/static
cp -r build ../backend/static
