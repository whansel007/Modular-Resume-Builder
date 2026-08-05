import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';

const router = Router();

// Build a readable summary of the current resume with block content resolved
function buildResumeContext(resume, blocks) {
  const blockMap = {};
  for (const b of Array.isArray(blocks) ? blocks : []) {
    if (b?.id) blockMap[b.id] = b;
  }

  const info = resume?.personalInfo || {};
  const lines = [];
  lines.push(`Title: ${resume?.title || 'Untitled'}`);
  lines.push(
    `Personal info: ${info.name || '(empty)'} | ${info.email || '(empty)'} | ${info.phone || '(empty)'} | ${info.location || '(empty)'}`,
  );

  const sectionOrder = resume?.sectionOrder || [];
  const sections = resume?.sections || {};

  if (sectionOrder.length === 0) {
    lines.push('The resume is currently empty (no sections).');
  }

  for (const title of sectionOrder) {
    lines.push(`## ${title}`);
    const ids = sections[title] || [];
    for (const id of ids) {
      const b = blockMap[id];
      if (!b) continue;
      const { id: _id, _id: _mongo, owner: _owner, jobTypeIds: _jt, type, ...fields } = b;
      lines.push(`- [${type}] ${JSON.stringify(fields)}`);
    }
    if (ids.length === 0) lines.push('- (empty section)');
  }

  return lines.join('\n');
}

// POST /api/resume-chat - chat assistant that answers questions about the current resume
router.post('/', requireAuth, async (req, res) => {
  try {
    const { messages, resume, blocks } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages are required' });
    }

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'NVIDIA API key not configured' });
    }

    const systemPrompt = `You are a friendly resume assistant embedded in a resume builder app. The user can ask you questions about their resume.

Current resume content:
${buildResumeContext(resume, blocks)}

RULES:
- Answer questions and give feedback, tips, and improvement suggestions about this resume.
- Be concise (a few sentences unless the user asks for detail). Plain text only — no markdown.
- Base your answers ONLY on the resume content above and general resume best practices.
- NEVER invent facts about the user or claim their resume contains something it does not. If information is missing, say so and suggest what to add.
- Frame all suggested wording or content explicitly as a suggestion for the user to verify. You cannot edit the resume yourself.`;

    // Keep only recent turns, and only valid role/content pairs
    const history = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-70b-instruct',
        messages: [{ role: 'system', content: systemPrompt }, ...history],
        temperature: 0.5,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('NVIDIA API error:', error);
      return res.status(500).json({ error: 'Failed to reach the AI assistant', details: error });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || '';

    if (!reply) {
      return res.status(500).json({ error: 'The AI returned an empty response. Please try again.' });
    }

    res.json({ reply });
  } catch (err) {
    console.error('Resume chat error:', err);
    res.status(500).json({ error: 'Failed to reach the AI assistant' });
  }
});

export default router;
