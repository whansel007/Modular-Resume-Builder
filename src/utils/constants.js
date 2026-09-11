// Owner identifier — will be replaced by real auth later
export const DEFAULT_OWNER = 'kit@catship.nya';

export const SECTION_TYPES = [
  { key: 'summary', label: 'Summary' },
  { key: 'experience', label: 'Experience' },
  { key: 'projects', label: 'Projects' },
  { key: 'activities', label: 'Activities' },
  { key: 'education', label: 'Education' },
  { key: 'skills', label: 'Skills' },
];

// Description is stored as an array of bullet strings; legacy string values
// (newline-separated) are joined the same way for display.
export function concatDescription(desc) {
  if (Array.isArray(desc)) return desc.join('\n');
  return desc || '';
}

export const BLOCK_SCHEMA = {
  summary: {
    label: 'Summary',
    fields: [
      { name: 'headline', label: 'Headline', placeholder: 'e.g. Senior Software Engineer', type: 'text' },
      { name: 'body', label: 'Summary', placeholder: 'Write a concise overview of your background, core strengths, and career focus...', type: 'textarea' },
    ],
    render: (b) => ({
      title: b.headline || 'Professional Summary',
      body: b.body || '',
    }),
  },
  experience: {
    label: 'Experience',
    fields: [
      { name: 'company', label: 'Company', placeholder: 'e.g. Google or Stripe', type: 'text' },
      { name: 'role', label: 'Role', placeholder: 'e.g. Senior Software Engineer', type: 'text' },
      { name: 'location', label: 'Location', placeholder: 'e.g. San Francisco, CA or Remote', type: 'text' },
      { name: 'startDate', label: 'Start Date', placeholder: 'e.g. Jan 2021', type: 'text' },
      { name: 'endDate', label: 'End Date', placeholder: 'e.g. Present or Dec 2023', type: 'text' },
      { name: 'description', label: 'Description', placeholder: 'Key responsibilities, achievements, and impact...', type: 'textarea' },
    ],
    render: (b) => ({
      title: b.role || 'Role',
      subtitle: b.company || '',
      location: b.location || '',
      dates: `${b.startDate || ''}${b.startDate && b.endDate ? ' – ' : ''}${b.endDate || ''}`,
      body: concatDescription(b.description),
    }),
  },
  projects: {
    label: 'Projects',
    fields: [
      { name: 'company', label: 'Project Name', placeholder: 'e.g. Open-Source Markdown Engine', type: 'text' },
      { name: 'role', label: 'Role', placeholder: 'e.g. Creator & Maintainer', type: 'text' },
      { name: 'link', label: 'Project Link', placeholder: 'e.g. https://github.com/username/project', type: 'text' },
      { name: 'location', label: 'Location', placeholder: 'e.g. Remote or San Francisco, CA', type: 'text' },
      { name: 'startDate', label: 'Start Date', placeholder: 'e.g. 2022 or Jan 2022', type: 'text' },
      { name: 'endDate', label: 'End Date', placeholder: 'e.g. Present or Dec 2023', type: 'text' },
      { name: 'description', label: 'Description', placeholder: 'Describe your contributions, tech stack, and impact...', type: 'textarea' },
    ],
    render: (b) => {
      let projectName = (b.company || '').trim();
      let role = (b.role || '').trim();

      // Check for markdown link syntax [Name](URL) in either field
      let extractedLink = '';
      const mdMatchCompany = typeof projectName === 'string' ? projectName.match(/^\[(.*?)\]\((.*?)\)$/) : null;
      if (mdMatchCompany) {
        projectName = mdMatchCompany[1];
        extractedLink = mdMatchCompany[2];
      }
      const mdMatchRole = typeof role === 'string' ? role.match(/^\[(.*?)\]\((.*?)\)$/) : null;
      if (mdMatchRole) {
        role = mdMatchRole[1];
        if (!extractedLink) extractedLink = mdMatchRole[2];
      }

      // Role keyword check to handle inverted legacy data (where role was stored in company and project name in role)
      const ROLE_KEYWORDS = /^(creator|maintainer|developer|lead|author|contributor|architect|engineer|founder|co-founder|designer|manager|owner|member|president|officer)\b/i;
      if (ROLE_KEYWORDS.test(projectName) && !ROLE_KEYWORDS.test(role) && role) {
        const temp = projectName;
        projectName = role;
        role = temp;
      } else if (!projectName && role) {
        projectName = role;
        role = '';
      }

      const explicitLink = (b.link || b.url || b.headerUrl || extractedLink || '').trim();
      const isLocationUrl = b.location && (
        /^https?:\/\//i.test(b.location.trim()) ||
        /^(www\.)?(github\.com|linkedin\.com|gitlab\.com|bitbucket\.org)/i.test(b.location.trim())
      );

      const effectiveLink = explicitLink || (isLocationUrl ? b.location.trim() : '');

      return {
        title: projectName || 'Project Name',
        subtitle: role,
        location: b.location || '',
        link: effectiveLink,
        dates: `${b.startDate || ''}${b.startDate && b.endDate ? ' – ' : ''}${b.endDate || ''}`,
        body: concatDescription(b.description),
      };
    },
  },
  activities: {
    label: 'Activities',
    fields: [
      { name: 'role', label: 'Role', placeholder: 'e.g. President or Volunteer Lead', type: 'text' },
      { name: 'company', label: 'Organization', placeholder: 'e.g. University Computing Society', type: 'text' },
      { name: 'location', label: 'Location', placeholder: 'e.g. Campus Chapter or Boston, MA', type: 'text' },
      { name: 'startDate', label: 'Start Date', placeholder: 'e.g. 2021', type: 'text' },
      { name: 'endDate', label: 'End Date', placeholder: 'e.g. 2023 or Present', type: 'text' },
      { name: 'description', label: 'Description', placeholder: 'Leadership responsibilities, events organized, impact...', type: 'textarea' },
    ],
    render: (b) => ({
      title: b.role || 'Role',
      subtitle: b.company || '',
      location: b.location || '',
      dates: `${b.startDate || ''}${b.startDate && b.endDate ? ' – ' : ''}${b.endDate || ''}`,
      body: concatDescription(b.description),
    }),
  },
  cca: {
    label: 'Activities',
    fields: [
      { name: 'role', label: 'Role', placeholder: 'e.g. Captain or Committee Head', type: 'text' },
      { name: 'company', label: 'Organization', placeholder: 'e.g. Varsity Debate Team', type: 'text' },
      { name: 'location', label: 'Location', placeholder: 'e.g. Campus Chapter', type: 'text' },
      { name: 'startDate', label: 'Start Date', placeholder: 'e.g. 2021', type: 'text' },
      { name: 'endDate', label: 'End Date', placeholder: 'e.g. 2023 or Present', type: 'text' },
      { name: 'description', label: 'Description', placeholder: 'Key accomplishments, competitions, activities...', type: 'textarea' },
    ],
    render: (b) => ({
      title: b.role || 'Role',
      subtitle: b.company || '',
      location: b.location || '',
      dates: `${b.startDate || ''}${b.startDate && b.endDate ? ' – ' : ''}${b.endDate || ''}`,
      body: concatDescription(b.description),
    }),
  },
  education: {
    label: 'Education',
    fields: [
      { name: 'institution', label: 'Institution', placeholder: 'e.g. State University', type: 'text' },
      { name: 'degree', label: 'Degree', placeholder: 'e.g. Bachelor of Science', type: 'text' },
      { name: 'field', label: 'Field of Study', placeholder: 'e.g. Computer Science', type: 'text' },
      { name: 'location', label: 'Location', placeholder: 'e.g. Berkeley, CA', type: 'text' },
      { name: 'startDate', label: 'Start Date', placeholder: 'e.g. 2018', type: 'text' },
      { name: 'endDate', label: 'End Date', placeholder: 'e.g. 2022', type: 'text' },
      { name: 'gpa', label: 'GPA', placeholder: "e.g. 3.8 / 4.0 or Dean's List", type: 'text' },
    ],
    render: (b) => ({
      title: b.institution || 'Institution',
      subtitle: `${b.degree || ''}${b.degree && b.field ? ', ' : ''}${b.field || ''}`,
      location: b.location || '',
      dates: `${b.startDate || ''}${b.startDate && b.endDate ? ' – ' : ''}${b.endDate || ''}`,
      body: b.gpa || '',
    }),
  },
  skills: {
    label: 'Skills',
    fields: [
      { name: 'category', label: 'Category', placeholder: 'e.g. Languages & Frameworks', type: 'text' },
      { name: 'skills', label: 'Skills', placeholder: 'e.g. JavaScript, React, Node.js, Python, SQL', type: 'textarea' },
    ],
    render: (b) => {
      let items = Array.isArray(b.items) ? b.items : [];
      if (!items.length && (b.skills || b.category)) {
        const rawSkills = String(b.skills || '');
        const lines = rawSkills.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length > 1 && lines.some((l) => l.includes(':'))) {
          items = lines.map((l) => {
            const colonIdx = l.indexOf(':');
            if (colonIdx !== -1) {
              const cat = l.slice(0, colonIdx).replace(/^[•\-\*]\s*/, '').trim();
              const val = l.slice(colonIdx + 1).trim();
              return { category: cat, skills: val };
            }
            return { category: '', skills: l.replace(/^[•\-\*]\s*/, '').trim() };
          });
        } else {
          items = [{ category: b.category || '', skills: b.skills || '' }];
        }
      }

      const formattedLines = items
        .filter((item) => (item.category && item.category.trim()) || (item.skills && item.skills.trim()))
        .map((item) => {
          const cat = item.category?.trim();
          const val = item.skills?.trim() || '';
          if (cat && val) return `• **${cat}:** ${val}`;
          if (cat) return `• **${cat}**`;
          return `• ${val}`;
        });

      return {
        title: '',
        body: formattedLines.join('\n'),
      };
    },
  },
};

