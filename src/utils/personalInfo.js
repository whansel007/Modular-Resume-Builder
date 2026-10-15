// Helper functions for personalInfo with ordered fields (min length 3)

export const DEFAULT_FIELD_SUGGESTIONS = [
  'Email',
  'Phone',
  'LinkedIn',
  'GitHub',
  'Portfolio',
  'Website',
  'Location',
  'Twitter',
];

export function createDefaultFields() {
  return [
    { id: 'f-email', label: 'Email', value: '', url: '' },
    { id: 'f-phone', label: 'Phone', value: '', url: '' },
    { id: 'f-linkedin', label: 'LinkedIn', value: '', url: '' },
  ];
}

/**
 * Normalizes user-inputted URLs or contact links (e.g. "github.com/john" -> "https://github.com/john").
 */
export function formatContactUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return trimmed;
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return `mailto:${trimmed}`;
  }
  if (/^\+?[0-9\s\-()]{7,}$/.test(trimmed)) {
    return `tel:${trimmed.replace(/\s+/g, '')}`;
  }
  return `https://${trimmed}`;
}

/**
 * Resolves the effective hyperlink URL for a personal info field:
 * 1. Explicit `field.url` attached via the link modal.
 * 2. Auto-detection if `field.value` is a URL, email, domain, or handle.
 * 3. Smart fallback if `field.label` is GitHub, LinkedIn, Website, etc.
 */
export function resolveContactUrl(field) {
  if (!field || typeof field !== 'object') return null;
  const explicitUrl = typeof field.url === 'string' ? field.url.trim() : '';
  if (explicitUrl) {
    return formatContactUrl(explicitUrl);
  }

  const val = typeof field.value === 'string' ? field.value.trim() : '';
  if (!val) return null;

  // If already starts with a protocol
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(val)) {
    return val;
  }

  // Email address
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
    return `mailto:${val}`;
  }

  // Known domains or web URLs (e.g. github.com/user, linkedin.com/in/user, www.site.com, etc.)
  if (/^(https?:\/\/)?(www\.)?(github\.com|linkedin\.com|gitlab\.com|twitter\.com|x\.com|behance\.net|dribbble\.com|medium\.com)\/.+/i.test(val)) {
    return formatContactUrl(val);
  }
  if (/^(www\.)?[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(\/[^\s]*)?$/i.test(val) && !val.includes(' ') && val.includes('.')) {
    return formatContactUrl(val);
  }

  // Label-based inference when value is a clean handle/username (no spaces)
  const label = (field.label || '').toLowerCase().trim();
  if (label === 'github' && !val.includes(' ') && !val.startsWith('http')) {
    const clean = val.replace(/^@/, '');
    return `https://github.com/${clean}`;
  }
  if (label === 'linkedin' && !val.includes(' ') && !val.startsWith('http')) {
    const clean = val.replace(/^@/, '').replace(/^in\//, '');
    return `https://www.linkedin.com/in/${clean}`;
  }
  if (label === 'email' && !val.startsWith('mailto:') && val.includes('@')) {
    return `mailto:${val}`;
  }

  return null;
}

/**
 * Ensures personalInfo has a name and an ordered fields array with at least 3 items.
 * Backward compatible with older { name, email, phone, location } structures.
 */
export function normalizePersonalInfo(info) {
  if (!info || typeof info !== 'object') {
    return {
      name: '',
      email: '',
      phone: '',
      linkedin: '',
      fields: createDefaultFields(),
    };
  }

  const name = typeof info.name === 'string' ? info.name : '';
  let fields = [];

  if (Array.isArray(info.fields) && info.fields.length > 0) {
    fields = info.fields.map((f, idx) => ({
      id: f.id || `f-${idx + 1}`,
      label: typeof f.label === 'string' ? f.label : `Field ${idx + 1}`,
      value: typeof f.value === 'string' ? f.value : '',
      url: typeof f.url === 'string' ? f.url.trim() : (typeof f.link === 'string' ? f.link.trim() : ''),
    }));
  } else {
    // Migrate legacy flat properties
    const thirdVal = typeof info.linkedin === 'string' && info.linkedin ? info.linkedin : (typeof info.location === 'string' ? info.location : '');
    const thirdLabel = typeof info.linkedin === 'string' && info.linkedin ? 'LinkedIn' : (typeof info.location === 'string' && info.location ? 'Location' : 'LinkedIn');
    fields = [
      { id: 'f-email', label: 'Email', value: typeof info.email === 'string' ? info.email : '', url: '' },
      { id: 'f-phone', label: 'Phone', value: typeof info.phone === 'string' ? info.phone : '', url: '' },
      { id: 'f-linkedin', label: thirdLabel, value: thirdVal, url: '' },
    ];
  }

  // Ensure minimum length of 3 fields
  while (fields.length < 3) {
    const existingLabels = new Set(fields.map((f) => f.label.toLowerCase()));
    const nextLabel =
      DEFAULT_FIELD_SUGGESTIONS.find((l) => !existingLabels.has(l.toLowerCase())) ||
      `Field ${fields.length + 1}`;
    fields.push({
      id: `f-${fields.length + 1}`,
      label: nextLabel,
      value: '',
      url: '',
    });
  }

  const email = fields.find((f) => f.label.toLowerCase() === 'email')?.value || fields[0]?.value || '';
  const phone = fields.find((f) => f.label.toLowerCase() === 'phone')?.value || fields[1]?.value || '';
  const linkedin =
    fields.find((f) => f.label.toLowerCase() === 'linkedin')?.value || fields[2]?.value || '';

  return {
    ...info,
    name,
    email,
    phone,
    linkedin,
    fields,
  };
}
