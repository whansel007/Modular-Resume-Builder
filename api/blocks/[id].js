import { connectToDatabase } from '../lib/db.js';
import Block from '../lib/models/Block.js';
import { requireAuth } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = requireAuth(req, res);
    if (!user) return;

    await connectToDatabase();

    const blockId = req.url.split('/').pop();
    const block = await Block.findById(blockId);
    
    if (!block) {
      return res.status(404).json({ error: 'Block not found' });
    }
    
    if (block.owner !== user.email) {
      return res.status(403).json({ error: 'Not authorized to delete this block' });
    }
    
    await Block.findByIdAndDelete(blockId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
