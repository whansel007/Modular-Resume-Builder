// Default job types dictionary: { id: name }
// Used as a client-side fallback when the API fetch fails.
// IMPORTANT: Keep in sync with server/models/User.js and api/lib/models/User.js (DEFAULT_JOB_TYPES).
export const DEFAULT_JOB_TYPES_MAP = {
  jt1: 'Software Development',
  jt2: 'Management',
  jt3: 'Technical Skills',
  jt4: 'Design',
  jt5: 'Product Management',
  jt6: 'Data Science',
  jt7: 'Marketing',
  jt8: 'Sales',
  jt9: 'Operations',
  jt10: 'Research',
};

// Legacy array for backwards compatibility (will be removed after migration)
export const DEFAULT_JOB_TYPES = Object.values(DEFAULT_JOB_TYPES_MAP);

// Owner identifier — will be replaced by real auth later
export const DEFAULT_OWNER = 'kit@catship.nya';

export const SECTION_TYPES = [
  { key: 'summary', label: 'Summary' },
  { key: 'experience', label: 'Experience' },
  { key: 'education', label: 'Education' },
  { key: 'skills', label: 'Skills' },
];

export const BLOCK_SCHEMA = {
  summary: {
    label: 'Summary',
    fields: [
      { name: 'headline', label: 'Headline', type: 'text' },
      { name: 'body', label: 'Summary', type: 'textarea' },
    ],
    render: (b) => ({
      title: b.headline || 'Professional Summary',
      body: b.body || '',
    }),
  },
  experience: {
    label: 'Experience',
    fields: [
      { name: 'company', label: 'Company', type: 'text' },
      { name: 'role', label: 'Role', type: 'text' },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'startDate', label: 'Start Date', type: 'text' },
      { name: 'endDate', label: 'End Date', type: 'text' },
      { name: 'description', label: 'Description', type: 'textarea' },
    ],
    render: (b) => ({
      title: b.role || 'Role',
      subtitle: `${b.company || ''}${b.company && b.location ? ' — ' : ''}${b.location || ''}`,
      dates: `${b.startDate || ''}${b.startDate && b.endDate ? ' – ' : ''}${b.endDate || ''}`,
      body: b.description || '',
    }),
  },
  education: {
    label: 'Education',
    fields: [
      { name: 'institution', label: 'Institution', type: 'text' },
      { name: 'degree', label: 'Degree', type: 'text' },
      { name: 'field', label: 'Field of Study', type: 'text' },
      { name: 'startDate', label: 'Start Date', type: 'text' },
      { name: 'endDate', label: 'End Date', type: 'text' },
      { name: 'gpa', label: 'GPA / Honors', type: 'text' },
    ],
    render: (b) => ({
      title: b.institution || 'Institution',
      subtitle: `${b.degree || ''}${b.degree && b.field ? ', ' : ''}${b.field || ''}`,
      dates: `${b.startDate || ''}${b.startDate && b.endDate ? ' – ' : ''}${b.endDate || ''}`,
      body: b.gpa || '',
    }),
  },
  skills: {
    label: 'Skills',
    fields: [
      { name: 'category', label: 'Category', type: 'text' },
      { name: 'skills', label: 'Skills (comma separated)', type: 'textarea' },
    ],
    render: (b) => ({
      title: b.category || 'Skills',
      body: b.skills || '',
    }),
  },
};

export const TEMPLATES = {
  modern: {
    name: 'Modern Clean',
    description: 'A clean, single-column layout with a bold header.',
    className: 'template-modern',
  },
  classic: {
    name: 'Classic Professional',
    description: 'A traditional serif layout with a centered header.',
    className: 'template-classic',
  },
};

// Blocks are flat JSON objects — owner + id + type + jobTypeIds + content fields at top level
// jobTypeIds reference the user's jobTypes dictionary
export const INITIAL_BLOCKS = [
  {
    id: 'b1',
    owner: DEFAULT_OWNER,
    type: 'summary',
    jobTypeIds: ['jt1', 'jt2'],
    headline: 'Senior Software Engineer',
    body: 'Results-driven engineer with 8+ years of experience building scalable web applications and leading cross-functional teams.',
  },
  {
    id: 'b2',
    owner: DEFAULT_OWNER,
    type: 'experience',
    jobTypeIds: ['jt1'],
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
    jobTypeIds: ['jt2'],
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
    jobTypeIds: ['jt1', 'jt6'],
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
    jobTypeIds: ['jt3', 'jt1'],
    category: 'Technical Skills',
    skills: 'JavaScript, TypeScript, React, Node.js, Python, SQL, AWS, Docker',
  },
];

// Resume is a self-contained JSON object: owner + personalInfo + section keys (block ID arrays).
// sectionOrder preserves display order.
export const INITIAL_RESUME = {
  id: 'r1',
  owner: DEFAULT_OWNER,
  title: 'My Resume',
  templateId: 'modern',
  personalInfo: {
    name: 'Your Name',
    email: 'your.email@example.com',
    phone: '(123) 456-7890',
    location: 'City, Country',
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
  templateId: 'modern',
  personalInfo: {
    name: '',
    email: '',
    phone: '',
    location: '',
  },
  sectionOrder: [],
  sections: {},
};

export const BLANK_BLOCKS = [];

export const SECTION_NAME_SUGGESTIONS = [
  'Summary',
  'Experience',
  'Education',
  'Skills',
  'Projects',
  'Certifications',
  'Awards',
];
