import { Router } from 'express';
import User from '../models/User.js';
import { requireAuth } from '../lib/auth.js';

const router = Router();

const FIELDS = ['name', 'email', 'phone', 'location'];

// Pick only the known personal-info fields, coerced to strings, so arbitrary
// client payloads can't pollute the stored document.
function sanitize(body) {
  const out = {};
  for (const f of FIELDS) {
    const v = body?.[f];
    out[f] = typeof v === 'string' ? v.trim() : '';
  }
  return out;
}

// GET saved default personal info for the authenticated user
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(sanitize(user.defaultPersonalInfo || {}));
  } catch (err) {
    console.error('Failed to get default personal info:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT save/replace the default personal info
router.put('/', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const defaults = sanitize(req.body);
    user.defaultPersonalInfo = defaults;
    await user.save();

    res.json(defaults);
  } catch (err) {
    console.error('Failed to save default personal info:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
