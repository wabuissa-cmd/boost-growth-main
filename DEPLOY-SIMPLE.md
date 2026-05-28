# نشر Boost Growth على Railway (طريقة مبسّطة — خدمة واحدة)

## الفكرة
موقع واحد + API على **نفس الرابط**. لا تحتاجين خدمتين ولا `REACT_APP_BACKEND_URL`.

---

## الخطوات (حوالي 10 دقائق)

### 1) ارفعي الكود إلى GitHub
من Cursor أو Terminal:
```bash
git add .
git commit -m "Single-service Railway deploy"
git push origin main
```

### 2) Railway — مشروع جديد
1. [railway.app](https://railway.app) → **New Project**
2. **Deploy from GitHub** → اختاري `boost-growth-main`
3. **احذفي** أي خدمة Frontend ثانية إن وُجدت (نبقي خدمة واحدة فقط + MongoDB)

### 3) MongoDB
- **+ New** → **Database** → **MongoDB**
- من MongoDB → **Connect** → انسخي `MONGO_URL`

### 4) متغيرات الخدمة الرئيسية (نفس خدمة GitHub)
افتحي الخدمة (ليست MongoDB) → **Variables**:

| المتغير | مثال |
|---------|------|
| `MONGO_URL` | من خطوة MongoDB |
| `DB_NAME` | `boostgrowth` |
| `JWT_SECRET` | أي نص طويل عشوائي |
| `ADMIN_EMAIL` | `walaa@boostgrowthsa.com` |
| `ADMIN_PASSWORD` | الباسوورد اللي تبغينه |
| `ADMIN_NAME` | `Admin` |

**تغيير الباسوورد:** عدّلي `ADMIN_PASSWORD` ثم **Redeploy**.

### 5) النشر
Railway يكتشف `Dockerfile` تلقائياً ويبني كل شيء.

انتظري **Deploy → Success** ثم **Settings → Networking → Generate Domain**.

### 6) اختبار
افتحي الرابط:
- الصفحة الرئيسية = واجهة الموقع
- `https://YOUR-DOMAIN.up.railway.app/api/` = يجب JSON فيه `"status":"ok"`

### 7) الدخول
- **Admin / Supervisor**
- Email = `ADMIN_EMAIL`
- Password = `ADMIN_PASSWORD`

---

## تحديث التعديلات لاحقاً
1. `git push`
2. Railway يعيد النشر تلقائياً
3. `Cmd+Shift+R` في المتصفح

---

## محلياً (تطوير)
- Backend: `cd backend && uvicorn server:app --reload --port 8000`
- Frontend: أنشئي `frontend/.env` فيها:
  ```
  REACT_APP_BACKEND_URL=http://localhost:8000
  ```
  ثم `cd frontend && npm start`
