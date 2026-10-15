import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { connectToDatabase } from '../../api-lib/db.js';
import User from '../../api-lib/models/User.js';
import {
  generateResetCode,
  hashResetCode,
  codeMatches,
  resetCodeExpiry,
  sendResetCodeEmail,
  MAX_RESET_ATTEMPTS,
} from '../../api-lib/passwordReset.js';

const SALT_ROUNDS = 10;

export default async function handler(req, res) {
  const { action } = req.query;

  if (action === 'login') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      await connectToDatabase();

      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' },
      );

      return res.json({ token, user: { id: user._id, email: user.email } });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ error: 'Login failed' });
    }
  }

  if (action === 'register') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      await connectToDatabase();

      const { email, password, name } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
      }

      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      // Seed the account's default personal info with the name given at
      // registration so new resumes already have it prefilled.
      const cleanName = typeof name === 'string' ? name.trim() : '';
      const user = await User.create({
        email: email.toLowerCase(),
        passwordHash,
        defaultPersonalInfo: { name: cleanName },
      });

      const token = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' },
      );

      return res.status(201).json({ token, user: { id: user._id, email: user.email } });
    } catch (err) {
      console.error('Registration error:', err);
      return res.status(500).json({ error: 'Registration failed' });
    }
  }

  if (action === 'forgot-password') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      await connectToDatabase();

      const { email } = req.body || {};
      if (!email) return res.status(400).json({ error: 'Email is required' });

      const user = await User.findOne({ email: String(email).toLowerCase().trim() });
      if (user) {
        const code = generateResetCode();
        user.resetCodeHash = hashResetCode(code);
        user.resetCodeExpires = resetCodeExpiry();
        user.resetCodeAttempts = 0;
        await user.save();
        try {
          await sendResetCodeEmail(user.email, code, 'reset');
        } catch (mailErr) {
          console.error('Reset email failed:', mailErr);
        }
      }

      return res.json({ success: true });
    } catch (err) {
      console.error('Forgot password error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (action === 'reset-password') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      await connectToDatabase();

      const { email, code, newPassword } = req.body || {};
      if (!email || !code || !newPassword) {
        return res.status(400).json({ error: 'Email, code, and new password are required' });
      }
      if (String(newPassword).length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
      }

      const user = await User.findOne({ email: String(email).toLowerCase().trim() });
      if (!user || !user.resetCodeHash || !user.resetCodeExpires) {
        return res.status(400).json({ error: 'Invalid or expired code' });
      }
      if (
        user.resetCodeExpires.getTime() < Date.now() ||
        (user.resetCodeAttempts || 0) >= MAX_RESET_ATTEMPTS
      ) {
        return res.status(400).json({ error: 'Invalid or expired code' });
      }
      if (!codeMatches(user.resetCodeHash, code)) {
        user.resetCodeAttempts = (user.resetCodeAttempts || 0) + 1;
        await user.save();
        return res.status(400).json({ error: 'Invalid or expired code' });
      }

      user.passwordHash = await bcrypt.hash(String(newPassword), 10);
      user.resetCodeHash = null;
      user.resetCodeExpires = null;
      user.resetCodeAttempts = 0;
      await user.save();

      return res.json({ success: true });
    } catch (err) {
      console.error('Reset password error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(404).json({ error: 'Not found' });
}
