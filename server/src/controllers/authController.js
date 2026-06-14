import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { pool } from '../config/db.js';
import {
  findUserByEmail,
  findUserByMssv,
  markEmailVerified,
  updateUnverifiedUser,
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
  return code;
}

function devOtpPayload(code) {
  return env.smtp.user ? {} : { devOtp: code };
}

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, mssv: user.mssv, role: user.role, fullName: user.full_name },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
}

export async function register(req, res, next) {
  try {
    const { mssv, fullName, email, password, licensePlate } = req.body;
    if (!mssv || !fullName || !email || !password) {
      throw new ApiError(400, 'Thiếu thông tin bắt buộc');
    }
    if (!email.toLowerCase().endsWith(STUDENT_EMAIL_DOMAIN)) {
      throw new ApiError(400, `Email phải thuộc domain ${STUDENT_EMAIL_DOMAIN}`);
    }

    const existingByEmail = await findUserByEmail(email);
    const existingByMssv = await findUserByMssv(mssv);

    if (existingByEmail?.email_verified_at) throw new ApiError(409, 'Email đã được đăng ký');
    if (existingByMssv?.email_verified_at) throw new ApiError(409, 'MSSV đã được đăng ký');
    if (existingByEmail && existingByMssv && existingByEmail.id !== existingByMssv.id) {
      throw new ApiError(409, 'Email hoặc MSSV đã được sử dụng bởi tài khoản khác');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const existing = existingByEmail || existingByMssv;

    let userId;
    if (existing) {
      userId = existing.id;
      await updateUnverifiedUser(userId, { mssv, fullName, email, passwordHash, licensePlate });
    } else {
      const totpSecret = generateTotpSecret();
      const conn = await pool.getConnection();
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
    }

    const code = await issueOtp(userId, email, 'email_verify');
    res.status(201).json({
      message: 'Đăng ký thành công. Vui lòng kiểm tra email để xác thực.',
      email,
      ...devOtpPayload(code),
    });
  } catch (err) {
    next(err);
  }
}

export async function verifyEmail(req, res, next) {
  try {
    const { email, code } = req.body;
    const user = await findUserByEmail(email);
    if (!user) throw new ApiError(404, 'Không tìm thấy tài khoản');

    const otp = await findActiveOtp(user.id, 'email_verify');
    if (!otp) throw new ApiError(400, 'Mã OTP đã hết hạn, vui lòng yêu cầu gửi lại');

    const valid = await bcrypt.compare(code, otp.code_hash);
    if (!valid) throw new ApiError(400, 'Mã OTP không đúng');

    await consumeOtp(otp.id);
    await markEmailVerified(user.id);

    res.json({ message: 'Xác thực email thành công. Bạn có thể đăng nhập.' });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await findUserByEmail(email);
    if (!user) throw new ApiError(401, 'Sai email hoặc mật khẩu');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new ApiError(401, 'Sai email hoặc mật khẩu');

    if (user.status !== 'active') throw new ApiError(403, 'Tài khoản đã bị khóa');

    if (!user.email_verified_at) {
      const code = await issueOtp(user.id, user.email, 'email_verify');
      return res.status(403).json({
        error: 'Email chưa được xác thực',
        requiresVerification: true,
        email: user.email,
        ...devOtpPayload(code),
      });
    }

    const code = await issueOtp(user.id, user.email, 'login');
    res.json({ message: 'Đã gửi mã OTP đến email của bạn', email: user.email, ...devOtpPayload(code) });
  } catch (err) {
    next(err);
  }
}

export async function verifyLoginOtp(req, res, next) {
  try {
    const { email, code } = req.body;
    const user = await findUserByEmail(email);
    if (!user) throw new ApiError(404, 'Không tìm thấy tài khoản');

    const otp = await findActiveOtp(user.id, 'login');
    if (!otp) throw new ApiError(400, 'Mã OTP đã hết hạn, vui lòng đăng nhập lại');

    const valid = await bcrypt.compare(code, otp.code_hash);
    if (!valid) throw new ApiError(400, 'Mã OTP không đúng');

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
        totpSecret: user.totp_secret,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function resendOtp(req, res, next) {
  try {
    const { email, purpose } = req.body;
    if (!['email_verify', 'login'].includes(purpose)) throw new ApiError(400, 'purpose không hợp lệ');

    const user = await findUserByEmail(email);
    if (!user) throw new ApiError(404, 'Không tìm thấy tài khoản');

    const code = await issueOtp(user.id, user.email, purpose);
    res.json({ message: 'Đã gửi lại mã OTP', ...devOtpPayload(code) });
  } catch (err) {
    next(err);
  }
}
