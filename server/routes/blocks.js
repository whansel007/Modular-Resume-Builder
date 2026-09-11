import { Router } from 'express';
import Block from '../models/Block.js';
import { requireAuth } from '../lib/auth.js';

const router = Router();

// Description is stored as an array of bullet strings. Any source (textarea,
// AI autoparse, import) that sends a string or a mixed array is normalized
// here so storage is always a clean string[].
function toDescriptionArray(v) {
  if (v === undefined || v === null) return v;
  if (Array.isArray(v)) return v.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
  if (typeof v === 'string') return v.split('\n').map((s) => s.trim()).filter(Boolean);
  return v;
}

// GET all blocks (only for authenticated user)
router.get('/', requireAuth, async (req, res) => {
  try {
    const blocks = await Block.find({ owner: req.user.email }).sort({ updatedAt: -1 });
    res.json(blocks);
  } catch (err) {
    console.error('Failed to list blocks:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST upsert a block (uses _id from body). Content fields are stored flat
// at the top level of the document.
router.post('/', requireAuth, async (req, res) => {
  try {
    const { id, _id, owner, name, content, __v, createdAt, updatedAt, type, tagIds, variantIn, variantOf, ...contentFields } = req.body;
    
    // Check if block exists and verify ownership
    const existingBlock = await Block.findById(id);
    if (existingBlock && existingBlock.owner !== req.user.email) {
      return res.status(403).json({ error: 'Not authorized to modify this block' });
    }
    
    // variantIn/variantOf are only touched when provided, so a plain save
    // of an existing variant keeps its resume scope.
    const update = { _id: id, owner: req.user.email, type, tagIds: tagIds || [], ...contentFields };
    if (name !== undefined) update.name = name || '';
    if (variantIn !== undefined) update.variantIn = variantIn || null;
    if (variantOf !== undefined) update.variantOf = variantOf || null;
    if (update.description !== undefined) update.description = toDescriptionArray(update.description);
    const block = await Block.findByIdAndUpdate(
      id,
      update,
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    res.status(201).json(block);
  } catch (err) {
    console.error('Failed to upsert block:', err);
    res.status(400).json({ error: 'Invalid block data' });
  }
});

// POST bulk — upsert many blocks at once
router.post('/bulk', requireAuth, async (req, res) => {
  try {
    const blocks = req.body;
    if (!Array.isArray(blocks)) return res.status(400).json({ error: 'Expected array of blocks' });

    const ops = blocks.map((b) => {
      const { id, _id, owner, name, content, __v, createdAt, updatedAt, type, tagIds, variantIn, variantOf, ...contentFields } = b;
      const update = { _id: id, owner: req.user.email, type, tagIds: tagIds || [], ...contentFields };
      if (name !== undefined) update.name = name || '';
      if (variantIn !== undefined) update.variantIn = variantIn || null;
      if (variantOf !== undefined) update.variantOf = variantOf || null;
      if (update.description !== undefined) update.description = toDescriptionArray(update.description);
      return {
        updateOne: {
          filter: { _id: id, owner: req.user.email },
          update,
          upsert: true,
        },
      };
    });

    const result = await Block.bulkWrite(ops);
    res.json({ success: true, matched: result.matchedCount, upserted: result.upsertedCount });
  } catch (err) {
    console.error('Failed to bulk write blocks:', err);
    res.status(400).json({ error: 'Invalid block data' });
  }
});

// DELETE a block
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const block = await Block.findById(req.params.id);
    if (!block) {
      return res.status(404).json({ error: 'Block not found' });
    }
    if (block.owner !== req.user.email) {
      return res.status(403).json({ error: 'Not authorized to delete this block' });
    }
    await Block.findByIdAndDelete(req.params.id);
    // Cascade-delete child variants stored in the library under this block.
    // Resume-scoped variants belong to their resume and are left alone.
    await Block.deleteMany({ owner: req.user.email, variantOf: req.params.id, variantIn: null });
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete block:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
