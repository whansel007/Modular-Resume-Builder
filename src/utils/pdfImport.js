// PDF resume import: extracts text lines with layout info via pdfjs, then
// heuristically splits them into sections and blocks. Falls back to the AI
// endpoint when the layout defeats the heuristics (see ImportModal).

const BULLET_RE = /^[•▪◦‣∙·●○■□◘\-\*\u2022\u2013]\s*/;
const DATE_RANGE_RE =
  /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4})\s*(?:–|—|-|to|until)\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4}|Present|Current|Now|Today)/i;
const SINGLE_DATE_RE =
  /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\b(19|20)\d{2}\b/;

// Section header → block type. Anything unmatched is reported as skipped.
const SECTION_PATTERNS = [
  { type: 'summary', re: /^(professional\s+)?(summary|profile|objective|about(\s+me)?|personal\s+statement)$/i },
  { type: 'experience', re: /^((work|professional|employment|relevant)\s+)?(experience|history)$/i },
  { type: 'experience', re: /^employment$/i },
  { type: 'education', re: /^(education(al)?(\s+history)?|academics?)$/i },
  { type: 'skills', re: /^((technical|core|key|relevant)\s+)?(skills|competenc(y|ies)|technologies|tools)$/i },
];

function matchSectionType(title) {
  for (const { type, re } of SECTION_PATTERNS) {
    if (re.test(title)) return type;
  }
  return null;
}

// ── PDF text extraction ────────────────────────────────────────────────

let pdfjsPromise = null;

function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist');
      // Bundle the worker instead of hitting a CDN so imports work offline.
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

/**
 * Reads a PDF File and returns one record per visual text line:
 * { text, page, y, x0, size } — y grows upward (PDF coords), x0 is the
 * leftmost item position (used for indent/bullet detection).
 */
export async function extractLinesFromFile(file) {
  const pdfjs = await loadPdfJs();
  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;

  const lines = [];
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();

    // Group items into rows by (page, rounded y).
    const rows = new Map();
    for (const item of tc.items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const key = `${p}:${y}`;
      if (!rows.has(key)) rows.set(key, { page: p, y, items: [], size: 0 });
      const row = rows.get(key);
      row.items.push({ x: item.transform[4], str: item.str });
      row.size = Math.max(row.size, Math.abs(item.transform[0]) || item.height || 0);
    }

    // Merge near-duplicate rows (sub/superscript jitter within 2px).
    const sortedRows = [...rows.values()].sort((a, b) => b.y - a.y);
    const merged = [];
    for (const row of sortedRows) {
      const last = merged[merged.length - 1];
      if (last && last.page === row.page && Math.abs(last.y - row.y) <= 2) {
        last.items.push(...row.items);
        last.size = Math.max(last.size, row.size);
      } else {
        merged.push(row);
      }
    }

    for (const row of merged) {
      row.items.sort((a, b) => a.x - b.x);
      const text = row.items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      lines.push({
        text,
        page: row.page,
        y: row.y,
        x0: row.items[0].x,
        size: row.size,
      });
    }
  }

  await loadingTask.destroy();
  return lines;
}

// ── Heuristic structure parsing ────────────────────────────────────────

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function looksLikeHeading(line, bodySize) {
  const text = line.text.trim();
  if (text.length > 60) return false;
  const letters = text.replace(/[^a-zA-Z]/g, '');
  // All-caps counts as heading style only for letter-only lines — lines like
  // "GPA: 3.8 / 4.0" are case-neutral and must not qualify.
  const allCaps = letters.length >= 3 && text === text.toUpperCase() && !/\d/.test(text);
  const bigger = line.size >= bodySize + 1.2;
  return (allCaps && line.size >= bodySize) || bigger;
}

function isBulletLine(line, sectionX0) {
  return BULLET_RE.test(line.text) || line.x0 - sectionX0 > 14;
}

