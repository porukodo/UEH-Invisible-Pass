import bcrypt from 'bcryptjs';
import { pool } from './config/db.js';
import { generateTotpSecret } from './utils/crypto.js';
import { createUser, findUserByEmail } from './models/userModel.js';
import { createWallet, applyLedgerEntry } from './models/walletModel.js';

const DEMO_PASSWORD = '123456';

const DEMO_USERS = [
  {
    mssv: '31221012345',
    fullName: 'Nguyen Van Sinh Vien',
    email: 'svdemo@st.ueh.edu.vn',
    role: 'student',
    licensePlate: '59-X1 123.45',
    topupBalance: 100000,
  },
  {
    mssv: 'STAFF001',
    fullName: 'Tran Thi Nhan Vien',
    email: 'staffdemo@st.ueh.edu.vn',
    role: 'staff',
    licensePlate: null,
    topupBalance: 0,
  },
  {
    mssv: 'ADMIN001',
    fullName: 'Le Van Quan Tri',
    email: 'admindemo@st.ueh.edu.vn',
    role: 'admin',
    licensePlate: null,
    topupBalance: 0,
  },
];

async function seed() {
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
