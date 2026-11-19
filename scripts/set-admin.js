// Foydalanish: GOOGLE_APPLICATION_CREDENTIALS=key.json node scripts/set-admin.js foydalanuvchi@email.com
// (firebase-admin o‘rnatilgan bo‘lishi kerak: cd functions && npm i)
const admin = require('../functions/node_modules/firebase-admin');
admin.initializeApp();
(async () => {
  const email = process.argv[2];
  if (!email) { console.error('Email kiriting'); process.exit(1); }
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  console.log(`${email} endi administrator. Qayta kirish (logout/login) kerak.`);
})();