function splitDates(text) {
  const range = text.match(DATE_RANGE_RE);
  if (range) {
    return {
      startDate: range[1].trim(),
      endDate: range[2].trim(),
      rest: (text.replace(range[0], '').replace(/[|,·;]\s*$/, '').replace(/^[|,·;]\s*/, '')).trim(),
    };
  }
  const single = text.match(SINGLE_DATE_RE);
  if (single) {
    return { startDate: single[0].trim(), endDate: '', rest: text.replace(single[0], '').trim() };
  }
  return { startDate: '', endDate: '', rest: text.trim() };
}

function parseExperienceEntry(entryLines, sectionX0) {
  const bullets = [];
  const headerLines = [];
  for (const line of entryLines) {
    if (isBulletLine(line, sectionX0) && headerLines.length > 0) {
      bullets.push(line.text.replace(BULLET_RE, '').trim());
    } else {
      headerLines.push(line.text.replace(BULLET_RE, '').trim());
    }
  }
  if (!headerLines.length && !bullets.length) return null;

  // Role comes first; dates may sit on the role or company line.
  let role = headerLines[0] || '';
  let companyLine = headerLines[1] || '';
  const roleDates = splitDates(role);
  role = roleDates.rest || role;
  let startDate = roleDates.startDate;
  let endDate = roleDates.endDate;

  let company = '';
  let location = '';
  if (companyLine) {
    const compDates = splitDates(companyLine);
    if (!startDate) {
      startDate = compDates.startDate;
      endDate = compDates.endDate;
    }
    const parts = compDates.rest.split(/\s+[—–-]\s+/);
    company = (parts[0] || '').trim();
    location = (parts[1] || '').trim();
    if (!location && company.includes(', ')) {
      const segs = company.split(', ').map((s) => s.trim());
      // Treat a trailing short segment as the location ("Acme, Berlin").
      if (segs.length > 1 && segs[segs.length - 1].length <= 24) {
        location = segs.pop();
        company = segs.join(', ');
      }
    }
  }

  // "Role at Company" / "Role | Company" fallbacks.
  if (!company) {
    const at = role.split(/\s+(?:at|@)\s+|\s+\|\s+/i);
    if (at.length === 2) {
      role = at[0].trim();
      company = at[1].trim();
    }
  }

  return {
    type: 'experience',
    name: [role, company].filter(Boolean).join(' — ') || 'Experience',
    fields: {
      role,
      company,
      location,
      startDate,
      endDate,
      description: bullets.map((b) => `• ${b}`).join('\n'),
    },
  };
}

function parseEducationEntry(entryLines, sectionX0) {
  const bullets = [];
  const headerLines = [];
  for (const line of entryLines) {
    if (isBulletLine(line, sectionX0) && headerLines.length > 0) {
      bullets.push(line.text.replace(BULLET_RE, '').trim());
    } else {
      headerLines.push(line.text.replace(BULLET_RE, '').trim());
    }
  }
  if (!headerLines.length) return null;

  const degreeDates = splitDates(headerLines[0] || '');
  const degree = degreeDates.rest || headerLines[0] || '';
  let startDate = degreeDates.startDate;
  let endDate = degreeDates.endDate;

  let institution = '';
  if (headerLines[1]) {
    const instDates = splitDates(headerLines[1]);
    if (!startDate) {
      startDate = instDates.startDate;
      endDate = instDates.endDate;
    }
    institution = instDates.rest.split(/\s+[—–]\s+/)[0].trim();
  }

  let field = '';
  const fieldMatch = degree.match(/(?:in|of)\s+(.+)$/i);
  if (fieldMatch) field = fieldMatch[1].trim();
  const gpaLine = bullets.find((b) => /gpa/i.test(b)) || '';

  return {
    type: 'education',
    name: [degree, institution].filter(Boolean).join(' — ') || 'Education',
    fields: {
      institution,
      degree,
      field,
      startDate,
      endDate,
      gpa: gpaLine,
    },
  };
}

/**
 * Turns extracted lines into { personalInfo, blocks, skippedSections }.
 * blocks items: { type, name, fields }. Empty result ⇒ caller may retry
 * with the AI fallback.
 */
