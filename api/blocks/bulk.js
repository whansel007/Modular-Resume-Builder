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
        const { id, type, jobTypeIds, ...contentFields } = b;
        return {
          updateOne: {
            filter: { _id: id, owner: user.email }, // Ensure ownership
            update: { _id: id, owner: user.email, type, jobTypeIds: jobTypeIds || [], content: contentFields },
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
    res.status(500).json({ error: err.message });
  }
}
