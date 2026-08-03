import { connectToDatabase } from '../lib/db.js';
import Block from '../lib/models/Block.js';

export default async function handler(req, res) {
  try {
    await connectToDatabase();

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const blocks = req.body;
    if (!Array.isArray(blocks)) return res.status(400).json({ error: 'Expected array of blocks' });

    const ops = blocks.map((b) => {
      const { id, owner, type, jobTypeIds, ...contentFields } = b;
      return {
        updateOne: {
          filter: { _id: id },
          update: { _id: id, owner, type, jobTypeIds: jobTypeIds || [], content: contentFields },
          upsert: true,
        },
      };
    });

    const result = await Block.bulkWrite(ops);
    res.json({ success: true, matched: result.matchedCount, upserted: result.upsertedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
