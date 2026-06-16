import bcrypt from 'bcryptjs';
import { pool } from './config/db.js';
import { generateTotpSecret } from './utils/crypto.js';
import { createUser, findUserByEmail } from './models/userModel.js';
import { createWallet, applyLedgerEntry } from './models/walletModel.js';

const DEMO_PASSWORD = '123456';

// No accounts are seeded by default - register real accounts through the app.
// To create accounts programmatically, add entries here (each is created with
// email already verified and the password above) and run `npm run seed`:
//   { mssv, fullName, email, role: 'student'|'staff'|'admin', licensePlate, topupBalance }
const DEMO_USERS = [
  // Admin accounts (already created in production via /api/cron/seed-admins).
  // Kept here so they can be recreated locally or in a fresh environment.
  {
    mssv: '31231024973',
    fullName: 'Nguyễn Hoàng',
    email: 'hoangnguyen.31231024973+test1@st.ueh.edu.vn',
    role: 'admin',
    topupBalance: 0,
  },
  {
    mssv: '31231024833',
    fullName: 'Huỳnh Nhật Quang',
    email: 'quanghuynh.31231024833+test1@st.ueh.edu.vn',
    role: 'admin',
    topupBalance: 0,
  },
];

async function seed() {
  if (DEMO_USERS.length === 0) {
    console.log('No accounts to seed (DEMO_USERS is empty). Add entries to src/seed.js to create accounts.');
    await pool.end();
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const demo of DEMO_USERS) {
    const existing = await findUserByEmail(demo.email);
    if (existing) {
      console.log(`Skip (exists): ${demo.email}`);
      continue;
    }

    const totpSecret = generateTotpSecret();
    const userId = await createUser({
      mssv: demo.mssv,
      fullName: demo.fullName,
      email: demo.email,
      passwordHash,
      role: demo.role,
      totpSecret,
    });

    await createWallet(userId);
    await pool.query('UPDATE users SET license_plate = ?, email_verified_at = NOW() WHERE id = ?', [
      demo.licensePlate,
      userId,
    ]);

    if (demo.topupBalance > 0) {
      await applyLedgerEntry({
        userId,
        type: 'topup',
        amount: demo.topupBalance,
        gatewayRef: `SEED${userId}${Date.now()}`,
        description: 'Seed demo balance',
      });
    }

    console.log(`Created: ${demo.email} (${demo.role}) - password: ${DEMO_PASSWORD}`);
  }

  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
