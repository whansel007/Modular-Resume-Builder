import { Router } from 'express';
import User from '../models/User.js';

const router = Router();

// GET all job types for a user
router.get('/', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Convert Map to plain object
    const jobTypes = {};
    if (user.jobTypes) {
      for (const [key, value] of user.jobTypes) {
        jobTypes[key] = value;
      }
    }
    res.json(jobTypes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add a new job type
router.post('/', async (req, res) => {
  try {
    const { email, id, name } = req.body;
    if (!email || !id || !name) return res.status(400).json({ error: 'email, id, and name required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const jobTypes = user.jobTypes || new Map();
    jobTypes.set(id, name);
    user.jobTypes = jobTypes;
    await user.save();

    res.status(201).json({ id, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update an existing job type name
router.put('/', async (req, res) => {
  try {
    const { email, id, name } = req.body;
    if (!email || !id || !name) return res.status(400).json({ error: 'email, id, and name required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const jobTypes = user.jobTypes || new Map();
    if (!jobTypes.has(id)) return res.status(404).json({ error: 'Job type not found' });

    jobTypes.set(id, name);
    user.jobTypes = jobTypes;
    await user.save();

    res.json({ id, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a job type
router.delete('/', async (req, res) => {
  try {
    const { email, id } = req.query;
    if (!email || !id) return res.status(400).json({ error: 'email and id required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const jobTypes = user.jobTypes || new Map();
    jobTypes.delete(id);
    user.jobTypes = jobTypes;
    await user.save();

    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
