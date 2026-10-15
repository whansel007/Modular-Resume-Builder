import bcrypt from 'bcrypt';
import { connectToDatabase } from '../../api-lib/db.js';
import User from '../../api-lib/models/User.js';
import Block from '../../api-lib/models/Block.js';
import Resume from '../../api-lib/models/Resume.js';
import { requireAuth } from '../../api-lib/auth.js';
import {
  generateResetCode,
  hashResetCode,
  codeMatches,
  resetCodeExpiry,
  sendResetCodeEmail,
  MAX_RESET_ATTEMPTS,
} from '../../api-lib/passwordReset.js';

const DEFAULT_SUGGESTIONS = ['Email', 'Phone', 'LinkedIn', 'GitHub', 'Portfolio', 'Website', 'Location', 'Twitter'];

// Sanitize personal-info fields, preserving order in fields array with a minimum length of 3.
function sanitize(body) {
  if (!body || typeof body !== 'object') {
    return {
      name: '',
      email: '',
      phone: '',
      linkedin: '',
      fields: [
        { id: 'f-email', label: 'Email', value: '' },
        { id: 'f-phone', label: 'Phone', value: '' },
        { id: 'f-linkedin', label: 'LinkedIn', value: '' },
      ],
    };
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  let fields = [];

  if (Array.isArray(body.fields)) {
    fields = body.fields
      .filter((f) => f && typeof f === 'object')
      .map((f, idx) => ({
        id: typeof f.id === 'string' && f.id ? f.id : `f-${idx + 1}-${Date.now()}`,
        label: typeof f.label === 'string' && f.label.trim() ? f.label.trim() : `Field ${idx + 1}`,
        value: typeof f.value === 'string' ? f.value.trim() : '',
      }));
  } else {
    const thirdVal = typeof body.linkedin === 'string' && body.linkedin ? body.linkedin.trim() : (typeof body.location === 'string' && body.location ? body.location.trim() : '');
    const thirdLabel = typeof body.linkedin === 'string' && body.linkedin ? 'LinkedIn' : (typeof body.location === 'string' && body.location ? 'Location' : 'LinkedIn');
    fields = [
      { id: 'f-email', label: 'Email', value: typeof body.email === 'string' ? body.email.trim() : '' },
      { id: 'f-phone', label: 'Phone', value: typeof body.phone === 'string' ? body.phone.trim() : '' },
      { id: 'f-linkedin', label: thirdLabel, value: thirdVal },
    ];
  }

  // Ensure minimum length of 3
  while (fields.length < 3) {
    const existing = new Set(fields.map((f) => f.label.toLowerCase()));
    const nextLabel =
      DEFAULT_SUGGESTIONS.find((l) => !existing.has(l.toLowerCase())) || `Field ${fields.length + 1}`;
    fields.push({
      id: `f-${fields.length + 1}-${Date.now()}`,
      label: nextLabel,
      value: '',
    });
  }

  const email = fields.find((f) => f.label.toLowerCase() === 'email')?.value || fields[0]?.value || '';
  const phone = fields.find((f) => f.label.toLowerCase() === 'phone')?.value || fields[1]?.value || '';
  const linkedin =
    fields.find((f) => f.label.toLowerCase() === 'linkedin')?.value || fields[2]?.value || '';

  return {
    name,
    email,
    phone,
    linkedin,
    fields,
  };
}

export default async function handler(req, res) {
  const { action } = req.query;

  if (action === 'defaults') {
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
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (action === 'tags') {
    try {
      const user = requireAuth(req, res);
      if (!user) return;

      await connectToDatabase();

      const dbUser = await User.findOne({ email: user.email });
      if (!dbUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (req.method === 'GET') {
        // Return tags as a plain object
        const tagsObj = {};
        if (dbUser.tags) {
          for (const [key, value] of dbUser.tags.entries()) {
            tagsObj[key] = value;
          }
        }
        return res.json(tagsObj);
      }

      if (req.method === 'POST') {
        const { id, name } = req.body;
        if (!id || !name) {
          return res.status(400).json({ error: 'Missing id or name' });
        }
        dbUser.tags.set(id, name);
        await dbUser.save();
        return res.status(201).json({ id, name });
      }

      if (req.method === 'PUT') {
        const { id, name } = req.body;
        if (!id || !name) {
          return res.status(400).json({ error: 'Missing id or name' });
        }
        if (!dbUser.tags.has(id)) {
          return res.status(404).json({ error: 'Tag not found' });
        }
        dbUser.tags.set(id, name);
        await dbUser.save();
        return res.json({ id, name });
      }

      if (req.method === 'DELETE') {
        const { id } = req.query;
        if (!id) {
          return res.status(400).json({ error: 'Missing id query parameter' });
        }
        dbUser.tags.delete(id);
        await dbUser.save();
        return res.json({ success: true, id });
      }

      return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
      console.error('Tags handler error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (action === 'password') {
    try {
      const authUser = requireAuth(req, res);
      if (!authUser) return;

      await connectToDatabase();

      const user = await User.findOne({ email: authUser.email });
      if (!user) return res.status(404).json({ error: 'User not found' });

      // POST — email a confirmation code to the account owner.
      if (req.method === 'POST') {
        const code = generateResetCode();
        user.resetCodeHash = hashResetCode(code);
        user.resetCodeExpires = resetCodeExpiry();
        user.resetCodeAttempts = 0;
        await user.save();
        try {
          await sendResetCodeEmail(user.email, code, 'change');
        } catch (mailErr) {
          console.error('Change-password email failed:', mailErr);
          return res.status(500).json({ error: 'Failed to send confirmation email' });
        }
        return res.json({ success: true });
      }

      // PUT — confirm with the emailed code and set the new password.
      if (req.method === 'PUT') {
        const { code, newPassword } = req.body || {};
        if (!code || !newPassword) {
          return res.status(400).json({ error: 'Code and new password are required' });
        }
        if (String(newPassword).length < 8) {
          return res.status(400).json({ error: 'New password must be at least 8 characters long' });
        }
        if (
          !user.resetCodeHash ||
          !user.resetCodeExpires ||
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
      }

      return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
      console.error('Change password handler error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (action === 'account') {
    try {
      const authUser = requireAuth(req, res);
      if (!authUser) return;

      if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      await connectToDatabase();

      const password = (req.body && req.body.password) || req.query.password;
      const user = await User.findOne({ email: authUser.email });
      if (!user) return res.status(404).json({ error: 'User not found' });

      const valid = await bcrypt.compare(String(password || ''), user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Password is incorrect' });
      }

      await Resume.deleteMany({ owner: authUser.email });
      await Block.deleteMany({ owner: authUser.email });
      await User.deleteOne({ email: authUser.email });
      return res.json({ success: true });
    } catch (err) {
      console.error('Delete account handler error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(404).json({ error: 'Not found' });
}
