import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import {
  generateResetCode,
  hashResetCode,
  codeMatches,
  resetCodeExpiry,
  sendResetCodeEmail,
  MAX_RESET_ATTEMPTS,
} from '../../api-lib/passwordReset.js';

const router = Router();
const SALT_ROUNDS = 10;

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
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

    const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(201).json({ token, user: { id: user._id, email: user.email } });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
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

    const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({ token, user: { id: user._id, email: user.email } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/forgot-password — email a reset code (always responds generically)
router.post('/forgot-password', async (req, res) => {
  try {
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

    res.json({ success: true });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/reset-password — verify the code and set a new password
router.post('/reset-password', async (req, res) => {
  try {
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

    user.passwordHash = await bcrypt.hash(String(newPassword), SALT_ROUNDS);
    user.resetCodeHash = null;
    user.resetCodeExpires = null;
    user.resetCodeAttempts = 0;
    await user.save();

    res.json({ success: true });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
