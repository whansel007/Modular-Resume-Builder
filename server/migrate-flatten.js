// One-shot DB migration: purge test accounts, flatten blocks, rename
// jobTypes* -> tags*, resumeId -> variantIn.
//   Preview (no writes):  node server/migrate-flatten.js
//   Apply:                node server/migrate-flatten.js --commit
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const COMMIT = process.argv.includes('--commit');
const log = (msg) => console.log(`${COMMIT ? '[WRITE]' : '[DRY-RUN]'} ${msg}`);

// Accounts to purge, plus any blocks/resumes they own.
const PURGE_EMAILS = new Set([
  'test-1785763130549@test.com',
  'test-1785763142868@test.com',
  'test@example.com',
  'testuser@example.com',
  'testusera@example.com',
  'testuser99@example.com',
  'nametest-1785932702208@example.com',
  'nametest2-1785932702470@example.com',
  'switchtest@example.com',
  'phat@ss.com',
  'kys@kys.kys',
]);

const DEFAULT_TAG_NAMES = ['Email', 'Phone', 'LinkedIn', 'GitHub', 'Portfolio', 'Website', 'Location', 'Twitter'];

// Keys that are block metadata (never content), so flattening can strip them.
const BLOCK_META = new Set([
  '_id', '__v', 'createdAt', 'updatedAt', 'owner', 'content', 'type',
  'jobTypeIds', 'jobTypes', 'name', 'resumeId', 'variantOf', 'variantIn', 'tagIds',
]);

// Normalize any personal-info object to the canonical shape:
// { name, email, phone, linkedin, fields:[{id,label,value}] } with >=3 fields.
function normalizePersonalInfo(pi) {
  const src = pi && typeof pi === 'object' ? pi : {};
  const name = typeof src.name === 'string' ? src.name.trim() : '';
  let fields = [];

  if (Array.isArray(src.fields)) {
    fields = src.fields
      .filter((f) => f && typeof f === 'object')
      .map((f, idx) => ({
        id: typeof f.id === 'string' && f.id ? f.id : `f-${idx + 1}-${Date.now()}`,
        label: typeof f.label === 'string' && f.label.trim() ? f.label.trim() : `Field ${idx + 1}`,
        value: typeof f.value === 'string' ? f.value.trim() : '',
      }));
  } else {
    const thirdVal = (typeof src.linkedin === 'string' && src.linkedin) ? src.linkedin.trim()
      : (typeof src.location === 'string' ? src.location.trim() : '');
    const thirdLabel = (typeof src.linkedin === 'string' && src.linkedin) ? 'LinkedIn'
      : ((typeof src.location === 'string' && src.location) ? 'Location' : 'LinkedIn');
    fields = [
      { id: 'f-email', label: 'Email', value: typeof src.email === 'string' ? src.email.trim() : '' },
      { id: 'f-phone', label: 'Phone', value: typeof src.phone === 'string' ? src.phone.trim() : '' },
      { id: 'f-linkedin', label: thirdLabel, value: thirdVal },
    ];
  }

  while (fields.length < 3) {
    const existing = new Set(fields.map((f) => f.label.toLowerCase()));
    const next = DEFAULT_TAG_NAMES.find((l) => !existing.has(l.toLowerCase())) || `Field ${fields.length + 1}`;
    fields.push({ id: `f-${fields.length + 1}-${Date.now()}`, label: next, value: '' });
  }

  const email = fields.find((f) => f.label.toLowerCase() === 'email')?.value || fields[0]?.value || '';
  const phone = fields.find((f) => f.label.toLowerCase() === 'phone')?.value || fields[1]?.value || '';
  const linkedin = fields.find((f) => f.label.toLowerCase() === 'linkedin')?.value || fields[2]?.value || '';
  return { name, email, phone, linkedin, fields };
}

// Move a project URL stored in `location` into `link` (legacy shape).
function moveProjectLink(block) {
  if (block.type !== 'projects' || (block.link && block.link.trim())) return;
  const loc = typeof block.location === 'string' ? block.location.trim() : '';
  if (!loc) return;
  const urlish = /^https?:\/\//i.test(loc) || /^(www\.)?(github\.com|gitlab\.com|bitbucket\.org)/i.test(loc);
  if (urlish) block.link = loc;
}

