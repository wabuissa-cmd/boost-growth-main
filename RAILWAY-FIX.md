# إصلاح فوري — Railway

## المشكلة
Deploy يفشل → Railway يبقي النسخة القديمة (Emergent) → صفحة بيضاء.

## 3 خطوات فقط

### 1) Settings → Root Directory
**احذفي** `frontend` — خليها **فاضية**.

### 2) Settings → Build
- **Builder = Nixpacks** (مو Dockerfile)
- إذا في خيار Dockerfile → **عطّليه**

### 3) Deployments → Redeploy

---

## بعد النجاح
افتحي: `https://boost-growth-main-production-7283.up.railway.app/api/`

لازم JSON:
```json
{"message":"Boost Growth Portal API","status":"ok"}
```

**مو** HTML ولا Emergent badge.

---

## الدخول
- Admin / Supervisor
- Email = `ADMIN_EMAIL`
- Password = `ADMIN_PASSWORD`

---

## Variables
- احذفي `REACT_APP_BACKEND_URL`
- `MONGO_URL` بباسوورد Atlas صحيح
