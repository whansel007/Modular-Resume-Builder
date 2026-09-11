import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';

const router = Router();

const PROMPT_PREFIX = `You are parsing resume text into structured blocks for a resume builder.
Return ONLY valid JSON (no markdown, no commentary) matching:
{
  "personalInfo": { "name": "", "email": "", "phone": "", "location": "" },
  "blocks": [
    { "type": "summary", "name": "Summary", "fields": { "headline": "", "body": "" } },
    { "type": "experience", "name": "<Role> — <Company>", "fields": { "role": "", "company": "", "location": "", "startDate": "", "endDate": "", "description": "• bullet\\n• bullet" } },
    { "type": "projects", "name": "<Project Name> — <Role>", "fields": { "company": "", "role": "", "link": "", "location": "", "startDate": "", "endDate": "", "description": "• bullet\\n• bullet" } },
    { "type": "activities", "name": "<Role> — <Organization>", "fields": { "role": "", "company": "", "location": "", "startDate": "", "endDate": "", "description": "• bullet\\n• bullet" } },
    { "type": "education", "name": "<Degree> — <Institution>", "fields": { "institution": "", "degree": "", "field": "", "startDate": "", "endDate": "", "gpa": "" } },
    { "type": "skills", "name": "Skills", "fields": { "items": [ { "category": "Languages", "skills": "Python, TypeScript, SQL" }, { "category": "Frameworks", "skills": "React, Node.js" } ] } }
  ]
}
Rules:
- One experience block per job, one project block per project, one activities block per activity/club/initiative/volunteer role, one education block per entry; keep every bullet point in the description.
- Use "experience" for work experience/employment, "projects" for personal/academic/technical projects, and "activities" for co-curricular activities/extracurriculars/community service/volunteering/leadership/organizations.
- For "skills", group skills into categorized items under fields.items: [{ "category": "Languages", "skills": "Python, TypeScript, SQL" }, { "category": "Frameworks", "skills": "React, Node.js" }]. If no category is given, set "category" to an empty string "".
- Use only the six block types above. Skip sections that fit none of them.
- Leave unknown fields as empty strings. Dates as they appear (e.g. "Jan 2021", "Present").

Resume text:
`;

function parseModelJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Unparseable model output');
  }
}

// POST /api/import-resume - AI fallback: raw resume text -> structured blocks
router.post('/', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Resume text is required' });
    }

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'NVIDIA API key not configured' });
    }

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'meta/llama-3.2-11b-vision-instruct',
        messages: [{ role: 'user', content: PROMPT_PREFIX + String(text).slice(0, 24000) }],
        temperature: 0.1,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('NVIDIA API error:', error);
      return res.status(500).json({ error: 'Failed to parse resume', details: error });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';

    let parsed;
    try {
      parsed = parseModelJson(content);
    } catch (parseError) {
      console.error('Failed to parse resume JSON:', content);
      return res.status(500).json({ error: 'Failed to parse model output' });
    }

    const blocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
    res.json({
      personalInfo: parsed.personalInfo || {},
      blocks: blocks
        .filter(
          (b) =>
            b &&
            ['summary', 'experience', 'projects', 'activities', 'cca', 'education', 'skills'].includes(b.type) &&
            b.fields &&
            typeof b.fields === 'object',
        )
        .map((b) => {
          const type = b.type === 'cca' ? 'activities' : b.type;
          if (type === 'skills') {
            let items = Array.isArray(b.fields.items) ? b.fields.items : [];
            if (!items.length && (b.fields.skills || b.fields.category)) {
              items = [{ category: b.fields.category || '', skills: b.fields.skills || '' }];
            }
            const flatSkills = items
              .filter((i) => i.category || i.skills)
              .map((i) => (i.category ? `${i.category}: ${i.skills}` : i.skills))
              .join('\n');
            return {
              ...b,
              type,
              fields: {
                ...b.fields,
                category: items[0]?.category || b.fields.category || '',
                skills: flatSkills,
                items,
              },
            };
          }
          if (type === 'projects') {
            let comp = (b.fields.company || '').trim();
            let rl = (b.fields.role || '').trim();
            const ROLE_KEYWORDS = /^(creator|maintainer|developer|lead|author|contributor|architect|engineer|founder|co-founder|designer|manager|owner|member|president|officer)\b/i;
            if (ROLE_KEYWORDS.test(comp) && !ROLE_KEYWORDS.test(rl) && rl) {
              const temp = comp;
              comp = rl;
              rl = temp;
            } else if (!comp && rl) {
              comp = rl;
              rl = '';
            }
            return {
              ...b,
              type,
              fields: {
                ...b.fields,
                company: comp,
                role: rl,
              },
            };
          }
          return { ...b, type };
        }),
    });
  } catch (err) {
    console.error('Import resume error:', err);
    res.status(500).json({ error: 'Failed to import resume' });
  }
});

export default router;
