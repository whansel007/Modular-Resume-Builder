import { Router } from 'express';
import Block from '../models/Block.js';

const router = Router();

// GET all blocks (optionally filter by owner query param)
router.get('/', async (req, res) => {
  try {
    const filter = req.query.owner ? { owner: req.query.owner } : {};
    const blocks = await Block.find(filter).sort({ updatedAt: -1 });
    res.json(blocks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST upsert a block (uses _id from body)
router.post('/', async (req, res) => {
  try {
    const { id, owner, type, jobTypeIds, ...contentFields } = req.body;
    const block = await Block.findByIdAndUpdate(
      id,
      { _id: id, owner, type, jobTypeIds: jobTypeIds || [], content: contentFields },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    res.status(201).json(block);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST bulk — upsert many blocks at once
router.post('/bulk', async (req, res) => {
  try {
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
    res.status(400).json({ error: err.message });
  }
});

// DELETE a block
router.delete('/:id', async (req, res) => {
  try {
    await Block.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
