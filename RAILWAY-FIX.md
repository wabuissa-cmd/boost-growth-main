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

## بعد Success
`https://boost-growth-main-production-7283.up.railway.app/api/` → JSON

## الدخول
admin@boostgrowthsa.com / Admin123
