import { connectToDatabase } from '../lib/db.js';
import Resume from '../lib/models/Resume.js';

export default async function handler(req, res) {
  try {
    await connectToDatabase();

    if (req.method === 'GET') {
      const filter = req.query.owner ? { owner: req.query.owner } : {};
      const resumes = await Resume.find(filter).sort({ updatedAt: -1 });
      return res.json(resumes);
    }

    if (req.method === 'POST') {
      const { id, owner, title, templateId, personalInfo, sectionOrder, sections } = req.body;
      const resume = await Resume.findByIdAndUpdate(
        id,
        { _id: id, owner, title, templateId, personalInfo, sectionOrder, sections },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      );
      return res.status(201).json(resume);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Missing id query parameter' });
      }
      await Resume.findByIdAndDelete(id);
      return res.json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
