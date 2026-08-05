import { connectToDatabase } from '../../api-lib/db.js';
import Block from '../../api-lib/models/Block.js';
import { requireAuth } from '../../api-lib/auth.js';

export default async function handler(req, res) {
  try {
    const user = requireAuth(req, res);
    if (!user) return;

    await connectToDatabase();

    if (req.method === 'POST') {
      const blocks = req.body;
      if (!Array.isArray(blocks)) return res.status(400).json({ error: 'Expected array of blocks' });

      const ops = blocks.map((b) => {
        const { id, _id, owner, name, content, __v, createdAt, updatedAt, type, jobTypeIds, resumeId, variantOf, ...contentFields } = b;
        const update = { _id: id, owner: user.email, type, jobTypeIds: jobTypeIds || [], content: contentFields };
        if (name !== undefined) update.name = name || '';
        if (resumeId !== undefined) update.resumeId = resumeId || null;
        if (variantOf !== undefined) update.variantOf = variantOf || null;
        return {
          updateOne: {
            filter: { _id: id, owner: user.email }, // Ensure ownership
            update,
            upsert: true,
          },
        };
      });

      const result = await Block.bulkWrite(ops);
      res.json({ success: true, matched: result.matchedCount, upserted: result.upsertedCount });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Blocks bulk handler error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
