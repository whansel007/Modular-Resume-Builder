// Popup logic for Copy Job Description — Modular Resume Builder.
// The popup grabs the job description from the active LinkedIn tab via
// chrome.scripting, copies it to the clipboard, and shows a preview.
// This avoids depending on LinkedIn's ever-changing page markup for a
// persistent injected button — extraction runs on demand instead.

// Runs INSIDE the LinkedIn page (serialized by chrome.scripting, so it
// must be fully self-contained).
//
// LinkedIn's new flagship app hashes all class names (e.g. `_97c95f89`)
// and changes them on every release, so class-based selectors are
// inherently fragile. Instead we search structurally:
//   Tier 1: legacy exact selectors (classic jobs pages still use them).
//   Tier 2: prose analysis — find the largest article-like text block,
//           preferring blocks near the company-name heading.
function extractJobDescription() {
  // Expand collapsed "Show more" sections first.
  document
    .querySelectorAll('[aria-expanded="false"]')
    .forEach((b) => {
      const label = ((b.textContent || '') + ' ' + (b.getAttribute('aria-label') || '')).toLowerCase();
      if (label.includes('show more') || label.includes('see more')) {
        try {
          b.click();
        } catch {
          /* ignore */
        }
      }
    });

  const clean = (text) =>
    (text || '')
      .trim()
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^(show more|see more)\b.*$/im, '')
      .trim();

  const PROSE_MARKERS = [
    'responsibilities',
    'qualifications',
    'requirements',
    'about the job',
    'about the role',
    'what you',
    'you will',
    "you'll",
    'we are looking',
    'we’re looking',
    'experience with',
    'benefits',
    'skills',
  ];

  const proseScore = (text) => {
    const lower = text.toLowerCase();
    let score = 0;
    for (const m of PROSE_MARKERS) {
      if (lower.includes(m)) score += 1;
    }
    // Bullet-like or sentence-like lines are a strong prose signal.
    const lines = text.split('\n').filter((l) => l.trim().length > 20);
    score += Math.min(lines.length, 20) / 4;
    return score;
  };

  const candidates = [];

  // Tier 1: legacy LinkedIn selectors (classic job pages).
  const known = [
    '.jobs-description__content',
    '.jobs-description .show-more-less-html__markup',
    '.jobs-description',
    '#job-details',
    '[class*="jobs-description" i]',
    '[class*="job-description" i]',
  ];
  for (const sel of known) {
    try {
      document.querySelectorAll(sel).forEach((el) => candidates.push({ el, tier: 1 }));
    } catch {
      /* invalid selector */
    }
  }

  // Tier 2: structural prose scan (works on the hashed-class flagship app).
  const seen = new Set();
  document
    .querySelectorAll('article, section, main, div')
    .forEach((el) => {
      if (el.childElementCount < 2) return; // prose blocks have structure
      // Cheap gates before touching innerText (which forces layout):
      const raw = el.textContent || '';
      if (raw.length < 300 || raw.length > 40000) return;
      const text = clean(el.innerText || '');
      if (text.length < 300 || seen.has(text)) return;
      seen.add(text);
      candidates.push({ el, tier: 2, text });
    });

  // Anchor: the job/company headline, used to prefer blocks near it.
  let headingPos = -1;
  const h = document.querySelector('h1');
  if (h) headingPos = h.getBoundingClientRect().top + window.scrollY;

  let best = null;
  const scored = [];
  for (const cand of candidates) {
    const text = cand.text || clean(cand.el.innerText || cand.el.textContent || '');
    if (text.length < 300) continue;
    let score = Math.min(text.length, 5000) / 100 + proseScore(text) * 10;
    if (cand.tier === 1) score += 5000; // legacy exact hit always wins
    if (headingPos >= 0) {
      const r = cand.el.getBoundingClientRect();
      const elTop = r.top + window.scrollY;
      if (elTop >= headingPos - 100) score += 500; // below the headline
    }
    scored.push({ el: cand.el, text, score });
  }

  // Prefer innermost blocks: drop any candidate that wraps another strong
  // candidate, so page-level containers (which include nav/meta noise)
  // lose to the description block itself.
  const finalists = scored.filter(
    (a) => !scored.some((b) => b !== a && a.el.contains(b.el) && b.score >= a.score * 0.75)
  );
  finalists.sort((a, b) => b.score - a.score);
  best = finalists[0];

  // A real JD is long AND reads like prose; reject nav/sidebar noise.
  if (!best || best.text.length < 400 || proseScore(best.text) < 1) return '';

  // Also grab the job title for naming the new resume.
  const titleSource =
    (document.querySelector('h1') && document.querySelector('h1').innerText) ||
    document.title ||
    '';
  const title = titleSource
    .replace(/\s*[|·–—-]\s*LinkedIn.*$/i, '')
    .trim();

  return { text: best.text, title };
}

