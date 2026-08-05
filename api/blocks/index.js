import { connectToDatabase } from '../../api-lib/db.js';
import Block from '../../api-lib/models/Block.js';
import { requireAuth } from '../../api-lib/auth.js';

export default async function handler(req, res) {
  try {
    const user = requireAuth(req, res);
    if (!user) return;

    await connectToDatabase();

    if (req.method === 'GET') {
      // Only return blocks owned by the authenticated user
      const blocks = await Block.find({ owner: user.email }).sort({ updatedAt: -1 });
      return res.json(blocks);
    }

    if (req.method === 'POST') {
      const { id, type, jobTypeIds, ...contentFields } = req.body;
      
      // Check if block exists and verify ownership
      const existingBlock = await Block.findById(id);
      if (existingBlock && existingBlock.owner !== user.email) {
        return res.status(403).json({ error: 'Not authorized to modify this block' });
      }
      
      // Force owner to be the authenticated user's email
      const block = await Block.findByIdAndUpdate(
        id,
        { _id: id, owner: user.email, type, jobTypeIds: jobTypeIds || [], content: contentFields },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      );
      return res.status(201).json(block);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Blocks handler error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
