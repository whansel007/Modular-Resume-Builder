// PDF resume import: extracts text lines with layout info via pdfjs, then
// heuristically splits them into sections and blocks. Falls back to the AI
// endpoint when the layout defeats the heuristics (see ImportModal).

const BULLET_RE = /^[•▪◦‣∙·●○■□◘\-\*\u2022\u2013]\s*/;
const DATE_RANGE_RE =
  /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4})\s*(?:–|—|-|to|until)\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4}|Present|Current|Now|Today)/i;
const SINGLE_DATE_RE =
  /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\b(19|20)\d{2}\b/;

const URL_RE =
  /(https?:\/\/[^\s|,;)]+|www\.[^\s|,;)]+|(?:github|gitlab|bitbucket)\.com\/[^\s|,;)]+|linkedin\.com\/[^\s|,;)]+)/i;

function firstUrl(...sources) {
  for (const source of sources) {
    if (!source) continue;
    const candidates = Array.isArray(source) ? source : [source];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const match = String(candidate).match(URL_RE);
      if (match) return match[0].replace(/[.,;]+$/, '');
    }
  }
  return '';
}

const ROLE_KEYWORDS_RE = /(?:developer|engineer|tutor|producer|executive|member|founder|manager|intern|analyst|assistant|lead|coordinator|president|director|consultant|specialist|officer|writer|designer|representative|educator|instructor|head|fellow|partner|technician|practitioner|student|candidate|volunteer)/i;

// Section header → block type. Anything unmatched is reported as skipped.
const SECTION_PATTERNS = [
  { type: 'summary', re: /^(professional\s+)?(summary|profile|objective|about(\s+me)?|personal\s+statement)$/i },
  { type: 'experience', re: /^((work|professional|employment|relevant)\s+)?(experience|history)$/i },
  { type: 'experience', re: /^employment$/i },
  { type: 'projects', re: /^(projects|personal\s+projects|academic\s+projects|key\s+projects|technical\s+projects|projects?\s+experience)$/i },
  { type: 'activities', re: /^(co-curricular\s+activities|extracurricular\s+activities|co-curriculars|extracurriculars|activities|activity|volunteering|volunteer\s+experience|community\s+service|leadership(\s+experience)?|involvement|organizations|affiliations|cca)$/i },
  { type: 'education', re: /^(education(al)?(\s+history)?|academics?)$/i },
  { type: 'skills', re: /^((technical|core|key|relevant)\s+)?(skills|competenc(y|ies)|technologies|tools)(\s*(and|&)\s*interests?)?$/i },
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

  let documentTitle = '';
  try {
    const meta = await doc.getMetadata();
    documentTitle = (meta?.info?.Title || '').trim();
  } catch {
    documentTitle = '';
  }

  const lines = [];
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();

    const annotations = await page.getAnnotations();
    const linkAnnots = annotations
      .filter((a) => a.subtype === 'Link' && a.url)
      .map((a) => ({
        url: a.url,
        x0: Math.min(a.rect[0], a.rect[2]),
        x1: Math.max(a.rect[0], a.rect[2]),
        y0: Math.min(a.rect[1], a.rect[3]),
        y1: Math.max(a.rect[1], a.rect[3]),
      }));

    // Group items into rows by (page, rounded y).
    const rows = new Map();
    for (const item of tc.items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const key = `${p}:${y}`;
      if (!rows.has(key)) rows.set(key, { page: p, y, items: [], size: 0 });
      const row = rows.get(key);
      row.items.push({ x: item.transform[4], str: item.str, width: item.width || 0 });
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
      const textParts = [];
      for (let i = 0; i < row.items.length; i++) {
        const item = row.items[i];
        if (i > 0 && item.x - row.items[i - 1].x >= 150) {
          textParts.push('|');
        }
        textParts.push(item.str);
      }
      const text = textParts.join(' ').replace(/\s+/g, ' ').replace(/\s*\|\s*/g, ' | ').trim();
      if (!text) continue;
      const linkHits = linkAnnots.filter(
        (a) =>
          row.y >= a.y0 - 2 &&
          row.y <= a.y1 + 2 &&
          row.items.some((it) => it.x >= a.x0 - 6 && it.x <= a.x1 + 6),
      );
      const links = linkHits.map((a) => ({
        url: a.url,
        text: row.items
          .filter((it) => it.x + (it.width || 0) >= a.x0 - 2 && it.x <= a.x1 + 2)
          .map((it) => it.str)
          .join('')
          .replace(/^[\s|·,;:]+|[\s|·,;:]+$/g, '')
          .trim(),
      }));
      const urls = [...new Set(links.map((l) => l.url))];
      lines.push({
        text,
        page: row.page,
        y: row.y,
        x0: row.items[0].x,
        size: row.size,
        url: urls[0] || '',
        urls,
        links,
      });
    }
  }

  await loadingTask.destroy();
  return { lines, title: documentTitle };
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

