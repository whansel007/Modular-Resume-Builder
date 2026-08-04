import { Router } from 'express';
import Resume from '../models/Resume.js';
import { requireAuth } from '../lib/auth.js';

const router = Router();

// GET all resumes (only for authenticated user)
router.get('/', requireAuth, async (req, res) => {
  try {
    const resumes = await Resume.find({ owner: req.user.email }).sort({ updatedAt: -1 });
    res.json(resumes);
  } catch (err) {
    console.error('Failed to list resumes:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST upsert a resume
router.post('/', requireAuth, async (req, res) => {
  try {
    const { id, title, templateId, personalInfo, sectionOrder, sections } = req.body;
    
    // Check if resume exists and verify ownership
    const existingResume = await Resume.findById(id);
    if (existingResume && existingResume.owner !== req.user.email) {
      return res.status(403).json({ error: 'Not authorized to modify this resume' });
    }
    
    const resume = await Resume.findByIdAndUpdate(
      id,
      { _id: id, owner: req.user.email, title, templateId, personalInfo, sectionOrder, sections },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    res.status(201).json(resume);
  } catch (err) {
    console.error('Failed to upsert resume:', err);
    res.status(400).json({ error: 'Invalid resume data' });
  }
});

// DELETE a resume
router.delete('/', requireAuth, async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'Missing id query parameter' });
    }
    
    const resume = await Resume.findById(id);
    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }
    if (resume.owner !== req.user.email) {
      return res.status(403).json({ error: 'Not authorized to delete this resume' });
    }
    
    await Resume.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete resume:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
