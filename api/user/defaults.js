import { connectToDatabase } from '../../api-lib/db.js';
import User from '../../api-lib/models/User.js';
import { requireAuth } from '../../api-lib/auth.js';

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

export default async function handler(req, res) {
  try {
    const authUser = requireAuth(req, res);
    if (!authUser) return;

    if (req.method !== 'GET' && req.method !== 'PUT') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    await connectToDatabase();

    const user = await User.findOne({ email: authUser.email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (req.method === 'GET') {
      return res.json(sanitize(user.defaultPersonalInfo || {}));
    }

    // PUT — save/replace the defaults
    const defaults = sanitize(req.body);
    user.defaultPersonalInfo = defaults;
    await user.save();
    return res.json(defaults);
  } catch (err) {
    console.error('Default personal info handler error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
