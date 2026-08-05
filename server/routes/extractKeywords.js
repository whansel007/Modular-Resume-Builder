import { Router } from 'express';

const router = Router();

// POST /api/extract-keywords - Extract keywords from job description using NVIDIA AI
router.post('/', async (req, res) => {
  try {
    const { jobDescription } = req.body;
    
    if (!jobDescription || jobDescription.trim().length === 0) {
      return res.status(400).json({ error: 'Job description is required' });
    }

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'NVIDIA API key not configured' });
    }

    const prompt = `Extract the most relevant keywords, skills, technologies, and qualifications from this job description. Return them as a JSON array of strings, focusing on:
- Technical skills and technologies
- Soft skills and qualities
- Required qualifications and certifications
- Industry-specific terms
- Tools and frameworks

Job Description:
${jobDescription}

Return ONLY a JSON array of keywords, no other text:`;

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-70b-instruct',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('NVIDIA API error:', error);
      return res.status(500).json({ error: 'Failed to extract keywords', details: error });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    
    // Parse the JSON array from the response
    let keywords;
    try {
      keywords = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse keywords:', content);
      // Fallback: try to extract array from text
      const match = content.match(/\[[\s\S]*?\]/);
      if (match) {
        keywords = JSON.parse(match[0]);
      } else {
        keywords = [];
      }
    }

    // Ensure it's an array of strings
    if (!Array.isArray(keywords)) {
      keywords = [];
    }

    res.json({ keywords: keywords.filter(k => typeof k === 'string' && k.trim().length > 0) });
  } catch (err) {
    console.error('Extract keywords error:', err);
    res.status(500).json({ error: 'Failed to extract keywords' });
  }
});

export default router;
