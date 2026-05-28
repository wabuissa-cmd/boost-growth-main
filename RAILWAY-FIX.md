# إصلاح Railway — صفحة بيضاء / الدخول لا يعمل

## السبب
Railway يشغّل **نسخة قديمة (Frontend فقط)** من Emergent.
لذلك `/api/` يرجع HTML → التطبيق يتعطل → **صفحة بيضاء**.

---

## خطوة واحدة مهمة في Railway (Settings)

افتحي **boost-growth-main** → **Settings**:

| الإعداد | القيمة الصحيحة |
|---------|----------------|
| **Root Directory** | **فارغ** (احذفي `frontend` إن كان مكتوب) |
| **Build Command** | اتركيه فارغ (Railway يقرأ `railway.json`) |
| **Start Command** | اتركيه فارغ أو: `cd backend && uvicorn server:app --host 0.0.0.0 --port $PORT` |
| **Builder** | **Nixpacks** (مو Dockerfile) |

ثم **Deployments → Redeploy**.

---

## Variables (تأكدي)

- `MONGO_URL` — باسوورد Atlas صحيح
- `DB_NAME` = `boostgrowth`
- `JWT_SECRET` — موجود
- `ADMIN_EMAIL` — إيميل الدخول
- `ADMIN_PASSWORD` — باسوورد الدخول
- **احذفي** `REACT_APP_BACKEND_URL`

---

## بعد نجاح Deploy

افتحي:
```
https://boost-growth-main-production-7283.up.railway.app/api/
```

**لازم** يظهر:
```json
{"message":"Boost Growth Portal API","status":"ok"}
```

إذا ظهر HTML أو صفحة بيضاء → الإعدادات أعلاه لسه غلط.

---

## الدخول

- Admin / Supervisor
- Email = `ADMIN_EMAIL`
- Password = `ADMIN_PASSWORD`

---

## مسح الكاش (إن لزم)

Chrome → F12 → Application → Clear site data  
أو نافذة خاصة Incognito.