export const TEMPLATES = {
  classic: {
    name: 'Classic Professional',
    description: 'A traditional serif layout with a centered header.',
    className: 'template-classic',
  },
  modern: {
    name: 'Modern Clean',
    description: 'A clean, single-column layout with a bold header.',
    className: 'template-modern',
  },
};

// Blocks are flat JSON objects — owner + id + type + tagIds + content fields at top level
// tagIds reference the user's tags dictionary
export const INITIAL_BLOCKS = [
  {
    id: 'b1',
    owner: DEFAULT_OWNER,
    type: 'summary',
    tagIds: ['jt1', 'jt2'],
    headline: 'Senior Software Engineer',
    body: 'Results-driven engineer with 8+ years of experience building scalable web applications and leading cross-functional teams.',
  },
  {
    id: 'b2',
    owner: DEFAULT_OWNER,
    type: 'experience',
    tagIds: ['jt1'],
    company: 'TechCorp',
    role: 'Senior Software Engineer',
    location: 'San Francisco, CA',
    startDate: '2020',
    endDate: 'Present',
    description: 'Lead backend architecture for a high-traffic SaaS platform. Mentor junior engineers and drive CI/CD best practices.',
  },
  {
    id: 'b3',
    owner: DEFAULT_OWNER,
    type: 'experience',
    tagIds: ['jt2'],
    company: 'StartupXYZ',
    role: 'Engineering Manager',
    location: 'Remote',
    startDate: '2017',
    endDate: '2020',
    description: 'Managed a team of 10 engineers across two product squads. Improved delivery predictability by 40%.',
  },
  {
    id: 'b4',
    owner: DEFAULT_OWNER,
    type: 'education',
    tagIds: ['jt1', 'jt6'],
    institution: 'State University',
    degree: 'Bachelor of Science',
    field: 'Computer Science',
    startDate: '2012',
    endDate: '2016',
    gpa: 'GPA: 3.8 / 4.0',
  },
  {
    id: 'b5',
    owner: DEFAULT_OWNER,
    type: 'skills',
    tagIds: ['jt3', 'jt1'],
    name: 'Technical Skills',
    items: [
      { category: 'Languages', skills: 'JavaScript, TypeScript, React, Node.js, Python, SQL' },
      { category: 'Cloud & DevOps', skills: 'AWS, Docker, CI/CD, Git' },
    ],
  },
  {
    id: 'b6',
    owner: DEFAULT_OWNER,
    type: 'projects',
    tagIds: ['jt1', 'jt3'],
    role: 'Creator & Maintainer',
    company: 'Open-Source Markdown Engine',
    link: 'https://github.com/example/engine',
    location: '',
    startDate: '2022',
    endDate: 'Present',
    description: 'Built a high-performance streaming markdown parser in TypeScript with 2,000+ GitHub stars.',
  },
  {
    id: 'b7',
    owner: DEFAULT_OWNER,
    type: 'activities',
    tagIds: ['jt2'],
    role: 'President',
    company: 'University Computing Society',
    location: 'Campus Chapter',
    startDate: '2014',
    endDate: '2016',
    description: 'Organized annual 48-hour national hackathon with 400+ participants and raised $25k in industry sponsorships.',
  },
];

