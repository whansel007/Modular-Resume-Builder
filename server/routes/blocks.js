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
    res.status(500).json({ error: err.message });
  }
});

// POST upsert a block (uses _id from body)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { id, type, jobTypeIds, ...contentFields } = req.body;
    
    // Check if block exists and verify ownership
    const existingBlock = await Block.findById(id);
    if (existingBlock && existingBlock.owner !== req.user.email) {
      return res.status(403).json({ error: 'Not authorized to modify this block' });
    }
    
    const block = await Block.findByIdAndUpdate(
      id,
      { _id: id, owner: req.user.email, type, jobTypeIds: jobTypeIds || [], content: contentFields },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    res.status(201).json(block);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST bulk — upsert many blocks at once
router.post('/bulk', requireAuth, async (req, res) => {
  try {
    const blocks = req.body;
    if (!Array.isArray(blocks)) return res.status(400).json({ error: 'Expected array of blocks' });

    const ops = blocks.map((b) => {
      const { id, type, jobTypeIds, ...contentFields } = b;
      return {
        updateOne: {
          filter: { _id: id, owner: req.user.email },
          update: { _id: id, owner: req.user.email, type, jobTypeIds: jobTypeIds || [], content: contentFields },
          upsert: true,
        },
      };
    });

    const result = await Block.bulkWrite(ops);
    res.json({ success: true, matched: result.matchedCount, upserted: result.upsertedCount });
  } catch (err) {
    res.status(400).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

export default router;
