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

    if (req.method === 'GET') {
      // Only return blocks owned by the authenticated user
      const blocks = await Block.find({ owner: user.email }).sort({ updatedAt: -1 });
      return res.json(blocks);
    }

    if (req.method === 'POST') {
      const { id, _id, owner, name, content, __v, createdAt, updatedAt, type, tagIds, variantIn, variantOf, ...contentFields } = req.body;
      
      // Check if block exists and verify ownership
      const existingBlock = await Block.findById(id);
      if (existingBlock && existingBlock.owner !== user.email) {
        return res.status(403).json({ error: 'Not authorized to modify this block' });
      }
      
      // Force owner to be the authenticated user's email.
      // variantIn/variantOf are only touched when provided, so a plain save
      // of an existing variant keeps its resume scope.
      const update = { _id: id, owner: user.email, type, tagIds: tagIds || [], ...contentFields };
      if (name !== undefined) update.name = name || '';
      if (variantIn !== undefined) update.variantIn = variantIn || null;
      if (variantOf !== undefined) update.variantOf = variantOf || null;
      if (update.description !== undefined) update.description = toDescriptionArray(update.description);
      const block = await Block.findByIdAndUpdate(
        id,
        update,
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