function splitEntryLines(entryLines, sectionX0) {
  const headerLines = [];
  const bullets = [];
  let inBullets = false;
  for (const line of entryLines) {
    const t = line.text.replace(BULLET_RE, '').trim();
    if (isBulletLine(line, sectionX0) && headerLines.length > 0) {
      inBullets = true;
      bullets.push(t);
    } else if (inBullets && bullets.length) {
      bullets[bullets.length - 1] = `${bullets[bullets.length - 1]} ${t}`.trim();
    } else {
      headerLines.push(t);
    }
  }
  return { headerLines, bullets };
}

function parseExperienceEntry(entryLines, sectionX0, type = 'experience') {
  const { bullets, headerLines } = splitEntryLines(entryLines, sectionX0);
  if (!headerLines.length && !bullets.length) return null;

  let role = '';
  let company = '';
  let location = '';
  let startDate = '';
  let endDate = '';

  // Use gap | separated parsing if the first line contains it
  if (headerLines[0] && headerLines[0].includes('|')) {
    const parts0 = headerLines[0].split('|').map(s => s.trim());
    const parts1 = headerLines[1] ? headerLines[1].split('|').map(s => s.trim()) : [];

    const dates0 = splitDates(parts0[1] || '');
    const dates1 = parts1[0] ? splitDates(parts1[1] || parts1[0]) : null;
    const parts0SecondIsDate = !!(dates0 && (dates0.startDate || dates0.endDate));

    const line0Text = parts0[0] || '';
    const line1Text = parts1[0] || '';
    const line0IsRole = ROLE_KEYWORDS_RE.test(line0Text);
    const line1IsRole = line1Text ? ROLE_KEYWORDS_RE.test(line1Text) : false;

    // The app's export puts the role (or, for projects, the project name) on
    // the first line. Only flip when the second line clearly reads as a role.
    let roleFirst;
    if (type === 'projects') roleFirst = line0IsRole && !line1IsRole;
    else roleFirst = !(line1IsRole && !line0IsRole);

    if (roleFirst) {
      role = line0Text;
      company = line1Text;
    } else {
      role = line1Text;
      company = line0Text;
    }
    location = parts0SecondIsDate ? (parts1[1] || '') : (parts0[1] || '');

    if (dates1 && (dates1.startDate || dates1.endDate)) {
      startDate = dates1.startDate;
      endDate = dates1.endDate;
    } else if (parts0SecondIsDate) {
      startDate = dates0.startDate;
      endDate = dates0.endDate;
    }
  } else {
    // Traditional heuristics
    let rawRole = headerLines[0] || '';
    let companyLine = headerLines[1] || '';
    
    // Check if the order is Company then Role (swapped)
    const firstIsRole = ROLE_KEYWORDS_RE.test(rawRole);
    const secondIsRole = companyLine && ROLE_KEYWORDS_RE.test(companyLine);
    
    if (secondIsRole && !firstIsRole) {
      const compDates = splitDates(rawRole);
      company = compDates.rest;
      startDate = compDates.startDate;
      endDate = compDates.endDate;
      
      const roleDates = splitDates(companyLine);
      role = roleDates.rest;
      if (!startDate) {
        startDate = roleDates.startDate;
        endDate = roleDates.endDate;
      }
      
      // Try to split location from company
      const parts = company.split(/\s*[—–-]\s*/);
      company = (parts[0] || '').trim();
      location = (parts[1] || '').trim();
      if (!location && company.includes(', ')) {
        const segs = company.split(', ').map((s) => s.trim());
        if (segs.length > 1 && segs[segs.length - 1].length <= 24) {
          location = segs.pop();
          company = segs.join(', ');
        }
      }
    } else {
      const roleDates = splitDates(rawRole);
      role = roleDates.rest || rawRole;
      startDate = roleDates.startDate;
      endDate = roleDates.endDate;

      if (companyLine) {
        const compDates = splitDates(companyLine);
        if (!startDate) {
          startDate = compDates.startDate;
          endDate = compDates.endDate;
        }
        const parts = compDates.rest.split(/\s*[—–-]\s*/);
        company = (parts[0] || '').trim();
        location = (parts[1] || '').trim();
        if (!location && company.includes(', ')) {
          const segs = company.split(', ').map((s) => s.trim());
          if (segs.length > 1 && segs[segs.length - 1].length <= 24) {
            location = segs.pop();
            company = segs.join(', ');
          }
        }
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

  // Wrapped lines after role/company are description text — the app's own
  // export writes descriptions as plain paragraphs without bullet glyphs.
  const extra = headerLines.slice(2).map((t) => t.trim()).filter(Boolean);
  let description = bullets.join('\n');
  if (extra.length) {
    const paragraph = extra.join(' ');
    description = description ? `${description}\n${paragraph}` : paragraph;
  }

  let link = firstUrl(
    entryLines.map((l) => l.url),
    entryLines.map((l) => l.text),
  );
  if (
    !link &&
    type === 'projects' &&
    location &&
    (/^https?:\/\//i.test(location) || /^(www\.)?(github\.com|gitlab\.com|bitbucket\.org)/i.test(location))
  ) {
    link = location;
  }

  const defaultLabel = type === 'projects' ? 'Project' : (type === 'activities' || type === 'cca') ? 'Activity' : 'Experience';
  return {
    type,
    name: [role, company].filter(Boolean).join(' — ') || defaultLabel,
    fields: {
      role,
      company,
      link,
      location,
      startDate,
      endDate,
      description,
    },
  };
}

function parseEducationEntry(entryLines, sectionX0) {
  const { bullets, headerLines } = splitEntryLines(entryLines, sectionX0);
  if (!headerLines.length) return null;

  const isGpaLine = (t) => /\bgpa\b\s*:?\s*\d/i.test(t);
  const gpaLines = headerLines.filter(isGpaLine);
  const coreHeaders = headerLines.filter((t) => !isGpaLine(t));
  if (!coreHeaders.length) return null;

  // Either order is possible: "Degree · dates" then "Institution" (classic),
  // or "Institution" then "Degree, Field" (the app's own export).
  const degreeLike = (t) =>
    /(bachelor|master|doctor|ph\.?d|mba|b\.?sc|m\.?sc|b\.?a\b|m\.?a\b|diploma|certificat|degree|coursework)/i.test(t);

  const cleanedHeaders = coreHeaders.map((hl) => hl.replace(/\s*\|\s*/g, ' | '));

  const first = splitDates(cleanedHeaders[0] || '');
  const second = cleanedHeaders[1] ? splitDates(cleanedHeaders[1]) : null;
  const firstDeg = degreeLike(first.rest);
  const secondDeg = second ? degreeLike(second.rest) : false;

  let degree = '';
  let institution = '';
  let location = '';
  let startDate = '';
  let endDate = '';

  const assignInstitution = (text) => {
    const parts = text.split(/\s*[—–|]\s*/);
    institution = (parts[0] || '').trim();
    if (parts[1]) location = parts[1].trim();
  };

  if (second && (secondDeg || (second.startDate && !first.startDate))) {
    assignInstitution(first.rest || cleanedHeaders[0] || '');
    degree = second.rest || cleanedHeaders[1] || '';
    startDate = second.startDate;
    endDate = second.endDate;
  } else if (second && firstDeg) {
    degree = first.rest || cleanedHeaders[0] || '';
    startDate = first.startDate;
    endDate = first.endDate;
    assignInstitution(second.rest);
  } else {
    degree = first.rest || cleanedHeaders[0] || '';
    startDate = first.startDate;
    endDate = first.endDate;
    if (second) assignInstitution(second.rest);
  }

  if (!institution) {
    const dashSplit = degree.split(/\s+[—–]\s+/);
    if (dashSplit.length === 2 && dashSplit[0].trim() && dashSplit[1].trim()) {
      degree = dashSplit[0].trim();
      institution = dashSplit[1].trim();
    }
  }

  // Clean up degree, institution, location trailing/leading pipes
  degree = degree.replace(/[|]\s*$/, '').trim();
  institution = institution.replace(/^[|]\s*/, '').replace(/[|]\s*$/, '').trim();
  location = location.replace(/^[|]\s*/, '').replace(/[|]\s*$/, '').trim();

  let field = '';
  // "Bachelor of Science, Computer Science" (site export) or "BSc in X".
  const commaField = degree.match(/^([A-Za-z.\s]+?(?:of|in)\s+[A-Za-z\s]+?)\s*,\s*(.+)$/i);
  if (commaField) {
    field = commaField[2].trim();
    degree = commaField[1].trim();
  } else {
    const fieldMatch = degree.match(/(?:in|of)\s+(.+)$/i);
    if (fieldMatch) field = fieldMatch[1].trim();
  }
  // GPA may sit in a bullet or a plain follow-up line (the app's export).
  // "GPA" followed by a digit — excludes credential lines like "Credential ID".
  const detailLines = [...bullets, ...gpaLines, ...cleanedHeaders.slice(2)];
  const gpaLine = detailLines.find((b) => /\bgpa\b\s*:?\s*\d/i.test(b)) || '';
  const link = firstUrl(
    entryLines.map((l) => l.url),
    entryLines.map((l) => l.text),
  );

  return {
    type: 'education',
    name: [degree, institution].filter(Boolean).join(' — ') || 'Education',
    fields: {
      institution,
      degree,
      field,
      location,
      startDate,
      endDate,
      gpa: gpaLine,
      link,
    },
  };
}

function subheadingLike(line, bodySize) {
  const t = line.text.trim();
  return t.length > 0 && t.length <= 60 && line.size >= bodySize + 0.2;
}

function buildSummaryBlock(lines, title, bodySize) {
  const segLines = [...lines];
  let name = title || '';
  if (segLines.length && subheadingLike(segLines[0], bodySize)) {
    name = segLines.shift().text;
  }
  const body = segLines.map((l) => l.text).join(' ');
  return { type: 'summary', name, fields: { headline: name, body } };
}

function buildSkillsBlock(lines, title, bodySize) {
  const items = [];
  const headingLines = lines.filter((l) => subheadingLike(l, bodySize));

  if (headingLines.length) {
    let currentCat = '';
    let currentSkills = [];
    const flush = () => {
      if (currentCat || currentSkills.length) {
        items.push({ category: currentCat, skills: currentSkills.join(', ') });
      }
      currentCat = '';
      currentSkills = [];
    };
    for (const l of lines) {
      if (subheadingLike(l, bodySize)) {
        flush();
        currentCat = l.text.trim();
      } else {
        const raw = l.text.replace(BULLET_RE, '').trim();
        if (!raw) continue;
        const parts = raw.includes(',') ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [raw];
        currentSkills.push(...parts);
      }
    }
    flush();
  } else {
    for (const l of lines) {
      const raw = l.text.replace(BULLET_RE, '').trim();
      if (!raw) continue;
      const colonIdx = raw.indexOf(':');
      if (colonIdx > 0 && colonIdx <= 45) {
        const cat = raw.slice(0, colonIdx).trim();
        const val = raw.slice(colonIdx + 1).trim();
        if (cat && val) {
          items.push({ category: cat, skills: val });
          continue;
        }
      }
      items.push({ category: '', skills: raw });
    }
  }

  if (!items.length) items.push({ category: '', skills: '' });

  const flatSkills = items
    .filter((i) => i.category || i.skills)
    .map((i) => (i.category ? `${i.category}: ${i.skills}` : i.skills))
    .join('\n');

  return {
    type: 'skills',
    name: title || 'Technical Skills',
    fields: {
      category: items[0]?.category || title || 'Skills',
      skills: flatSkills,
      items,
    },
  };
}

function groupEntries(lines, sectionX0) {
  const sizes = lines.map((l) => l.size);
  const headingSize = Math.max(...sizes);
  const bodySizeInSec = median(sizes);
  const useSizeGrouping = headingSize >= bodySizeInSec + 0.3;
  const entries = [];
  if (useSizeGrouping) {
    for (const line of lines) {
      if (line.size >= headingSize - 0.2 || !entries.length) entries.push([line]);
      else entries[entries.length - 1].push(line);
    }
  } else {
    for (const line of lines) {
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
  }
  return entries;
}

function isContactLine(text) {
  return (
    /@/.test(text) ||
    /https?:\/\//i.test(text) ||
    /(?:linkedin|github)\.com/i.test(text) ||
    /\+?\d[\d\s().-]{6,}\d/.test(text)
  );
}

function stripLeadingHeader(lines, name) {
  let i = 0;
  if (i < lines.length && name && lines[i].text.trim() === name) i += 1;
  while (i < lines.length && i < 4 && isContactLine(lines[i].text)) i += 1;
  return lines.slice(i);
}

function classifyUntitledEntry(entryLines, sectionX0) {
  const text = entryLines.map((l) => l.text).join(' ').trim();
  const joined = text.toLowerCase();
  const hasBullets = entryLines.some((l) => isBulletLine(l, sectionX0));
  const hasDates = entryLines.some((l) => DATE_RANGE_RE.test(l.text) || SINGLE_DATE_RE.test(l.text));
  const hasLink =
    entryLines.some((l) => l.url) ||
    /https?:\/\/|(?:www\.)?(?:github|gitlab|bitbucket|linkedin)\.com/i.test(text);

  if (
    !hasBullets &&
    /(bachelor|master|doctor|ph\.?d|mba|b\.?sc|m\.?sc|b\.?a\b|m\.?a\b|diploma|certificate|degree|university|college|institute|polytechnic|academy|gpa)/i.test(text)
  ) {
    return 'education';
  }

  const colonLines = entryLines.filter((l) => /^[^:]{1,45}:\s*\S/.test(l.text.trim()));
  if (
    !hasDates &&
    !hasBullets &&
    colonLines.length >= 1 &&
    entryLines.every((l) => l.text.trim().length <= 90)
  ) {
    return 'skills';
  }

  if (
    hasLink &&
    /(github|gitlab|bitbucket|project|portfolio|built|developed|created|maintain|open[\s-]?source)/i.test(joined)
  ) {
    return 'projects';
  }

  if (
    /(volunteer|club|society|committee|president|vice president|captain|officer|organization|association|community service|extracurricular|leadership|sports team|chapter)/i.test(joined)
  ) {
    return 'activities';
  }

  if (!hasDates && !hasBullets && !hasLink && text.split(/\s+/).length >= 12) {
    return 'summary';
  }

  return 'experience';
}

const SKILL_VERB_RE =
  /^(led|built|developed|managed|created|designed|improved|increased|reduced|implemented|launched|owned|drove|spearheaded|collaborated|mentored|responsible|responsibilities|oversaw|coordinated|analyzed|delivered|achieved)\b/i;

const NON_SKILL_LABEL_RE =
  /^(gpa|grade|credential|id|date|dates|location|email|phone|address|award|honou?r|duration)$/i;

function isSkillsCategoryLine(line) {
  const t = line.text.replace(BULLET_RE, '').trim();
  const m = t.match(/^([^:]{1,42}):\s*(.+)$/);
  if (!m) return false;
  const label = m[1].trim();
  const value = m[2].trim();
  if (!label || label.split(/\s+/).length > 4) return false;
  if (NON_SKILL_LABEL_RE.test(label)) return false;
  if (value.length > 80) return false;
  if (SKILL_VERB_RE.test(value)) return false;
  return true;
}

function parseUntitledLines(lines, blocks, bodySize) {
  if (!lines.length) return;
  const startIndex = blocks.length;

  const chunks = [];
  let skillRun = null;
  for (const line of lines) {
    if (isSkillsCategoryLine(line)) {
      if (!skillRun) {
        skillRun = [];
        chunks.push({ skills: true, lines: skillRun });
      }
      skillRun.push(line);
    } else {
      skillRun = null;
      const last = chunks[chunks.length - 1];
      if (last && !last.skills) last.lines.push(line);
      else chunks.push({ skills: false, lines: [line] });
    }
  }

  for (const chunk of chunks) {
    if (chunk.skills) {
      blocks.push(buildSkillsBlock(chunk.lines, '', bodySize));
      continue;
    }
    const sectionX0 = Math.min(...chunk.lines.map((l) => l.x0));
    const entries = groupEntries(chunk.lines, sectionX0);
    for (const entryLines of entries) {
      const type = classifyUntitledEntry(entryLines, sectionX0);
      if (type === 'skills') {
        blocks.push(buildSkillsBlock(entryLines, '', bodySize));
        continue;
      }
      if (type === 'summary') {
        blocks.push(buildSummaryBlock(entryLines, '', bodySize));
        continue;
      }
      if (type === 'education') {
        const block = parseEducationEntry(entryLines, sectionX0);
        if (block) blocks.push(block);
        continue;
      }
      const block = parseExperienceEntry(entryLines, sectionX0, type);
      if (block) blocks.push(block);
    }
  }

  for (let i = startIndex; i < blocks.length; i += 1) {
    blocks[i].headerless = true;
  }
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
    // Known section titles always split, regardless of styling — the app's
    // own PDF export renders them as small all-caps labels (9pt) above
    // larger entry titles, which defeats the font-size heading heuristic.
    const type = matchSectionType(line.text.replace(/[:.]+$/, '').trim());
    const heading = type !== null || looksLikeHeading(line, bodySize);
    // Only *known* headings split segments; unknown big lines stay as content.
    if (heading && (type || line.text.length <= 40)) {
      // "SUMMARY" immediately followed by a styled "Professional Summary"
      // (site export): keep the inner, more descriptive title instead of
      // opening an empty second segment of the same type.
      if (current.title && current.type && current.type === type && !current.lines.length) {
        current.title = line.text.replace(/[:.]+$/, '').trim();
      } else {
        if (current.lines.length || current.title) segments.push(current);
        current = { title: line.text.replace(/[:.]+$/, '').trim(), type, lines: [] };
      }
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
    personalInfo.phone = joined.match(/(\(?\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim() || '';

    const annotLinks = headerSeg.lines
      .flatMap((l) =>
        Array.isArray(l.links) && l.links.length
          ? l.links
          : Array.isArray(l.urls) && l.urls.length
            ? l.urls.map((url) => ({ url, text: '' }))
            : l.url
              ? [{ url: l.url, text: '' }]
              : [],
      )
      .filter((lk) => lk.url && !/^(mailto|tel):/i.test(lk.url));
    const seenLinks = new Set();
    const headerLinks = [];
    for (const lk of annotLinks) {
      if (seenLinks.has(lk.url)) continue;
      seenLinks.add(lk.url);
      headerLinks.push(lk);
    }
    for (const t of texts) {
      const u = firstUrl(t);
      if (u && !seenLinks.has(u)) {
        seenLinks.add(u);
        headerLinks.push({ url: u, text: '' });
      }
    }
    if (headerLinks.length) {
      personalInfo.fields = [
        { id: 'f-email', label: 'Email', value: personalInfo.email, url: '' },
        { id: 'f-phone', label: 'Phone', value: personalInfo.phone, url: '' },
        ...headerLinks.slice(0, 4).map((lk, i) => ({
          id: `f-url-${i}`,
          label: /linkedin\.com/i.test(lk.url)
            ? 'LinkedIn'
            : /github\.com/i.test(lk.url)
              ? 'GitHub'
              : 'Website',
          value: lk.text || lk.url,
          url: lk.url,
        })),
      ];
    }
  }

  const blocks = [];
  const skippedSections = [];

  segments.forEach((seg, segIdx) => {
    if (!seg.type) {
      const isHeader = segIdx === 0;
      const untitledLines = isHeader
        ? stripLeadingHeader(seg.lines, personalInfo.name)
        : seg.lines;
      const substantial =
        untitledLines.length >= 2 ||
        untitledLines.some(
          (l) => DATE_RANGE_RE.test(l.text) || SINGLE_DATE_RE.test(l.text) || BULLET_RE.test(l.text),
        );
      if (untitledLines.length && (!isHeader || substantial)) {
        const before = blocks.length;
        parseUntitledLines(untitledLines, blocks, bodySize);
        if (blocks.length === before && seg.title) skippedSections.push(seg.title);
      } else if (seg.lines.length && segIdx > 0 && seg.title) {
        skippedSections.push(seg.title);
      }
      return;
    }

    if (!seg.lines.length && seg.type !== 'summary') return;
    const sectionX0 = Math.min(...seg.lines.map((l) => l.x0));

    if (seg.type === 'summary') {
      blocks.push(buildSummaryBlock(seg.lines, seg.title, bodySize));
      return;
    }

    if (seg.type === 'skills') {
      blocks.push(buildSkillsBlock(seg.lines, seg.title, bodySize));
      return;
    }

    // experience / education: group lines into entries. Prefer the export's
    // own signal — entry titles render larger than their detail lines — and
    // fall back to indentation/bullets for freeform resumes.
    const entries = groupEntries(seg.lines, sectionX0);
    const isExpLike = seg.type === 'experience' || seg.type === 'projects' || seg.type === 'activities' || seg.type === 'cca';
    for (const entryLines of entries) {
      const block = isExpLike
        ? parseExperienceEntry(entryLines, sectionX0, seg.type)
        : parseEducationEntry(entryLines, sectionX0);
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