// Resume is a self-contained JSON object: owner + personalInfo + section keys (block ID arrays).
// sectionOrder preserves display order.
export const INITIAL_RESUME = {
  id: 'r1',
  owner: DEFAULT_OWNER,
  title: 'My Resume',
  templateId: 'classic',
  personalInfo: {
    name: 'Your Name',
    email: 'your.email@example.com',
    phone: '(123) 456-7890',
    linkedin: 'linkedin.com/in/yourprofile',
    fields: [
      { id: 'f-email', label: 'Email', value: 'your.email@example.com' },
      { id: 'f-phone', label: 'Phone', value: '(123) 456-7890' },
      { id: 'f-linkedin', label: 'LinkedIn', value: 'linkedin.com/in/yourprofile' },
    ],
  },
  sectionOrder: ['Summary', 'Experience', 'Education', 'Skills'],
  sections: {
    Summary: ['b1'],
    Experience: ['b2', 'b3'],
    Education: ['b4'],
    Skills: ['b5'],
  },
};

export const BLANK_RESUME = {
  id: 'r1',
  owner: DEFAULT_OWNER,
  title: 'Untitled Resume',
  templateId: 'classic',
  personalInfo: {
    name: '',
    email: '',
    phone: '',
    linkedin: '',
    fields: [
      { id: 'f-email', label: 'Email', value: '' },
      { id: 'f-phone', label: 'Phone', value: '' },
      { id: 'f-linkedin', label: 'LinkedIn', value: '' },
    ],
  },
  sectionOrder: [],
  sections: {},
};

export const BLANK_BLOCKS = [];

export const SECTION_NAME_SUGGESTIONS = [
  'Summary',
  'Experience',
  'Projects',
  'Activities',
  'Education',
  'Skills',
  'Certifications',
  'Awards',
];
