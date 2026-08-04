import { connectToDatabase } from '../lib/db.js';
import User from '../lib/models/User.js';
import { requireAuth } from '../lib/auth.js';

export default async function handler(req, res) {
  try {
    const user = requireAuth(req, res);
    if (!user) return;

    await connectToDatabase();

    const dbUser = await User.findOne({ email: user.email });
    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (req.method === 'GET') {
      // Return job types as a plain object
      const jobTypesObj = {};
      if (dbUser.jobTypes) {
        for (const [key, value] of dbUser.jobTypes.entries()) {
          jobTypesObj[key] = value;
        }
      }
      return res.json(jobTypesObj);
    }

    if (req.method === 'POST') {
      const { id, name } = req.body;
      if (!id || !name) {
        return res.status(400).json({ error: 'Missing id or name' });
      }
      dbUser.jobTypes.set(id, name);
      await dbUser.save();
      return res.status(201).json({ id, name });
    }

    if (req.method === 'PUT') {
      const { id, name } = req.body;
      if (!id || !name) {
        return res.status(400).json({ error: 'Missing id or name' });
      }
      if (!dbUser.jobTypes.has(id)) {
        return res.status(404).json({ error: 'Job type not found' });
      }
      dbUser.jobTypes.set(id, name);
      await dbUser.save();
      return res.json({ id, name });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Missing id query parameter' });
      }
      dbUser.jobTypes.delete(id);
      await dbUser.save();
      return res.json({ success: true, id });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
