import { connectToDatabase } from '../../api-lib/db.js';
import Block from '../../api-lib/models/Block.js';
import { requireAuth } from '../../api-lib/auth.js';

// Description is stored as an array of bullet strings; normalize any input
// (textarea, AI autoparse, import) so storage is always a clean string[].
function toDescriptionArray(v) {
  if (v === undefined || v === null) return v;
  if (Array.isArray(v)) return v.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
  if (typeof v === 'string') return v.split('\n').map((s) => s.trim()).filter(Boolean);
  return v;
}

export default async function handler(req, res) {
  try {
    const user = requireAuth(req, res);
    if (!user) return;

    await connectToDatabase();

    // Support /api/blocks/bulk via this dynamic route handler
    if (req.query.id === 'bulk') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const blocks = req.body;
      if (!Array.isArray(blocks)) {
        return res.status(400).json({ error: 'Expected array of blocks' });
      }

      const ops = blocks.map((b) => {
        const { id, _id, owner, name, content, __v, createdAt, updatedAt, type, tagIds, variantIn, variantOf, ...contentFields } = b;
        const update = { _id: id, owner: user.email, type, tagIds: tagIds || [], ...contentFields };
        if (name !== undefined) update.name = name || '';
        if (variantIn !== undefined) update.variantIn = variantIn || null;
        if (variantOf !== undefined) update.variantOf = variantOf || null;
        if (update.description !== undefined) update.description = toDescriptionArray(update.description);
        return {
          updateOne: {
            filter: { _id: id, owner: user.email }, // Ensure ownership
            update,
            upsert: true,
          },
        };
      });

      const result = await Block.bulkWrite(ops);
      return res.json({ success: true, matched: result.matchedCount, upserted: result.upsertedCount });
    }

    if (req.method !== 'DELETE') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const blockId = req.query.id;
    const block = await Block.findById(blockId);

    if (!block) {
      return res.status(404).json({ error: 'Block not found' });
    }

    if (block.owner !== user.email) {
      return res.status(403).json({ error: 'Not authorized to delete this block' });
    }

    await Block.findByIdAndDelete(blockId);
    // Cascade-delete child variants stored in the library under this block.
    // Resume-scoped variants belong to their resume and are left alone.
    await Block.deleteMany({ owner: user.email, variantOf: blockId, variantIn: null });
    return res.json({ success: true });
  } catch (err) {
    console.error('Block handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