const statusEl = () => document.getElementById('status');
const previewEl = () => document.getElementById('preview');

function setStatus(message, kind) {
  const el = statusEl();
  el.textContent = message;
  el.className = 'status ' + (kind || '');
  el.hidden = !message;
}

async function grabFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https:\/\/(www\.)?linkedin\.com\//.test(tab.url || '')) {
    const err = new Error('Open a LinkedIn job posting first, then try again.');
    err.kind = 'not-linkedin';
    throw err;
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractJobDescription,
  });
  const data = results && results[0] && results[0].result;
  const text = typeof data === 'string' ? data : data && data.text;
  if (!text) {
    const err = new Error(
      'No job description found on this page. Make sure a job is open and the description is visible.'
    );
    err.kind = 'not-found';
    throw err;
  }
  return { text, title: (data && data.title) || '' };
}

async function copyFromActiveTab() {
  const grabBtn = document.getElementById('grab');
  grabBtn.disabled = true;
  setStatus('Reading job description…', 'busy');
  previewEl().hidden = true;

  try {
    const { text } = await grabFromActiveTab();

    await navigator.clipboard.writeText(text);
    setStatus(`Copied ${text.length.toLocaleString()} characters — paste into the Resume Builder!`, 'ok');

    const preview = previewEl();
    preview.value = text.length > 1200 ? text.slice(0, 1200) + '\n…' : text;
    preview.hidden = false;
  } catch (err) {
    setStatus(err.message || 'Could not read the page. Reload the LinkedIn tab and retry.', 'error');
  } finally {
    grabBtn.disabled = false;
  }
}

// One-click pipeline: grab the JD from LinkedIn, then open the Resume
// Builder with a deep link. The app creates a fresh resume, pastes the JD,
// extracts keywords, and auto-fills — no manual steps.
const BUILDER_ORIGIN = 'https://modular-resume-builder-iota.vercel.app';

async function openInBuilder() {
  const btn = document.getElementById('open-builder');
  btn.disabled = true;
  setStatus('Reading job description…', 'busy');
  previewEl().hidden = true;

  try {
    const { text, title } = await grabFromActiveTab();

    const url =
      `${BUILDER_ORIGIN}/builder?new=true&autofill=1` +
      `&t=${encodeURIComponent(title || 'LinkedIn Job')}` +
      `&jd=${encodeURIComponent(text)}`;

    if (url.length > 200000) {
      throw new Error('This job description is too long to hand off. Use "Copy JD" and paste manually.');
    }

    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
    setStatus('Opening Resume Builder — your resume is being auto-filled…', 'ok');
    setTimeout(() => window.close(), 900);
  } catch (err) {
    setStatus(err.message || 'Could not read the page. Reload the LinkedIn tab and retry.', 'error');
  } finally {
    btn.disabled = false;
  }
}

document.getElementById('grab').addEventListener('click', copyFromActiveTab);
document.getElementById('open-builder').addEventListener('click', openInBuilder);

document.getElementById('open-jobs').addEventListener('click', () => {
  const url = 'https://www.linkedin.com/jobs/';
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
    chrome.tabs.create({ url });
  } else {
    window.open(url, '_blank');
  }
  window.close();
});
