import crypto from 'crypto';

const CODE_TTL_MS = 15 * 60 * 1000;
export const MAX_RESET_ATTEMPTS = 5;

export function generateResetCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

export function hashResetCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

export function codeMatches(storedHash, code) {
  if (!storedHash || code === undefined || code === null) return false;
  const a = Buffer.from(String(storedHash), 'hex');
  const b = Buffer.from(hashResetCode(code), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function resetCodeExpiry() {
  return new Date(Date.now() + CODE_TTL_MS);
}

export async function sendEmail({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'Modular Resume Builder <onboarding@resend.dev>';

  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY not set — not sending. Would email ${to}\nSubject: ${subject}\n${text}`,
    );
    return { delivered: false };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('Email send failed:', res.status, detail);
    throw new Error('Failed to send email');
  }

  return { delivered: true };
}

export async function sendResetCodeEmail(to, code, purpose = 'reset') {
  const changing = purpose === 'change';
  return sendEmail({
    to,
    subject: changing ? 'Confirm your password change' : 'Your password reset code',
    text: `${changing ? 'Use this code to confirm your password change' : 'Use this code to reset your password'}:\n\n${code}\n\nThis code expires in 15 minutes. If you did not request this, you can ignore this email.`,
    html: `<p>${changing ? 'Use this code to confirm your password change' : 'Use this code to reset your password'}:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>This code expires in 15 minutes. If you did not request this, you can ignore this email.</p>`,
  });
}
