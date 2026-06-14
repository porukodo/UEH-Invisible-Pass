import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { pool } from '../config/db.js';
import {
  createUser,
  findUserByEmail,
  findUserByMssv,
  markEmailVerified,
} from '../models/userModel.js';
import { createWallet } from '../models/walletModel.js';
import { createOtp, findActiveOtp, consumeOtp } from '../models/otpModel.js';
import { generateOtpCode, sendOtpEmail } from '../utils/mailer.js';
import { generateTotpSecret } from '../utils/crypto.js';
import { ApiError } from '../middleware/errorHandler.js';

const STUDENT_EMAIL_DOMAIN = '@st.ueh.edu.vn';
const OTP_TTL_MINUTES = 5;

async function issueOtp(userId, email, purpose) {
  const code = generateOtpCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  await createOtp({ userId, codeHash, purpose, expiresAt });
  await sendOtpEmail(email, code, purpose);
}

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, mssv: user.mssv, role: user.role, fullName: user.full_name },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
}

/** FR01: Registration with @st.ueh.edu.vn email + FR03: send verification OTP. */
export async function register(req, res, next) {
  try {
    const { mssv, fullName, email, password, licensePlate } = req.body;
    if (!mssv || !fullName || !email || !password) {
      throw new ApiError(400, 'Missing required fields');
    }
    if (!email.toLowerCase().endsWith(STUDENT_EMAIL_DOMAIN)) {
      throw new ApiError(400, `Email phai thuoc domain ${STUDENT_EMAIL_DOMAIN}`);
    }
    if (await findUserByEmail(email)) throw new ApiError(409, 'Email da duoc dang ky');
    if (await findUserByMssv(mssv)) throw new ApiError(409, 'MSSV da duoc dang ky');

    const passwordHash = await bcrypt.hash(password, 10);
    const totpSecret = generateTotpSecret();

    const conn = await pool.getConnection();
    let userId;
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        `INSERT INTO users (mssv, full_name, email, password_hash, role, license_plate, totp_secret)
         VALUES (?, ?, ?, ?, 'student', ?, ?)`,
        [mssv, fullName, email, passwordHash, licensePlate || null, totpSecret]
      );
      userId = result.insertId;
      await createWallet(userId, conn);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    await issueOtp(userId, email, 'email_verify');
    res.status(201).json({ message: 'Dang ky thanh cong. Vui long kiem tra email de xac thuc.' });
  } catch (err) {
    next(err);
  }
}

/** FR03: Verify the OTP sent at registration to activate the account. */
export async function verifyEmail(req, res, next) {
  try {
    const { email, code } = req.body;
    const user = await findUserByEmail(email);
    if (!user) throw new ApiError(404, 'Khong tim thay tai khoan');

    const otp = await findActiveOtp(user.id, 'email_verify');
    if (!otp) throw new ApiError(400, 'Ma OTP da het han, vui long yeu cau gui lai');

    const valid = await bcrypt.compare(code, otp.code_hash);
    if (!valid) throw new ApiError(400, 'Ma OTP khong dung');

    await consumeOtp(otp.id);
    await markEmailVerified(user.id);

    res.json({ message: 'Xac thuc email thanh cong. Ban co the dang nhap.' });
  } catch (err) {
    next(err);
  }
}

/** FR02 step 1 + FR04 step 1: validate credentials, then send a login OTP (2FA). */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await findUserByEmail(email);
    if (!user) throw new ApiError(401, 'Sai email hoac mat khau');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new ApiError(401, 'Sai email hoac mat khau');

    if (user.status !== 'active') throw new ApiError(403, 'Tai khoan da bi khoa');

    if (!user.email_verified_at) {
      throw new ApiError(403, 'Email chua duoc xac thuc');
    }

    await issueOtp(user.id, user.email, 'login');
    res.json({ message: 'Da gui ma OTP den email cua ban', email: user.email });
  } catch (err) {
    next(err);
  }
}

/** FR02 step 2 + FR04 step 2: verify login OTP and issue the JWT. */
export async function verifyLoginOtp(req, res, next) {
  try {
    const { email, code } = req.body;
    const user = await findUserByEmail(email);
    if (!user) throw new ApiError(404, 'Khong tim thay tai khoan');

    const otp = await findActiveOtp(user.id, 'login');
    if (!otp) throw new ApiError(400, 'Ma OTP da het han, vui long dang nhap lai');

    const valid = await bcrypt.compare(code, otp.code_hash);
    if (!valid) throw new ApiError(400, 'Ma OTP khong dung');

    await consumeOtp(otp.id);

    const token = signAccessToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        mssv: user.mssv,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        licensePlate: user.license_plate,
        totpSecret: user.totp_secret, // delivered once for client-side offline QR generation (FR11)
      },
    });
  } catch (err) {
    next(err);
  }
}

/** Resend OTP for either registration verification or login. */
export async function resendOtp(req, res, next) {
  try {
    const { email, purpose } = req.body;
    if (!['email_verify', 'login'].includes(purpose)) throw new ApiError(400, 'purpose khong hop le');

    const user = await findUserByEmail(email);
    if (!user) throw new ApiError(404, 'Khong tim thay tai khoan');

    await issueOtp(user.id, user.email, purpose);
    res.json({ message: 'Da gui lai ma OTP' });
  } catch (err) {
    next(err);
  }
}
