import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Block from './models/Block.js';
import Resume from './models/Resume.js';
import User from './models/User.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/resume-builder';
const OWNER = 'kit@catship.nya';

// ── Tags (user-level dictionary) ──────────────────────────────────────────────
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

// ── Blocks (flat: content fields at top level, tagIds referencing the dictionary) ──
const blocks = [
  {
    _id: 'b1',
    owner: OWNER,
    type: 'summary',
    tagIds: ['jt1', 'jt2'],
    headline: 'Senior Software Engineer',
    body: 'Results-driven engineer with 8+ years of experience building scalable web applications and leading cross-functional teams.',
  },
  {
    _id: 'b2',
    owner: OWNER,
    type: 'experience',
    tagIds: ['jt1'],
    company: 'TechCorp',
    role: 'Senior Software Engineer',
    location: 'San Francisco, CA',
    startDate: 'Jan 2020',
    endDate: 'Present',
    description: 'Lead backend architecture for a high-traffic SaaS platform. Mentor junior engineers and drive CI/CD best practices.',
  },
  {
    _id: 'b3',
    owner: OWNER,
    type: 'experience',
    tagIds: ['jt2'],
    company: 'StartupXYZ',
    role: 'Engineering Manager',
    location: 'Remote',
    startDate: 'Mar 2017',
    endDate: 'Dec 2020',
    description: 'Managed a team of 10 engineers across two product squads. Improved delivery predictability by 40%.',
  },
  {
    _id: 'b4',
    owner: OWNER,
    type: 'education',
    tagIds: ['jt1', 'jt6'],
    institution: 'State University',
    degree: 'Bachelor of Science',
    field: 'Computer Science',
    startDate: 'Aug 2012',
    endDate: 'May 2016',
    gpa: 'GPA: 3.8 / 4.0',
  },
  {
    _id: 'b5',
    owner: OWNER,
    type: 'skills',
    tagIds: ['jt3', 'jt1'],
    name: 'Technical Skills',
    category: 'Technical Skills',
    skills: 'Languages: JavaScript, TypeScript, Python, SQL\nCloud & Tools: AWS, Docker, Git, CI/CD',
    items: [
      { category: 'Languages', skills: 'JavaScript, TypeScript, React, Node.js, Python, SQL' },
      { category: 'Cloud & Tools', skills: 'AWS, Docker, Git, CI/CD' },
    ],
  },
  {
    _id: 'b6',
    owner: OWNER,
    type: 'projects',
    tagIds: ['jt1', 'jt3'],
    role: 'Creator & Maintainer',
    company: 'Open-Source Markdown Engine',
    location: 'github.com/example/engine',
    startDate: 'Jan 2022',
    endDate: 'Present',
    description: 'Built a high-performance streaming markdown parser in TypeScript with 2,000+ GitHub stars.',
  },
  {
    _id: 'b7',
    owner: OWNER,
    type: 'activities',
    tagIds: ['jt2'],
    role: 'President',
    company: 'University Computing Society',
    location: 'Campus Chapter',
    startDate: 'Sep 2014',
    endDate: 'May 2016',
    description: 'Organized annual 48-hour national hackathon with 400+ participants and raised $25k in industry sponsorships.',
  },
];

// ── Resume ────────────────────────────────────────────────────────────────────
const resume = {
  _id: 'r1',
  owner: OWNER,
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
  showLocations: false,
};

// ── Seed ──────────────────────────────────────────────────────────────────────
async function seed() {
  console.log(`Connecting to MongoDB (${MONGODB_URI.split('@').pop()})...`);
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.\n');

  // --- User Tags ---
  console.log('Seeding tags for user...');
  const user = await User.findOne({ email: OWNER });
  if (user) {
    user.tags = new Map(Object.entries(tags));
    await user.save();
    console.log(`Updated tags for "${OWNER}": ${Object.keys(tags).length} tags`);
  } else {
    console.log(`User "${OWNER}" not found — skipping tags. Register the account (or run server/seed-demo.js), then re-run seed.`);
  }

  // --- Blocks ---
  console.log('\nUpserting blocks into "blocks" collection...');
  const blockOps = blocks.map((b) => ({
    updateOne: { filter: { _id: b._id }, update: b, upsert: true },
  }));
  const blockResult = await Block.bulkWrite(blockOps);
  console.log(`Blocks done. Matched: ${blockResult.matchedCount}, Upserted: ${blockResult.upsertedCount}`);

  const storedBlocks = await Block.find({ owner: OWNER });
  console.log(`Verified ${storedBlocks.length} block(s) for owner "${OWNER}":`);
  storedBlocks.forEach((b) => console.log(`  - ${b._id} (${b.type}) tagIds: [${(b.tagIds || []).join(', ')}]`));

  // --- Resume ---
  console.log('\nUpserting resume into "resumes" collection...');
  await Resume.findByIdAndUpdate(resume._id, resume, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
  const storedResume = await Resume.findById(resume._id);
  console.log(`Resume done. _id=${storedResume._id}, owner=${storedResume.owner}, title="${storedResume.title}"`);
  console.log(`  sectionOrder: [${storedResume.sectionOrder.join(', ')}]`);
  console.log(`  sections:`, JSON.stringify(storedResume.sections));

  await mongoose.disconnect();
  console.log('\nDisconnected.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
