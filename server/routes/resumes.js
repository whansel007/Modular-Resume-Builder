import { Router } from 'express';
import Resume from '../models/Resume.js';

const router = Router();

// GET all resumes (optionally filter by owner query param)
router.get('/', async (req, res) => {
  try {
    const filter = req.query.owner ? { owner: req.query.owner } : {};
    const resumes = await Resume.find(filter).sort({ updatedAt: -1 });
    res.json(resumes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST upsert a resume
router.post('/', async (req, res) => {
  try {
    const { id, owner, title, templateId, personalInfo, sectionOrder, sections } = req.body;
    const resume = await Resume.findByIdAndUpdate(
      id,
      { _id: id, owner, title, templateId, personalInfo, sectionOrder, sections },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    res.status(201).json(resume);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE a resume
router.delete('/', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'Missing id query parameter' });
    }
    await Resume.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
