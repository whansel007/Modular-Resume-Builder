// Seeds a demo account showcasing every feature, via the running API server:
//   - 1 user (demo@example.com / demopass123) with default job types
//   - 13 blocks across all 4 types, tagged with varied job types
//   - 3 resumes: fully composed, partially filled (for AI autofill), and blank
// Requires the API server running. Run: node server/seed-demo.js
const API = process.env.API_URL || 'http://localhost:3001';
const EMAIL = 'demo@example.com';
const PASSWORD = 'demopass123';

const tags = {
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

// ── Blocks (flat shape the API expects: content fields at top level) ─────────
// Keyword-dense on purpose: extract-keywords + autofill demo against the mock
// job descriptions in DEMO.md. Different JDs should pick different blocks.
const blocks = [
  // Summaries — two voices so autofill can pick the right angle
  {
    id: 'demo-b1',
    type: 'summary',
    tagIds: ['jt1'],
    headline: 'Senior Full-Stack Engineer',
    body: 'Full-stack engineer with 9 years of experience shipping production web applications in React, TypeScript, and Node.js. Comfortable owning features end to end — from PostgreSQL schema design and REST APIs to accessible frontends and CI/CD pipelines on AWS.',
  },
  {
    id: 'demo-b2',
    type: 'summary',
    tagIds: ['jt2'],
    headline: 'Engineering Team Lead',
    body: 'Hands-on engineering lead who has managed, mentored, and grown teams of up to 8 engineers. Skilled at turning ambiguous roadmaps into predictable delivery through agile rituals, clear stakeholder communication, and pragmatic technical planning.',
  },
  {
    id: 'demo-b3',
    type: 'summary',
    tagIds: ['jt6'],
    headline: 'Data-Focused Software Engineer',
    body: 'Engineer with deep data platform experience: Python and SQL pipelines, Airflow orchestration, dbt transformations, and warehouse modeling. I build data infrastructure that analysts and products can actually rely on.',
  },

  // Experience — four roles covering full-stack, data, leadership, frontend
  {
    id: 'demo-b4',
    type: 'experience',
    tagIds: ['jt1'],
    company: 'Northwind Labs',
    role: 'Senior Full-Stack Engineer',
    location: 'Seattle, WA',
    startDate: 'Feb 2021',
    endDate: 'Present',
    description:
      'Own core features of a B2B SaaS platform serving 40k daily users. Built the billing service in Node.js and TypeScript on PostgreSQL, cut page load times 45% by reworking the React frontend, and led the move to GitHub Actions CI/CD with automated testing (Jest, Cypress). Mentor 3 junior engineers.',
  },
  {
    id: 'demo-b5',
    type: 'experience',
    tagIds: ['jt6', 'jt1'],
    company: 'Brightline Analytics',
    role: 'Data Engineer',
    location: 'Portland, OR',
    startDate: 'Mar 2018',
    endDate: 'Jan 2021',
    description:
      'Designed and maintained ETL pipelines in Python and Airflow ingesting 2TB/day into a cloud data warehouse. Introduced dbt for transformation testing, reducing data-quality incidents by 70%. Built Spark jobs for large-scale event processing and modeled dimensional schemas used by 30+ analysts.',
  },
  {
    id: 'demo-b6',
    type: 'experience',
    tagIds: ['jt2'],
    company: 'Brightline Analytics',
    role: 'Engineering Team Lead',
    location: 'Portland, OR',
    startDate: 'Jun 2019',
    endDate: 'Jan 2021',
    description:
      'Led a team of 8 engineers across two squads while remaining hands-on. Ran sprint planning, roadmapping, and stakeholder reviews; hiring loop interviewer and onboarding owner. Delivery predictability rose from 60% to 92% over four quarters.',
  },
  {
    id: 'demo-b7',
    type: 'experience',
    tagIds: ['jt1', 'jt4'],
    company: 'Studio Meridian',
    role: 'Frontend Developer',
    location: 'Portland, OR',
    startDate: 'May 2016',
    endDate: 'Feb 2018',
    description:
      'Built marketing and e-commerce sites for 20+ clients with JavaScript, React, and modern CSS. Championed accessibility audits (WCAG 2.1 AA) and introduced component-driven development with a shared design system.',
  },

  // Education
  {
    id: 'demo-b8',
    type: 'education',
    tagIds: ['jt1', 'jt6', 'jt10'],
    institution: 'Cascadia State University',
    degree: 'Bachelor of Science',
    field: 'Computer Science',
    startDate: 'Sep 2012',
    endDate: 'Jun 2016',
    gpa: 'GPA 3.8 / 4.0 · Dean’s List, 6 quarters',
  },
  {
    id: 'demo-b9',
    type: 'education',
    tagIds: ['jt1', 'jt3'],
    institution: 'Amazon Web Services',
    degree: 'Certification',
    field: 'Solutions Architect – Associate',
    startDate: 'Oct 2022',
    endDate: '',
    gpa: 'Credential ID: AWS-SAA-77219',
  },

  // Skills — split by specialty so autofill selects the relevant set per JD
  {
    id: 'demo-b10',
    type: 'skills',
    tagIds: ['jt3', 'jt1', 'jt4'],
    name: 'Frontend Skills',
    category: 'Frontend',
    skills: 'React, TypeScript, JavaScript (ES2023), Next.js, HTML5, CSS3, Accessibility (WCAG), Jest, Cypress',
    items: [
      { category: 'Frontend', skills: 'React, TypeScript, JavaScript (ES2023), Next.js, HTML5, CSS3, Accessibility (WCAG), Jest, Cypress' },
    ],
  },
  {
    id: 'demo-b11',
    type: 'skills',
    tagIds: ['jt3', 'jt1'],
    name: 'Backend & Cloud',
    category: 'Backend & Cloud',
    skills: 'Node.js, Express, REST APIs, PostgreSQL, MongoDB, AWS (EC2, S3, Lambda, RDS), Docker, GitHub Actions CI/CD',
    items: [
      { category: 'Backend & Cloud', skills: 'Node.js, Express, REST APIs, PostgreSQL, MongoDB, AWS (EC2, S3, Lambda, RDS), Docker, GitHub Actions CI/CD' },
    ],
  },
  {
    id: 'demo-b12',
    type: 'skills',
    tagIds: ['jt3', 'jt6'],
    name: 'Data Engineering',
    category: 'Data Engineering',
    skills: 'Python, SQL, Apache Airflow, dbt, Apache Spark, ETL/ELT pipelines, Data warehouse modeling, Pandas',
    items: [
      { category: 'Data Engineering', skills: 'Python, SQL, Apache Airflow, dbt, Apache Spark, ETL/ELT pipelines, Data warehouse modeling, Pandas' },
    ],
  },
  {
    id: 'demo-b13',
    type: 'skills',
    tagIds: ['jt3', 'jt2'],
    name: 'Leadership & Delivery',
    category: 'Leadership & Delivery',
    skills: 'Agile/Scrum, Mentoring, Hiring, Roadmapping, Stakeholder communication, OKRs, Technical writing',
    items: [
      { category: 'Leadership & Delivery', skills: 'Agile/Scrum, Mentoring, Hiring, Roadmapping, Stakeholder communication, OKRs, Technical writing' },
    ],
  },

  // Projects
  {
    id: 'demo-b14',
    type: 'projects',
    tagIds: ['jt1', 'jt3'],
    role: 'Lead Architect & Creator',
    company: 'LogStream Analytics Engine',
    link: 'https://github.com/jordanavery/logstream',
    location: '',
    startDate: 'Jan 2023',
    endDate: 'Present',
    description:
      'Open-source distributed log processor handling 50k events/sec. Implemented zero-copy JSON parsing in Rust with Node.js bindings; adopted by 15+ engineering teams.',
  },

  // Activities / Extracurriculars
  {
    id: 'demo-b15',
    type: 'activities',
    tagIds: ['jt2', 'jt1'],
    role: 'Co-Organizer & Technical Mentor',
    company: 'Pacific NW Student Hackathon',
    location: 'Seattle, WA',
    startDate: 'Jan 2020',
    endDate: 'May 2023',
    description:
      'Directed 48-hour annual hackathon for 350+ university and bootcamp students. Coordinated sponsorships with AWS and Microsoft; mentored 12 student finalist teams.',
  },
];

// ── Resumes ───────────────────────────────────────────────────────────────────
const personalInfo = {
  name: 'Jordan Avery',
  email: 'demo@example.com',
  phone: '(503) 555-0142',
  location: 'Seattle, WA',
  fields: [
    { id: 'f-email', label: 'Email', value: 'demo@example.com' },
    { id: 'f-phone', label: 'Phone', value: '(503) 555-0142' },
    { id: 'f-location', label: 'Location', value: 'Seattle, WA' },
    { id: 'f-linkedin', label: 'LinkedIn', value: 'linkedin.com/in/jordanavery' },
  ],
};

const resumes = [
  {
    // Fully composed — shows off the finished layout, drag & drop ordering, PDF export
    id: 'demo-r1',
    title: 'Jordan Avery — Master',
    templateId: 'classic',
    personalInfo,
    sectionOrder: ['Summary', 'Experience', 'Education', 'Skills'],
    sections: {
      Summary: ['demo-b1'],
      Experience: ['demo-b4', 'demo-b5', 'demo-b6', 'demo-b7'],
      Education: ['demo-b8', 'demo-b9'],
      Skills: ['demo-b10', 'demo-b11', 'demo-b12', 'demo-b13'],
    },
    showLocations: false,
  },
  {
    // Only a Summary — ideal for the AI autofill demo: paste a JD, extract
    // keywords, and let autofill fill Experience / Education / Skills
    id: 'demo-r2',
    title: 'Starter — tailor me with AI',
    templateId: 'classic',
    personalInfo,
    sectionOrder: ['Summary'],
    sections: {
      Summary: ['demo-b1'],
    },
    showLocations: false,
  },
  {
    // Blank — shows the empty-state UI and manual building from scratch
    id: 'demo-r3',
    title: 'Blank canvas',
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
    showLocations: false,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON response */
  }
  return { status: res.status, json };
}

// ── Seed ──────────────────────────────────────────────────────────────────────
async function seed() {
  const health = await call('GET', '/api/health').catch((err) => {
    throw new Error(`API server not reachable at ${API}: ${err.message}`);
  });
  if (health.status !== 200 || health.json?.mongo !== 'connected') {
    throw new Error(`API unhealthy: ${JSON.stringify(health.json)}`);
  }
  console.log(`API healthy at ${API} (mongo: ${health.json.mongo})`);

  // --- User: register, or log in if the account already exists ---
  let auth = await call('POST', '/api/auth/register', { body: { email: EMAIL, password: PASSWORD } });
  if (auth.status === 409) {
    console.log(`User "${EMAIL}" exists — logging in (note: password must already be "${PASSWORD}")`);
    auth = await call('POST', '/api/auth/login', { body: { email: EMAIL, password: PASSWORD } });
  }
  if (auth.status !== 200 && auth.status !== 201) {
    throw new Error(`Auth failed (${auth.status}): ${JSON.stringify(auth.json)}`);
  }
  const token = auth.json.token;
  console.log(`Authenticated as "${EMAIL}"`);

  // --- Job types: fill in any missing defaults ---
  const existingTags = await call('GET', '/api/user/tags', { token });
  const have = existingTags.json || {};
  let jtAdded = 0;
  for (const [id, name] of Object.entries(tags)) {
    if (!have[id]) {
      const r = await call('POST', '/api/user/tags', { token, body: { id, name } });
      if (r.status !== 201) throw new Error(`Job type ${id} failed: ${JSON.stringify(r.json)}`);
      jtAdded++;
    }
  }
  console.log(`Tags: ${jtAdded} added, ${Object.keys(tags).length - jtAdded} already present`);

  // --- Blocks: bulk upsert ---
  const bulk = await call('POST', '/api/blocks/bulk', { token, body: blocks });
  if (bulk.status !== 200) throw new Error(`Bulk blocks failed: ${JSON.stringify(bulk.json)}`);
  console.log(`Blocks: ${bulk.json.upserted} inserted, ${bulk.json.matched} updated (${blocks.length} total)`);

  // --- Resumes: upsert each ---
  for (const r of resumes) {
    const res = await call('POST', '/api/resumes', { token, body: r });
    if (res.status !== 201) throw new Error(`Resume "${r.title}" failed: ${JSON.stringify(res.json)}`);
  }
  console.log(`Resumes: ${resumes.map((r) => `"${r.title}"`).join(', ')}`);

  // --- Verify round trip ---
  const storedBlocks = await call('GET', '/api/blocks', { token });
  const storedResumes = await call('GET', '/api/resumes', { token });
  const byType = {};
  for (const b of storedBlocks.json || []) byType[b.type] = (byType[b.type] || 0) + 1;
  console.log(`\nVerified ${storedBlocks.json.length} blocks: ${JSON.stringify(byType)}`);
  console.log(`Verified ${storedResumes.json.length} resumes:`);
  for (const r of storedResumes.json) {
    console.log(`  - "${r.title}" [${r.sectionOrder.join(', ') || '(empty)'}]`);
  }
  console.log(`\nDone. Log in at /login with ${EMAIL} / ${PASSWORD}`);
}

seed().catch((err) => {
  console.error('Demo seed failed:', err.message);
  process.exit(1);
});