// Map legacy jobTypes-name arrays to tag ids using the user's tags dict.
// Unknown names are added to the user's tags so no data is orphaned.
function mapTagNames(names, userTags) {
  if (!Array.isArray(names)) return [];
  const nameToId = {};
  for (const [id, nm] of Object.entries(userTags)) if (nm) nameToId[String(nm).toLowerCase()] = id;
  const ids = [];
  for (const nm of names) {
    const key = typeof nm === 'string' ? nm.trim().toLowerCase() : '';
    if (!key) continue;
    let id = nameToId[key];
    if (!id) {
      id = `jt${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
      nameToId[key] = id;
      userTags[id] = typeof nm === 'string' ? nm.trim() : String(nm);
    }
    ids.push(id);
  }
  return ids;
}

// Description is stored as an array of bullet strings; legacy newline strings
// are split into arrays here so storage is uniform.
function toDescriptionArray(v) {
  if (v === undefined || v === null) return undefined;
  if (Array.isArray(v)) return v.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
  if (typeof v === 'string') return v.split('\n').map((s) => s.trim()).filter(Boolean);
  return v;
}

// Flatten one block doc to the canonical flat shape.
function flattenBlock(b, userTags) {
  const out = { _id: b._id, owner: b.owner, type: b.type, name: b.name || '' };
  if (b.variantOf !== undefined) out.variantOf = b.variantOf;
  if (b.variantIn !== undefined) out.variantIn = b.variantIn;
  else if (b.resumeId !== undefined) out.variantIn = b.resumeId;
  if (b.createdAt) out.createdAt = b.createdAt;
  if (b.updatedAt) out.updatedAt = b.updatedAt;

  // Content source: top-level content wrapper, unwrapping double-nested blocks.
  let content = b.content && typeof b.content === 'object' ? b.content : {};
  if (content.content && typeof content.content === 'object' && content._id) {
    content = content.content; // content holds a whole block doc
  }

  // Tags: prefer tagIds, then jobTypeIds, then legacy jobTypes name arrays.
  if (Array.isArray(b.tagIds)) out.tagIds = b.tagIds;
  else if (Array.isArray(b.jobTypeIds)) out.tagIds = b.jobTypeIds;
  else if (Array.isArray(b.jobTypes)) out.tagIds = mapTagNames(b.jobTypes, userTags);
  else out.tagIds = [];

  // Merge content fields then stray flat fields (skipping metadata).
  const merged = { ...b, ...content };
  for (const [k, v] of Object.entries(merged)) {
    if (!BLOCK_META.has(k)) out[k] = v;
  }

  // Type aliases + project link relocation.
  if (out.type === 'cca') out.type = 'activities';
  moveProjectLink(out);
  if (out.description !== undefined) out.description = toDescriptionArray(out.description);
  return out;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
  const db = mongoose.connection.db;
  log(`connected (${COMMIT ? 'writes ENABLED' : 'preview only — pass --commit to apply'})`);

  const col = (n) => db.collection(n);
  let totalChanged = 0;

  // ── Phase 0: purge ──────────────────────────────────────────────────────────
  const toPurge = await col('users').find({ email: { $regex: 'test', $options: 'i' } }).toArray();
  const extra = await col('users').find({ email: { $in: ['phat@ss.com', 'kys@kys.kys'] } }).toArray();
  const purgeUsers = [...toPurge, extra.filter((u) => !toPurge.some((t) => t.email === u.email))].flat();
  const purgeEmails = [...new Set(purgeUsers.map((u) => u.email.toLowerCase()))];
  log(`purging ${purgeEmails.length} accounts: ${purgeEmails.join(', ')}`);
  if (purgeEmails.length) {
    const blocks = await col('blocks').countDocuments({ owner: { $in: purgeEmails } });
    const resumes = await col('resumes').countDocuments({ owner: { $in: purgeEmails } });
    log(`  would delete ${blocks} blocks and ${resumes} resumes for those owners`);
    if (COMMIT) {
      await col('blocks').deleteMany({ owner: { $in: purgeEmails } });
      await col('resumes').deleteMany({ owner: { $in: purgeEmails } });
      await col('users').deleteMany({ email: { $in: purgeEmails } });
    }
    totalChanged += blocks + resumes + purgeEmails.length;
  }

  // ── Phase 1: users — jobTypes -> tags, normalize defaultPersonalInfo ────────
  const users = await col('users').find({}).toArray();
  const userTagMap = {}; // email -> tags object (mutable, for legacy name mapping)
  for (const u of users) {
    const tags = {};
    if (u.tags && typeof u.tags === 'object') Object.assign(tags, u.tags);
    else if (u.jobTypes && typeof u.jobTypes === 'object') Object.assign(tags, u.jobTypes);
    userTagMap[u.email.toLowerCase()] = tags;

    const upd = {
      tags,
      tagsInitialized: u.tagsInitialized ?? u.jobTypesInitialized ?? true,
      defaultPersonalInfo: normalizePersonalInfo(u.defaultPersonalInfo),
    };
    if (JSON.stringify(upd.tags) !== JSON.stringify(u.tags || {}) ||
        String(upd.tagsInitialized) !== String(u.tagsInitialized ?? u.jobTypesInitialized ?? true) ||
        JSON.stringify(upd.defaultPersonalInfo) !== JSON.stringify(u.defaultPersonalInfo || {})) {
      log(`  user ${u.email}: tags(${Object.keys(tags).length}) + defaultPersonalInfo normalized`);
      if (COMMIT) {
        await col('users').updateOne(
          { _id: u._id },
          { $set: upd, $unset: { jobTypes: '', jobTypesInitialized: '' } },
        );
      }
      totalChanged++;
    }
  }

  // ── Phase 2: blocks — flatten + rename (needs user tags for legacy names) ───
  const blocks = await col('blocks').find({}).toArray();
  const stats = { flattened: 0, cca: 0, tagsRenamed: 0, variantRenamed: 0, linkMoved: 0 };
  for (const b of blocks) {
    const userTags = userTagMap[b.owner.toLowerCase()] || {};
    const flat = flattenBlock(b, userTags);
    const beforeJson = JSON.stringify(b);
    delete flat.__v;

    const flags = [];
    if (b.content !== undefined && Object.keys(b.content || {}).length) { stats.flattened++; flags.push('flatten'); }
    if (b.type === 'cca') { stats.cca++; flags.push('cca->activities'); }
    if (b.jobTypeIds || b.jobTypes) { stats.tagsRenamed++; flags.push('tagIds'); }
    if (b.resumeId !== undefined) { stats.variantRenamed++; flags.push('variantIn'); }
    if (flat.link && b.link !== flat.link) { stats.linkMoved++; flags.push('link'); }

    const afterJson = JSON.stringify(flat);
    if (beforeJson === afterJson) continue;

    log(`  block ${b._id} (${b.type}): ${flags.join(', ') || 'shape'}`);
    if (COMMIT) {
      await col('blocks').replaceOne({ _id: b._id }, flat);
    }
    totalChanged++;
  }

  // ── Phase 3: resumes — normalize personalInfo ────────────────────────────────
  const resumes = await col('resumes').find({}).toArray();
  for (const r of resumes) {
    const pi = normalizePersonalInfo(r.personalInfo);
    if (JSON.stringify(pi) === JSON.stringify(r.personalInfo || {})) continue;
    log(`  resume ${r._id}: personalInfo normalized`);
    if (COMMIT) {
      await col('resumes').updateOne({ _id: r._id }, { $set: { personalInfo: pi } });
    }
    totalChanged++;
  }

  // ── Verify ───────────────────────────────────────────────────────────────────
  const uC = await col('users').countDocuments();
  const bC = await col('blocks').countDocuments();
  const rC = await col('resumes').countDocuments();
  const remNamed = await col('blocks').countDocuments({ $or: [{ jobTypeIds: { $exists: true } }, { jobTypes: { $exists: true } }, { resumeId: { $exists: true } }, { content: { $exists: true } }] });
  const remCca = await col('blocks').countDocuments({ type: 'cca' });
  log(`\nsummary: users=${uC} blocks=${bC} resumes=${rC}`);
  log(`  block transforms: flatten=${stats.flattened} cca->activities=${stats.cca} tagIds renamed=${stats.tagsRenamed} variantIn renamed=${stats.variantRenamed} project links moved=${stats.linkMoved}`);
  log(`  blocks still nested/legacy-named: ${remNamed}, cca remaining: ${remCca}`);
  log(`  docs changed this run: ${totalChanged}`);
  log(COMMIT ? 'DONE — migration applied.' : 'DONE — dry run, nothing written. Re-run with --commit to apply.');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});