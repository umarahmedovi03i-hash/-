# TestMaktab 2.0

Firebase (Auth, Firestore, Storage, Functions, Hosting) asosidagi o‘quv-o‘yin platformasi. Frontend — build talab qilmaydigan ES modullar.

## Ishga tushirish

1. **Firebase loyihasi**: Console'da loyiha oching, Authentication → Email/Password yoqing, Firestore, Storage va Functions (Blaze reja) yarating.
2. `public/js/firebase.js` ichidagi `firebaseConfig` ni to‘ldiring.
3. Qoidalar va hosting: `firebase deploy --only firestore:rules,storage,hosting`
4. **AI** (kalit faqat serverda):
   ```
   cd functions && npm install
   firebase functions:secrets:set AI_API_KEY
   # ixtiyoriy: functions/.env  ->  AI_PROVIDER=gemini|openai|anthropic   AI_MODEL=...
   firebase deploy --only functions
   ```
   Yangi provayder qo‘shish: `functions/providers.js` dagi `PROVIDERS` ga bitta funksiya qo‘shing.
5. **Admin tayinlash**: `GOOGLE_APPLICATION_CREDENTIALS=key.json node scripts/set-admin.js admin@email.com`, so‘ng hisobdan chiqib qayta kiring.
6. **Sertifikatda profil rasmi** (PDF ichiga rasm chizish uchun) Storage'ga CORS kerak:
   `gsutil cors set cors.json gs://<bucket>` — `[{"origin":["*"],"method":["GET"],"maxAgeSeconds":3600}]`. Sozlanmasa, rasm o‘rniga bosh harf/qahramon chiziladi.

Testlar (Firebase'siz): `node test/run.mjs`

## Ma’lumotlar tuzilmasi

| Kolleksiya | Mazmuni | Yozish huquqi |
|---|---|---|
| `Profiles/{uid}` | ism, sinf, rasm, XP, daraja, medallar, yutuqlar (email yo‘q) | egasi |
| `Avatars`, `Achievements` | admin boshqaradigan ro‘yxatlar (standartlari kodda) | admin |
| `Music/{id}` | nom, Storage url/path, litsenziya tasdig‘i | admin |
| `Certificates/{id}` | har bir test natijasi | egasi (yaratish) |
| `Leaderboards/{board}/entries/{uid}` | faqat ism, rasm, sinf, ball. board: `all`, `week_YYYY-Www`, `month_YYYY-MM`, `subject_<id>` | egasi |
| `AIGeneratedTests/{id}` | `draft` → admin tahrirlab `approved` qiladi | yaratish: faqat Function |
| `Settings/global` | medal chegaralari, standart musiqa rejimi | admin |

Storage: `avatars/{uid}/*` (rasm ≤2 MB, jpg/png/webp), `music/*` (audio ≤15 MB, faqat admin).

## Cheklovlar (ochiq aytilishi kerak)

- **Ball hisobi mijoz tomonida.** Qoidalar bir martalik o‘sishni cheklaydi (XP ≤2000, reyting ≤1000), lekin qasddan firibgarlikni to‘liq to‘xtata olmaydi. Jiddiy raqobat uchun natijani Cloud Function'da tekshirib yozing; savollardagi to‘g‘ri javoblar ham hozir mijozga yuboriladi.
- Reyting haftalik/oylik taxtalari UTC bo‘yicha; “fan bo‘yicha” taxta barcha davr uchun.
- Ichki fon musiqalari WebAudio bilan sintez qilingan (mualliflik huquqi muammosi yo‘q). Yuklanadigan fayllar uchun admin huquqini tasdiqlaydi.
