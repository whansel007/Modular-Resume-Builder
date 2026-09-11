import { requireAuth } from '../api-lib/auth.js';

const SYSTEM_PROMPT = `You are an elite executive resume writer and career strategist specializing in high-impact, ATS-optimized resume blocks.

TASK:
Convert the user's raw experience notes, achievements, or descriptions into a structured, professional resume block.

CRITICAL RESUME WRITING INSTRUCTIONS:
1. STAR METHOD: For bullet points (descriptions), structure each bullet using the STAR framework (Situation, Task, Action, Result):
   - Lead with a powerful, active past-tense action verb (e.g., Spearheaded, Architected, Engineered, Optimized, Streamlined, Orchestrated, Accelerated, Championed).
   - Clearly describe the challenge/context and the proactive action taken.
   - Quantify results and business impact with concrete numbers, metrics, percentages, dollar values, or performance improvements (e.g., "increasing throughput by 35%", "reducing latency by 45%", "delivering $150k in annual savings", "scaling to 500k+ users", "mentoring 6 engineers"). If exact metrics are absent from the user's notes, derive realistic, plausible impact numbers or strong qualitative outcomes based on the context.
2. CONCISENESS & IMPACT: Write concise, punchy, professional bullets (2 to 4 bullets per role/project). Each bullet MUST start with "• ".
3. DATE & TIME RESOLUTION:
   - Carefully resolve any relative time references (e.g. "2 months ago", "last month", "since 3 months ago", "started in June", "last year", "summer 2023", "Present") into concrete calendar dates based on the TODAY'S DATE REFERENCE provided in the prompt.
   - Format dates as "Mon YYYY" (e.g. "Jul 2026", "Jan 2024", "Present", "May 2025 - Present").
4. FORMAT: Return ONLY valid JSON (no markdown formatting, no code fencing, no conversational text) matching the schema:

For "experience":
{
  "type": "experience",
  "name": "<Role> — <Company>",
  "fields": {
    "role": "Role (e.g. Senior Software Engineer)",
    "company": "Company (e.g. Google)",
    "location": "City, State or Remote",
    "startDate": "Start Date",
    "endDate": "End Date",
    "description": "• Spearheaded ... resulting in 30% increase in ...\\n• Architected ... reducing latency by 45%\\n• Collaborated with ... delivering project 2 weeks ahead of schedule"
  }
}

For "projects":
{
  "type": "projects",
  "name": "<Project Name> — <Role>",
  "fields": {
    "company": "Project Name (e.g. Open-Source Markdown Engine)",
    "role": "Role (e.g. Creator & Maintainer)",
    "link": "Project Link (e.g. https://github.com/username/project)",
    "location": "Location (e.g. Remote)",
    "startDate": "Start Date",
    "endDate": "End Date",
    "description": "• Built and launched ... achieving 2,000+ active users\\n• Implemented ... cutting query execution time by 60%"
  }
}

For "activities":
{
  "type": "activities",
  "name": "<Role> — <Organization>",
  "fields": {
    "role": "Role (e.g. President)",
    "company": "Organization (e.g. University Computing Society)",
    "location": "Location",
    "startDate": "Start Date",
    "endDate": "End Date",
    "description": "• Directed ... leading team of 15 members to organize event for 400+ attendees\\n• Secured $25k in corporate sponsorships through targeted outreach"
  }
}

For "summary":
{
  "type": "summary",
  "name": "Professional Summary",
  "fields": {
    "headline": "Target Headline (e.g. Senior Full-Stack Engineer)",
    "body": "Results-driven Senior Full-Stack Engineer with 6+ years of experience building scalable distributed systems and high-throughput microservices. Proven track record of boosting system performance by 40% and leading agile teams to deliver mission-critical software solutions."
  }
}

For "education":
{
  "type": "education",
  "name": "<Degree> — <Institution>",
  "fields": {
    "institution": "Institution (e.g. State University)",
    "degree": "Degree (e.g. B.S., M.S., B.A.)",
    "field": "Field of Study (e.g. Computer Science)",
    "location": "City, State",
    "startDate": "Start Date",
    "endDate": "End Date",
    "gpa": "GPA: 3.8 / 4.0 or Dean's List"
  }
}

For "skills":
{
  "type": "skills",
  "name": "Technical Skills",
  "fields": {
    "category": "Languages & Frameworks",
    "skills": "Python, TypeScript, React, Node.js, PostgreSQL, Docker, AWS",
    "items": [
      { "category": "Languages", "skills": "TypeScript, Python, Go, SQL" },
      { "category": "Frameworks & Tools", "skills": "React, Node.js, Next.js, Docker, Kubernetes, AWS" }
    ]
  }
}
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const { text, targetType, currentBlock, clientDate } = req.body || {};
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Please enter details or notes to parse.' });
    }

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'NVIDIA API key not configured' });
    }

    const now = clientDate ? new Date(clientDate) : new Date();
    const currentDateStr = !isNaN(now.getTime())
      ? now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const currentMonthYear = !isNaN(now.getTime())
      ? now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const userPrompt = `TODAY'S DATE REFERENCE:
- Today's Date: ${currentDateStr} (Current Month: ${currentMonthYear})
- When the user mentions relative time expressions (e.g. "2 months ago", "last month", "started 3 months ago", "since January", "until 2 months ago"), calculate the exact calendar month & year relative to ${currentDateStr}.
- Format dates for "startDate" and "endDate" as standard concise resume format: "Mon YYYY" (e.g. "Jul 2026", "Jan 2024", "Present").

Target Block Type: ${targetType || 'experience'}
Existing Block Details: ${JSON.stringify(currentBlock || {})}

User Experience / Raw Notes:
"""
${String(text).slice(0, 10000)}
"""

Please convert the above input into a structured, STAR-formatted resume block JSON.`;

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'meta/llama-3.2-11b-vision-instruct',
        messages: [
          { role: 'user', content: `${SYSTEM_PROMPT}\n\n${userPrompt}` },
        ],
        temperature: 0.2,
        max_tokens: 2500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('NVIDIA API error:', errorText);
      return res.status(500).json({ error: 'Failed to auto-parse block', details: errorText });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';

    let parsed;
    try {
      parsed = parseModelJson(content);
    } catch (parseError) {
      console.error('Failed to parse AI output:', content);
      return res.status(500).json({ error: 'Failed to parse AI model response' });
    }

    const validTypes = ['summary', 'experience', 'projects', 'activities', 'cca', 'education', 'skills'];
    let type = validTypes.includes(parsed.type) ? parsed.type : (targetType || 'experience');
    if (type === 'cca') type = 'activities';

    const fields = parsed.fields && typeof parsed.fields === 'object' ? parsed.fields : {};
    const name = parsed.name || '';

    return res.json({
      type,
      name,
      fields,
    });
  } catch (err) {
    console.error('Auto-parse error:', err);
    return res.status(500).json({ error: err.message || 'Failed to auto-parse block' });
  }
}
