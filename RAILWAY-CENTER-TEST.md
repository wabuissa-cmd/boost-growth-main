# Center Test — Railway setup (one-time)

## 1) Push code (already done when this file is on GitHub)

Railway redeploys automatically from `main`.

## 2) MongoDB service

Project must have **two** boxes:
- `boost-growth-main` (web app)
- `MongoDB` (database)

## 3) Variables on `boost-growth-main` → Variables

| Variable | Value |
|----------|--------|
| `MONGO_URL` | `${{MongoDB.MONGO_URL}}` **or** paste from MongoDB service Variables |
| `DB_NAME` | `boostgrowth` |
| `JWT_SECRET` | any long random string |
| `ADMIN_EMAIL` | your admin email |
| `ADMIN_PASSWORD` | your admin password |
| `ADMIN_NAME` | `Admin` |

**Important:** `mongodb.railway.internal` URLs only work **inside Railway** (not on your Mac).

To link automatically: in `boost-growth-main` Variables → **Add Variable Reference** → pick **MongoDB** → `MONGO_URL`.

## 4) Deploy settings (`boost-growth-main` → Settings)

- **Builder:** Dockerfile  
- **Start Command:** empty, or `uvicorn server:app --host 0.0.0.0 --port $PORT`  
- **Root Directory:** empty (repo root)

Then **Deployments → Redeploy**.

## 5) Test URLs

- Assessment: `https://boostgrowthsa.com/center-test`
- API questions: `https://boostgrowthsa.com/api/center-test/questions`
- Admin results: `https://boostgrowthsa.com/admin/center-tests` (login required)

## 6) Verify deploy

Open: `https://boostgrowthsa.com/api/center-test/questions`  
Should return JSON with 10 English questions.
