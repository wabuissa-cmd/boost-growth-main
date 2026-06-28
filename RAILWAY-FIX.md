# ⚠️ Railway — خطوة مهمة (سبب خطأ npx)

## الخطأ
`The executable npx could not be found`

## السبب
Railway يحاول تشغيل **npx serve** (إعداد قديم للـ Frontend فقط).
الـ Build نجح ✅ لكن Start Command غلط ❌

## الحل (30 ثانية)

1. Railway → **boost-growth-main** → **Settings**
2. ابحثي عن **Deploy** → **Start Command** (أو Custom Start Command)
3. **احذفي** أي شيء فيه `npx` أو `serve`
4. اتركيه **فارغ** أو الصقي:
   ```
   uvicorn server:app --host 0.0.0.0 --port $PORT
   ```
5. **Settings → Root Directory** = **فارغ** (مو frontend)
6. **Deployments → Redeploy**

### 7) تأكدي أن النشر اكتمل
افتحي في المتصفح:
`https://staff.boostgrowth.org/api/version`

يجب أن يظهر `build` بتاريخ **اليوم** وليس `restore-clients-salman-sync-2026-05-31`.

إذا بقي قديم → **Deployments → Redeploy** يدوياً (انظر أدناه).

---

## ⚠️ إذا git push لا يحدّث الموقع

1. [railway.app](https://railway.app) → مشروع **boost-growth-main**
2. **Deployments** — هل آخر نشر **Failed**؟ افتحي اللوج.
3. **Settings → Source** — تأكدي الربط مع `wabuissa-cmd/boost-growth-main` وفرع **main**
4. **Settings → Deploy → Start Command** — **فارغ** (لا `npx serve`)
5. **Settings → Build** — Builder = **Dockerfile**
6. اضغطي **Deploy → Redeploy** على آخر commit

بعد Success، راجعي `/api/version` ثم `Cmd+Shift+R` على الموقع.

---

## بعد Success
`https://boost-growth-main-production-7283.up.railway.app/api/` → JSON

## الدخول
admin@boostgrowthsa.com / Admin123
