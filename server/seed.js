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

// ── Job Types (user-level dictionary) ─────────────────────────────────────────
const jobTypes = {
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

// ── Blocks (now use jobTypeIds referencing the dictionary) ────────────────────
const blocks = [
  {
    _id: 'b1',
    owner: OWNER,
    type: 'summary',
    jobTypeIds: ['jt1', 'jt2'],
    content: {
      headline: 'Senior Software Engineer',
      body: 'Results-driven engineer with 8+ years of experience building scalable web applications and leading cross-functional teams.',
    },
  },
  {
    _id: 'b2',
    owner: OWNER,
    type: 'experience',
    jobTypeIds: ['jt1'],
    content: {
      company: 'TechCorp',
      role: 'Senior Software Engineer',
      location: 'San Francisco, CA',
      startDate: '2020',
      endDate: 'Present',
      description: 'Lead backend architecture for a high-traffic SaaS platform. Mentor junior engineers and drive CI/CD best practices.',
    },
  },
  {
    _id: 'b3',
    owner: OWNER,
    type: 'experience',
    jobTypeIds: ['jt2'],
    content: {
      company: 'StartupXYZ',
      role: 'Engineering Manager',
      location: 'Remote',
      startDate: '2017',
      endDate: '2020',
      description: 'Managed a team of 10 engineers across two product squads. Improved delivery predictability by 40%.',
    },
  },
  {
    _id: 'b4',
    owner: OWNER,
    type: 'education',
    jobTypeIds: ['jt1', 'jt6'],
    content: {
      institution: 'State University',
      degree: 'Bachelor of Science',
      field: 'Computer Science',
      startDate: '2012',
      endDate: '2016',
      gpa: 'GPA: 3.8 / 4.0',
    },
  },
  {
    _id: 'b5',
    owner: OWNER,
    type: 'skills',
    jobTypeIds: ['jt3', 'jt1'],
    content: {
      category: 'Technical Skills',
      skills: 'JavaScript, TypeScript, React, Node.js, Python, SQL, AWS, Docker',
    },
  },
];

// ── Resume ────────────────────────────────────────────────────────────────────
const resume = {
  _id: 'r1',
  owner: OWNER,
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

// ── Seed ──────────────────────────────────────────────────────────────────────
async function seed() {
  console.log(`Connecting to MongoDB (${MONGODB_URI.split('@').pop()})...`);
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.\n');

  // --- User Job Types ---
  console.log('Seeding job types for user...');
  const user = await User.findOne({ email: OWNER });
  if (user) {
    user.jobTypes = new Map(Object.entries(jobTypes));
    await user.save();
    console.log(`Updated job types for "${OWNER}": ${Object.keys(jobTypes).length} types`);
  } else {
    console.log(`User "${OWNER}" not found. Job types will be seeded on first login.`);
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
  storedBlocks.forEach((b) => console.log(`  - ${b._id} (${b.type}) jobTypeIds: [${(b.jobTypeIds || []).join(', ')}]`));

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
