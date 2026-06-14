import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

export function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

export async function sendOtpEmail(to, code, purpose) {
  const subject =
    purpose === 'email_verify'
      ? 'UEH Invisible Pass - Xac thuc email'
      : 'UEH Invisible Pass - Ma xac thuc dang nhap';

  const html = `
    <p>Ma OTP cua ban la:</p>
    <h2 style="letter-spacing:4px">${code}</h2>
    <p>Ma co hieu luc trong 5 phut. Vui long khong chia se ma nay voi bat ky ai.</p>
  `;

  if (!env.smtp.user) {
    // No SMTP configured (e.g. local dev) - log instead of sending.
    console.log(`[mailer] OTP for ${to} (${purpose}): ${code}`);
    return;
  }

  await getTransporter().sendMail({
    from: env.smtp.from,
    to,
    subject,
    html,
  });
}
