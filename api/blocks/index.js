import { connectToDatabase } from '../lib/db.js';
import Block from '../lib/models/Block.js';

export default async function handler(req, res) {
  try {
    await connectToDatabase();

    if (req.method === 'GET') {
      const filter = req.query.owner ? { owner: req.query.owner } : {};
      const blocks = await Block.find(filter).sort({ updatedAt: -1 });
      return res.json(blocks);
    }

    if (req.method === 'POST') {
      const { id, owner, type, jobTypeIds, ...contentFields } = req.body;
      const block = await Block.findByIdAndUpdate(
        id,
        { _id: id, owner, type, jobTypeIds: jobTypeIds || [], content: contentFields },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      );
      return res.status(201).json(block);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
