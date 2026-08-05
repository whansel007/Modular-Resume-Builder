import { connectToDatabase } from '../../api-lib/db.js';
import Resume from '../../api-lib/models/Resume.js';
import Block from '../../api-lib/models/Block.js';
import { requireAuth } from '../../api-lib/auth.js';

export default async function handler(req, res) {
  try {
    const user = requireAuth(req, res);
    if (!user) return;

    await connectToDatabase();

    if (req.method === 'GET') {
      // Only return resumes owned by the authenticated user
      const resumes = await Resume.find({ owner: user.email }).sort({ updatedAt: -1 });
      return res.json(resumes);
    }

    if (req.method === 'POST') {
      const { id, title, templateId, personalInfo, sectionOrder, sections } = req.body;
      
      // Check if resume exists and verify ownership
      const existingResume = await Resume.findById(id);
      if (existingResume && existingResume.owner !== user.email) {
        return res.status(403).json({ error: 'Not authorized to modify this resume' });
      }
      
      // Force owner to be the authenticated user's email
      const resume = await Resume.findByIdAndUpdate(
        id,
        { _id: id, owner: user.email, title, templateId, personalInfo, sectionOrder, sections },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      );
      return res.status(201).json(resume);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Missing id query parameter' });
      }
      // Verify ownership before deleting
      const resume = await Resume.findById(id);
      if (!resume) {
        return res.status(404).json({ error: 'Resume not found' });
      }
      if (resume.owner !== user.email) {
        return res.status(403).json({ error: 'Not authorized to delete this resume' });
      }
      await Resume.findByIdAndDelete(id);
      // Cascade-delete blocks saved as variants for this resume — they are
      // resume-scoped and meaningless without it.
      await Block.deleteMany({ owner: user.email, resumeId: id });
      return res.json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Resumes handler error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
