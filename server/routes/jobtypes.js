import { Router } from 'express';
import User from '../models/User.js';
import { requireAuth } from '../lib/auth.js';

const router = Router();

// GET all job types for authenticated user
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email });
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
    console.error('Failed to list job types:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST add a new job type
router.post('/', requireAuth, async (req, res) => {
  try {
    const { id, name } = req.body;
    if (!id || !name) return res.status(400).json({ error: 'id and name required' });

    const user = await User.findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const jobTypes = user.jobTypes || new Map();
    jobTypes.set(id, name);
    user.jobTypes = jobTypes;
    await user.save();

    res.status(201).json({ id, name });
  } catch (err) {
    console.error('Failed to add job type:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update an existing job type name
router.put('/', requireAuth, async (req, res) => {
  try {
    const { id, name } = req.body;
    if (!id || !name) return res.status(400).json({ error: 'id and name required' });

    const user = await User.findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const jobTypes = user.jobTypes || new Map();
    if (!jobTypes.has(id)) return res.status(404).json({ error: 'Job type not found' });

    jobTypes.set(id, name);
    user.jobTypes = jobTypes;
    await user.save();

    res.json({ id, name });
  } catch (err) {
    console.error('Failed to update job type:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE a job type
router.delete('/', requireAuth, async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });

    const user = await User.findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const jobTypes = user.jobTypes || new Map();
    jobTypes.delete(id);
    user.jobTypes = jobTypes;
    await user.save();

    res.json({ success: true, id });
  } catch (err) {
    console.error('Failed to delete job type:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
