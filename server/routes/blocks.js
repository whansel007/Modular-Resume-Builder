import { Router } from 'express';
import Block from '../models/Block.js';
import { requireAuth } from '../lib/auth.js';

const router = Router();

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

// POST upsert a block (uses _id from body)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { id, _id, owner, type, jobTypeIds, resumeId, variantOf, ...contentFields } = req.body;
    
    // Check if block exists and verify ownership
    const existingBlock = await Block.findById(id);
    if (existingBlock && existingBlock.owner !== req.user.email) {
      return res.status(403).json({ error: 'Not authorized to modify this block' });
    }
    
    // resumeId/variantOf are only touched when provided, so a plain save
    // of an existing variant keeps its resume scope.
    const update = { _id: id, owner: req.user.email, type, jobTypeIds: jobTypeIds || [], content: contentFields };
    if (resumeId !== undefined) update.resumeId = resumeId || null;
    if (variantOf !== undefined) update.variantOf = variantOf || null;
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
      const { id, _id, owner, type, jobTypeIds, resumeId, variantOf, ...contentFields } = b;
      const update = { _id: id, owner: req.user.email, type, jobTypeIds: jobTypeIds || [], content: contentFields };
      if (resumeId !== undefined) update.resumeId = resumeId || null;
      if (variantOf !== undefined) update.variantOf = variantOf || null;
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
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete block:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
