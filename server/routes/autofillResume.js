import { Router } from 'express';

const router = Router();

const DEFAULT_SECTIONS = ['Summary', 'Experience', 'Education', 'Skills'];

function parseJsonFromText(content) {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// Long generations can get dropped (ECONNRESET) — retry network-level failures once
async function fetchWithRetry(url, options, attempts = 2) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastError = err;
      console.warn(`NVIDIA fetch attempt ${i + 1} failed:`, err.message);
    }
  }
  throw lastError;
}

// POST /api/autofill-resume - pick best-fit existing blocks for missing default sections.
// IMPORTANT: never generates new content — only references the user's existing blocks.
router.post('/', async (req, res) => {
  try {
    const { jobDescription, keywords, resume, blocks } = req.body || {};

    if (!jobDescription || jobDescription.trim().length === 0) {
      return res.status(400).json({ error: 'Job description is required' });
    }

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'NVIDIA API key not configured' });
    }

    const sectionOrder = resume?.sectionOrder || [];
    const sections = resume?.sections || {};
    const existingBlocks = Array.isArray(blocks) ? blocks : [];
    const selectedKeywords = Array.isArray(keywords) ? keywords : [];

    // Existing block ids the AI may reference
    const existingIds = new Set(existingBlocks.map((b) => b.id).filter(Boolean));

    const prompt = `You are a resume builder assistant. The user pasted a job description and selected keywords they want to target.

Job description:
${jobDescription}

Selected keywords:
${JSON.stringify(selectedKeywords)}

The user's block library (reusable resume content). Each entry has an "id", a "type", and content fields:
${JSON.stringify(existingBlocks)}

The current resume has these sections in order: ${JSON.stringify(sectionOrder)}
Section contents (section title -> block ids): ${JSON.stringify(sections)}

IMPORTANT RULES:
- You must NEVER invent or fabricate resume content. The resume may only contain content from the user's existing block library.
- Your only job is selecting which EXISTING blocks fit each missing section best.
- Only reference ids that appear in the block library above. Never create new blocks or ids.

TASK:
For each of the sections ${JSON.stringify(DEFAULT_SECTIONS)} that does NOT already exist in the current resume (match titles case-insensitively), add it. Fill each ADDED section with the existing block ids that fit this job best, based on the job description and selected keywords.
- Only assign a block if its content is genuinely relevant to this job.
- If no existing block fits a section, leave it as an empty array.

Return ONLY JSON, no other text, in this exact shape:
{
  "sections": { "Section Title": ["existing-block-id"] },
  "sectionOrder": ["Summary", "Experience", "Education", "Skills"]
}
"sections" must contain ONLY the sections being added. "sectionOrder" is the full ordered list of ALL section titles after the change.`;

    const response = await fetchWithRetry('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-70b-instruct',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('NVIDIA API error:', error);
      return res.status(500).json({ error: 'Failed to auto-fill resume', details: error });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsed = parseJsonFromText(content);

    if (!parsed) {
      console.error('Failed to parse autofill response:', content);
      return res.status(500).json({ error: 'AI returned an invalid response. Please try again.' });
    }

    // Which default sections are actually missing (case-insensitive match)
    const lowerExisting = new Set(sectionOrder.map((t) => t.toLowerCase()));
    const missingSections = DEFAULT_SECTIONS.filter((s) => !lowerExisting.has(s.toLowerCase()));

    const aiSections = typeof parsed.sections === 'object' && parsed.sections ? parsed.sections : {};
    const resultSections = {};

    for (const title of missingSections) {
      // Find AI-provided ids for this section (match key case-insensitively)
      const aiKey = Object.keys(aiSections).find((k) => k.toLowerCase() === title.toLowerCase());
      const rawIds = aiKey ? (Array.isArray(aiSections[aiKey]) ? aiSections[aiKey] : []) : [];

      // Keep only real library ids — anything invented by the AI is dropped. De-dupe.
      const ids = [...new Set(rawIds.filter((id) => existingIds.has(id)))];

      // Empty array is fine: the section is added and the user drags blocks in manually
      resultSections[title] = ids;
    }

    // Full section order: keep current order, insert missing sections canonically
    const resultOrder = [...sectionOrder];
    for (const title of Object.keys(resultSections)) {
      const canonicalIdx = DEFAULT_SECTIONS.indexOf(title);
      let insertAt = 0;
      for (let i = 0; i < resultOrder.length; i++) {
        const idx = DEFAULT_SECTIONS.findIndex((s) => s.toLowerCase() === resultOrder[i].toLowerCase());
        if (idx !== -1 && idx < canonicalIdx) insertAt = i + 1;
      }
      resultOrder.splice(insertAt, 0, title);
    }

    res.json({
      newBlocks: [],
      sections: resultSections,
      sectionOrder: resultOrder,
    });
  } catch (err) {
    console.error('Autofill resume error:', err);
    res.status(500).json({ error: 'Failed to auto-fill resume' });
  }
});

export default router;