export function parseResumeLines(lines) {
  if (!lines.length) return { personalInfo: {}, blocks: [], skippedSections: [] };

  const bodySize = median(lines.map((l) => l.size)) || 10;

  // Split into segments: a heading starts a new segment; lines before the
  // first heading form the header (contact info) segment.
  const segments = [];
  let current = { title: null, type: null, lines: [] };
  for (const line of lines) {
    const heading = looksLikeHeading(line, bodySize);
    const type = heading ? matchSectionType(line.text.replace(/[:.]+$/, '').trim()) : null;
    // Only *known* headings split segments; unknown big lines stay as content.
    if (heading && (type || line.text.length <= 40)) {
      if (current.lines.length || current.title) segments.push(current);
      current = { title: line.text.replace(/[:.]+$/, '').trim(), type, lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.length || current.title) segments.push(current);

  // Personal info from the header segment (before the first typed section).
  // The name itself is often styled as a heading, so include the segment
  // title among the candidate lines.
  const personalInfo = { name: '', email: '', phone: '', location: '' };
  const headerSeg = segments.length && !segments[0].type ? segments[0] : null;
  if (headerSeg) {
    const texts = [headerSeg.title, ...headerSeg.lines.map((l) => l.text)].filter(Boolean);
    personalInfo.name =
      texts.find(
        (t) => !t.includes('@') && !/\d{3}/.test(t) && !/linkedin|github|http/i.test(t) && !BULLET_RE.test(t),
      ) || '';
    const joined = texts.join(' ');
    personalInfo.email = joined.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || '';
    personalInfo.phone = joined.match(/(\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim() || '';
  }

  const blocks = [];
  const skippedSections = [];

  segments.forEach((seg, segIdx) => {
    if (!seg.title) return;
    if (!seg.type || !seg.lines.length) {
      // The header (name/contact) segment before any typed section is not
      // really a skipped section.
      if (seg.lines.length && segIdx > 0) skippedSections.push(seg.title);
      return;
    }
    const sectionX0 = Math.min(...seg.lines.map((l) => l.x0));

    if (seg.type === 'summary') {
      const body = seg.lines.map((l) => l.text).join(' ');
      blocks.push({
        type: 'summary',
        name: `${seg.title}`,
        fields: { headline: personalInfo.name || '', body },
      });
      return;
    }

    if (seg.type === 'skills') {
      const items = [];
      for (const l of seg.lines) {
        const t = l.text.replace(BULLET_RE, '').trim();
        if (!t) continue;
        items.push(...(t.includes(',') ? t.split(',').map((s) => s.trim()).filter(Boolean) : [t]));
      }
      blocks.push({
        type: 'skills',
        name: seg.title,
        fields: { category: seg.title, skills: items.join(', ') },
      });
      return;
    }

    // experience / education: group lines into entries. A new entry starts
    // at a non-bullet line at (near) the section's left edge.
    const entries = [];
    for (const line of seg.lines) {
      const bullet = isBulletLine(line, sectionX0);
      const atEdge = line.x0 - sectionX0 <= 6;
      if (!bullet && atEdge && (!entries.length || entries[entries.length - 1].length > 1)) {
        entries.push([line]);
      } else if (!entries.length) {
        entries.push([line]);
      } else {
        entries[entries.length - 1].push(line);
      }
    }
    const parser = seg.type === 'experience' ? parseExperienceEntry : parseEducationEntry;
    for (const entryLines of entries) {
      const block = parser(entryLines, sectionX0);
      if (block) blocks.push(block);
    }
  });

  return { personalInfo, blocks, skippedSections };
}

// ── AI fallback ────────────────────────────────────────────────────────

/**
 * Sends the raw text to the server for AI-based structuring. Returns the
 * same shape as parseResumeLines. Throws when unavailable.
 */
export async function parseResumeWithAI(text, authHeaders) {
  const res = await fetch('/api/import-resume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ text: text.slice(0, 24000) }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'AI import failed');
  const data = await res.json();
  return {
    personalInfo: data.personalInfo || {},
    blocks: Array.isArray(data.blocks) ? data.blocks : [],
    skippedSections: [],
  };
}
