import { connectToDatabase } from '../lib/db.js';
import User from '../lib/models/User.js';

export default async function handler(req, res) {
  try {
    await connectToDatabase();

    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (req.method === 'GET') {
      // Convert Map to plain object
      const jobTypes = {};
      if (user.jobTypes) {
        for (const [key, value] of user.jobTypes) {
          jobTypes[key] = value;
        }
      }
      return res.json(jobTypes);
    }

    if (req.method === 'POST') {
      // Add a new job type
      const { id, name } = req.body;
      if (!id || !name) return res.status(400).json({ error: 'id and name required' });

      const jobTypes = user.jobTypes || new Map();
      jobTypes.set(id, name);
      user.jobTypes = jobTypes;
      await user.save();

      return res.status(201).json({ id, name });
    }

    if (req.method === 'PUT') {
      // Update an existing job type name
      const { id, name } = req.body;
      if (!id || !name) return res.status(400).json({ error: 'id and name required' });

      const jobTypes = user.jobTypes || new Map();
      if (!jobTypes.has(id)) return res.status(404).json({ error: 'Job type not found' });

      jobTypes.set(id, name);
      user.jobTypes = jobTypes;
      await user.save();

      return res.json({ id, name });
    }

    if (req.method === 'DELETE') {
      // Delete a job type
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id required' });

      const jobTypes = user.jobTypes || new Map();
      jobTypes.delete(id);
      user.jobTypes = jobTypes;
      await user.save();

      return res.json({ success: true, id });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
