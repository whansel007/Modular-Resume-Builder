import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BlockModal from '../components/BlockModal/BlockModal';
import AccountModal from '../components/AccountModal/AccountModal';
import ImportModal from '../components/ImportModal/ImportModal';
import { BLOCK_SCHEMA, DEFAULT_OWNER, SECTION_TYPES, concatDescription } from '../utils/constants';
import BulletedBody, { isBulletType } from '../components/BulletedBody/BulletedBody';
import { normalizePersonalInfo } from '../utils/personalInfo';
import { generateId } from '../utils/id';
import { prefetchBuilderData, invalidatePrefetch, getOrFetch } from '../utils/prefetch';
import hackathonTeam from '../assets/hackathon-team.jpg';
import styles from './Dashboard.module.css';

// Easter egg: type the Konami code anywhere on the dashboard to reveal the
// hackathon team photo. Letters are matched case-insensitively.
const KONAMI_CODE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a',
];

// Popup listing all child variants saved under a library block.
function VariantsModal({ parent, variants, getDisplayText, onClose, onEdit, onDuplicate, onDelete }) {
  const parentName = parent.name || `${BLOCK_SCHEMA[parent.type]?.label || ''} block`;
  return (
    <div className={styles.variantsOverlay} onClick={onClose}>
      <div className={styles.variantsPanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.variantsHeader}>
          <h3>Variants of “{parentName}”</h3>
          <button className={styles.variantsClose} onClick={onClose}>
            &times;
          </button>
        </div>
        {variants.length === 0 ? (
          <p className={styles.emptyText}>No variants yet.</p>
        ) : (
          <ul className={styles.variantList}>
            {variants.map((v) => (
              <li key={v._id || v.id} className={styles.variantItem}>
                <div className={styles.variantInfo}>
                  <strong>{v.name || `${BLOCK_SCHEMA[v.type]?.label || ''} variant`}</strong>
                  {(() => {
                    const dt = getDisplayText(v);
                    return (
                      <>
                        {dt.meta && <span className={styles.variantMeta}>{dt.meta}</span>}
                        {dt.body && <span className={styles.variantPreview}>{dt.body}</span>}
                      </>
                    );
                  })()}
                </div>
                <div className={styles.cardActions}>
                  <button
                    className={styles.editBtn}
                    onClick={() => onDuplicate(v)}
                    title="Duplicate variant"
                  >
                    &#10697;
                  </button>
                  <button
                    className={styles.editBtn}
                    onClick={() => onEdit(v)}
                    title="Edit variant"
                  >
                    ✎
                  </button>
                  <button
                    className={styles.editBtn}
                    onClick={() => onDelete(v)}
                    title="Delete variant"
                  >
                    &#128465;
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('auth-user') || 'null'));

  const [resumes, setResumes] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [tags, setTags] = useState({}); // { jt1: "Software Development", ... }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Account details modal (opened by clicking the email in the header).
  // Holds the user's saved default personal info.
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [defaultInfo, setDefaultInfo] = useState(null);

  // Import-resume-PDF modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  // Easter egg popup (Konami code)
  const [eggOpen, setEggOpen] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user?.email) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Resume a pending extension deep link ("Copy JD" → Open in Resume
  // Builder) once the user is authenticated. The payload sits in
  // sessionStorage while they log in; continue the flow straight into a
  // fresh builder instead of making them click through again.
  useEffect(() => {
    if (!user?.email) return;
    try {
      if (sessionStorage.getItem('mrb-ext-jd')) {
        navigate('/builder?new=true', { replace: true });
      }
    } catch {
      /* sessionStorage unavailable */
    }
  }, [user?.email, navigate]);

  // Konami code listener: track progress through the sequence across
  // keypresses. Keys typed into form fields never count, so the code can
  // only be entered on the page itself.
  useEffect(() => {
    let progress = 0;
    const onKeyDown = (e) => {
      const target = e.target;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      )
        return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === KONAMI_CODE[progress]) {
        progress += 1;
        if (progress === KONAMI_CODE.length) {
          progress = 0;
          setEggOpen(true);
        }
      } else {
        // A wrong key restarts the sequence (it might be a fresh ArrowUp).
        progress = key === KONAMI_CODE[0] ? 1 : 0;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Escape closes the easter egg popup.
  useEffect(() => {
    if (!eggOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setEggOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [eggOpen]);

  // Block modal state
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [tempBlock, setTempBlock] = useState({ type: 'summary', tagIds: [] });
  // Variants popup: the parent block whose child variants are being shown
  const [variantsModalBlock, setVariantsModalBlock] = useState(null);

  // Tag management state
  const [newTagName, setNewTagName] = useState('');

  // Helper to get auth headers
  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
  });

  const fetchData = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true);
    setError('');

    try {
      // Shared with the builder/hover prefetch — returning from the builder
      // usually resolves instantly from the in-memory cache.
      const [resumesData, blocksData, tagsData] = await Promise.all([
        getOrFetch('resumes', '/api/resumes'),
        getOrFetch('blocks', '/api/blocks'),
        getOrFetch('tags', '/api/user/tags'),
      ]);

      setResumes(resumesData);
      setBlocks(blocksData);
      setTags(tagsData);
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = () => {
    localStorage.removeItem('auth-token');
    localStorage.removeItem('auth-user');
    invalidatePrefetch(); // never leak this account's cached data to the next login
    setUser(null);
    navigate('/');
  };

  // ---------- Block CRUD ----------

  const openNewBlockModal = () => {
    setEditingBlockId(null);
    setTempBlock({ type: 'summary', tagIds: [] });
    setBlockModalOpen(true);
  };

  const openEditBlockModal = (block) => {
    setEditingBlockId(block._id || block.id);
    // Flatten the content fields to top level for the modal
    const { content, ...rest } = block;
    setTempBlock({ ...rest, ...(content || {}), tagIds: rest.tagIds || rest.jobTypeIds || [] });
    setBlockModalOpen(true);
  };

  const closeBlockModal = () => {
    setBlockModalOpen(false);
    setEditingBlockId(null);
  };

  const saveBlock = async () => {
    const owner = user?.email || DEFAULT_OWNER;

    // If editing, use existing id; otherwise generate new one
    const blockToSave = editingBlockId
      ? { ...tempBlock, id: editingBlockId, owner }
      : { ...tempBlock, id: generateId(), owner };

    try {
      const res = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(blockToSave),
      });

      if (!res.ok) throw new Error('Failed to save block');
      const saved = await res.json();

      // Update local state
      if (editingBlockId) {
        setBlocks((prev) => prev.map((b) => (b._id === editingBlockId || b.id === editingBlockId ? saved : b)));
      } else {
        setBlocks((prev) => [...prev, saved]);
      }
      invalidatePrefetch('blocks');
      closeBlockModal();
    } catch (err) {
      console.error('Save block error:', err);
      setError('Failed to save block');
    }
  };

  const duplicateBlock = async (block) => {
    const owner = user?.email || DEFAULT_OWNER;
    const newId = generateId();

    // Variants copy their resume scope and lineage; library blocks stay global.
    const blockData = {
      id: newId,
      owner,
      type: block.type,
      name: block.name || '',
      tagIds: block.tagIds || [],
      ...(block.variantIn
        ? { variantIn: block.variantIn, variantOf: block.variantOf || block._id }
        : {}),
      ...(block.content || {}),
    };

    try {
      const res = await fetch('/api/blocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(blockData),
      });

      if (!res.ok) throw new Error('Failed to duplicate block');
      const saved = await res.json();

      setBlocks((prev) => [...prev, saved]);
      invalidatePrefetch('blocks');

      // Open the editor on the copy for immediate tweaking.
      openEditBlockModal(saved);
    } catch (err) {
      console.error('Duplicate block error:', err);
      setError('Failed to duplicate block');
    }
  };

  // Delete a library block or a child variant. Deleting a parent takes its
  // child variants with it so none are left orphaned in the database.
  const deleteBlock = async (block) => {
    const blockId = block._id || block.id;
    const children = childrenOf(block);
    const message = children.length
      ? `Delete this block and its ${children.length} child variant${children.length === 1 ? '' : 's'}? Resumes using it will lose the block.`
      : 'Delete this block? Resumes using it will lose the block.';
    if (!confirm(message)) return;

    try {
      // One request is enough — the server cascade-deletes library child
      // variants of a deleted parent.
      const res = await fetch(`/api/blocks/${blockId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete block');
      const childIds = children.map((c) => c._id || c.id);
      setBlocks((prev) => prev.filter((b) => (b._id || b.id) !== blockId && !childIds.includes(b._id || b.id)));
      invalidatePrefetch('blocks');
      // If the popup is open on the deleted parent, close it.
      if (variantsModalBlock && (variantsModalBlock._id || variantsModalBlock.id) === blockId) {
        setVariantsModalBlock(null);
      }
    } catch (err) {
      console.error('Delete block error:', err);
      setError('Failed to delete block');
    }
  };

  // Save the block being edited as a CHILD VARIANT: a copy stored in the
  // library under the parent block, listed in its Variants popup.
  const saveBlockAsChildVariant = async () => {
    if (!editingBlockId) return;
    const owner = user?.email || DEFAULT_OWNER;
    const newId = generateId();

    // Flatten the temp block, dropping ids/metadata; explicit fields after
    // the spread win (forces the child-variant scope).
    const { id: _id1, _id: _id2, owner: _o, content: _c, jobTypes: _jt, createdAt: _ca, updatedAt: _ua, __v: _v, ...fields } = tempBlock;
    const blockData = {
      ...fields,
      id: newId,
      owner,
      type: tempBlock.type,
      name: tempBlock.name || '',
      tagIds: tempBlock.tagIds || [],
      variantOf: editingBlockId,
      variantIn: null,
    };

    try {
      const res = await fetch('/api/blocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(blockData),
      });

      if (!res.ok) throw new Error('Failed to save child variant');
      const saved = await res.json();

      setBlocks((prev) => [...prev, saved]);
      invalidatePrefetch('blocks');
      closeBlockModal();
    } catch (err) {
      console.error('Save child variant error:', err);
      setError('Failed to save child variant');
    }
  };

  // ---------- Tag Management ----------

  const addTag = async () => {
    const name = newTagName.trim();
    if (!name) return;

    const id = 'jt' + Date.now();
    try {
      const res = await fetch('/api/user/tags', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ id, name }),
      });

      if (!res.ok) throw new Error('Failed to add tag');
      setTags((prev) => ({ ...prev, [id]: name }));
      setNewTagName('');
      invalidatePrefetch('tags');
    } catch (err) {
      setError('Failed to add tag');
    }
  };

  const deleteTag = async (id) => {
    if (!confirm('Delete this tag? It will be removed from all blocks.')) return;

    try {
      const res = await fetch(`/api/user/tags?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error('Failed to delete tag');

      // Remove from local state
      setTags((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      // Remove from all blocks (local state)
      const updatedBlocks = blocks.map((b) => ({
        ...b,
        tagIds: (b.tagIds || []).filter((tagId) => tagId !== id),
      }));
      setBlocks(updatedBlocks);

      // Persist block changes to MongoDB
      const authToken = localStorage.getItem('auth-token');
      for (const block of updatedBlocks) {
        const { tagIds, type, ...contentFields } = block;
        const blockId = block._id || block.id;
        await fetch('/api/blocks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            id: blockId,
            owner: user.email,
            type,
            tagIds: tagIds || [],
            ...contentFields,
          }),
        });
      }
      invalidatePrefetch('blocks');
      invalidatePrefetch('tags');
    } catch (err) {
      setError('Failed to delete tag');
    }
  };

  // ---------- Account defaults (prefill for new resumes) ----------

  const openAccountModal = async () => {
    // Load defaults BEFORE opening — the modal initializes its form from
    // `initial` once, so it must already be available when it mounts.
    // (getOrFetch is cached, so repeat opens are instant.)
    try {
      const data = await getOrFetch('defaults', '/api/user/defaults');
      setDefaultInfo(data);
    } catch {
      setDefaultInfo({});
    }
    setAccountModalOpen(true);
  };

  const saveDefaultInfo = async (info) => {
    const payload = normalizePersonalInfo(info);
    const res = await fetch('/api/user/defaults', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to save account details');
    const saved = await res.json();
    setDefaultInfo(saved);
    invalidatePrefetch('defaults');
  };

  // ---------- Resume CRUD ----------

  // Persist a parsed PDF import: bulk-create the blocks, assemble them
  // into a new resume, then jump straight into the builder on it.
  const handlePdfImport = async (parsed, title) => {
    const owner = user?.email || DEFAULT_OWNER;
    setImporting(true);
    try {
      const docs = parsed.blocks.map(({ type, name, fields }) => ({
        id: generateId(),
        owner,
        type,
        name: name || '',
        tagIds: [],
        ...(fields || {}),
      }));

      const bulkRes = await fetch('/api/blocks/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(docs),
      });
      if (!bulkRes.ok) throw new Error('Failed to save imported blocks');

      const SECTION_TITLE = {
        summary: 'Summary',
        experience: 'Experience',
        projects: 'Projects',
        activities: 'Activities',
        cca: 'Activities',
        education: 'Education',
        skills: 'Skills',
      };
      const sections = {};
      const sectionOrder = [];
      for (const doc of docs) {
        const s = SECTION_TITLE[doc.type];
        if (!s) continue;
        if (!sections[s]) {
          sections[s] = [];
          sectionOrder.push(s);
        }
        sections[s].push(doc.id);
      }

      const resumeId = generateId();
      const personalInfo = normalizePersonalInfo({
        ...(defaultInfo || {}), // account defaults fill any gaps
        ...(parsed.personalInfo || {}), // extracted values win
      });

      const res = await fetch('/api/resumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          id: resumeId,
          owner,
          title,
          templateId: 'classic',
          personalInfo,
          sections,
          sectionOrder,
        }),
      });
      if (!res.ok) throw new Error('Failed to create resume');
      const savedResume = await res.json();

      setBlocks((prev) => [...prev, ...docs]);
      setResumes((prev) => [savedResume, ...prev]);
      invalidatePrefetch('blocks');
      invalidatePrefetch('resumes');
      setImportModalOpen(false);
      navigate(`/builder?resume=${savedResume._id || resumeId}`);
    } catch (err) {
      console.error('PDF import save error:', err);
      setError('Failed to save the imported resume');
      setImportModalOpen(false);
    } finally {
      setImporting(false);
    }
  };

  const copyResume = async (resume) => {
    try {
      const owner = user?.email || DEFAULT_OWNER;
      const newResume = {
        ...resume,
        _id: undefined, // Let MongoDB generate a new ID
        id: `r-${Date.now()}`,
        owner,
        title: `${resume.title} (Copy)`,
      };

      const res = await fetch('/api/resumes', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(newResume),
      });

      if (!res.ok) throw new Error('Failed to copy resume');
      invalidatePrefetch('resumes');
      await fetchData();
    } catch (err) {
      setError('Failed to copy resume');
    }
  };

  const deleteResume = async (resumeId) => {
    if (!confirm('Delete this resume? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/resumes?id=${resumeId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error('Failed to delete resume');
      invalidatePrefetch('resumes');
      await fetchData();
    } catch (err) {
      setError('Failed to delete resume');
    }
  };

  // Helper to get display text from a block (handles flat, nested, and schema-based content)
  const getBlockDisplayText = (block) => {
    if (!block) return { meta: '', body: '' };
    const b = block.content ? { ...block.content, ...block } : block;

    const genericPlaceholders = new Set([
      'role',
      'position',
      'institution',
      'project name',
      'professional summary',
      'untitled',
      'headline',
      'skills',
      'summary',
      'experience',
      'education',
      'projects',
      'activities',
      'cca',
    ]);

    const isGeneric = (val) => !val || genericPlaceholders.has(String(val).trim().toLowerCase());

    const dates = [b.startDate, b.endDate].filter(Boolean).join(' – ');
    let metaParts = [];
    let bodyText = '';

    if (b.type === 'experience' || b.type === 'projects' || b.type === 'activities' || b.type === 'cca') {
      if (b.company && !isGeneric(b.company)) metaParts.push(b.company);
      if (b.location && !isGeneric(b.location)) metaParts.push(b.location);
      if (dates) metaParts.push(dates);

      if (b.role && !isGeneric(b.role) && b.role.trim() !== (b.name || '').trim()) {
        metaParts.unshift(b.role);
      }

      bodyText = concatDescription(b.description) || b.body || '';
    } else if (b.type === 'education') {
      if (b.institution && !isGeneric(b.institution)) metaParts.push(b.institution);
      const degreeStr = [b.degree, b.field].filter(Boolean).join(b.degree && b.field ? ' in ' : '');
      if (degreeStr && degreeStr.trim() !== (b.name || '').trim()) metaParts.push(degreeStr);
      if (b.location && !isGeneric(b.location)) metaParts.push(b.location);
      if (dates) metaParts.push(dates);

      bodyText = [b.gpa, concatDescription(b.description) || b.body].filter(Boolean).join(' · ');
    } else if (b.type === 'skills') {
      if (b.category && !isGeneric(b.category)) metaParts.push(b.category);
      if (Array.isArray(b.items) && b.items.length) {
        bodyText = b.items
          .map((item) => (item.category ? `${item.category}: ${item.skills}` : item.skills))
          .filter(Boolean)
          .join(' • ');
      } else {
        bodyText = (b.skills || b.body || '').replace(/\n+/g, ' • ');
      }
    } else if (b.type === 'summary') {
      if (b.headline && !isGeneric(b.headline) && b.headline.trim() !== (b.name || '').trim()) {
        metaParts.push(b.headline);
      }
      bodyText = b.body || concatDescription(b.description) || '';
    } else {
      const schema = BLOCK_SCHEMA[b.type];
      if (schema?.render) {
        const rendered = schema.render(b);
        if (rendered.subtitle && !isGeneric(rendered.subtitle)) metaParts.push(rendered.subtitle);
        if (rendered.location && !isGeneric(rendered.location)) metaParts.push(rendered.location);
        if (rendered.dates) metaParts.push(rendered.dates);
        bodyText = rendered.body || '';
      }
    }

    const cleanBody = (bodyText || '')
      .replace(/\*\*/g, '')
      .replace(/^[•▪◦‣∙·●○■□◘\-\*]\s*/gm, '')
      .replace(/\n+/g, ' ')
      .trim();

    const meta = metaParts.filter((p) => p && !isGeneric(p)).join(' · ');

    return { meta, body: cleanBody };
  };

  // Helper to resolve tag IDs to names
  const resolveTagNames = (tagIds) => {
    return (tagIds || []).map((id) => tags[id] || id).filter(Boolean);
  };

  // Section type filter for library blocks ('all' | 'summary' | 'experience' | 'projects' | 'activities' | 'education' | 'skills')
  const [selectedBlockType, setSelectedBlockType] = useState('all');
  const [blockSearchQuery, setBlockSearchQuery] = useState('');

  // Resume-scoped variants live only on their resume, and child variants
  // live under their parent's Variants popup — neither shows as a card.
  const libraryBlocks = blocks.filter((b) => !b.variantIn && !b.variantOf);

  const filteredLibraryBlocks = libraryBlocks.filter((b) => {
    const matchesType =
      selectedBlockType === 'all' ||
      b.type === selectedBlockType ||
      (selectedBlockType === 'activities' && b.type === 'cca');

    if (!matchesType) return false;

    if (!blockSearchQuery.trim()) return true;

    const query = blockSearchQuery.toLowerCase().trim();
    const blockContentStr = JSON.stringify(b).toLowerCase();
    const tagNames = resolveTagNames(b.tagIds || b.jobTypeIds).join(' ').toLowerCase();

    return blockContentStr.includes(query) || tagNames.includes(query);
  });

  // Child variants grouped by parent id, for the Variants popup.
  const childrenOf = (block) =>
    blocks.filter((b) => b.variantOf === (block._id || block.id) && !b.variantIn);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.logo}>Modular Resume Builder</h1>
        <div className={styles.userSection}>
          <button
            className={styles.emailBtn}
            onClick={openAccountModal}
            title="Account details & default personal info"
          >
            {user?.email}
          </button>
          <button
            onClick={() => {
              invalidatePrefetch(); // manual refresh bypasses the cache
              fetchData();
            }}
            className={styles.refreshBtn}
            title="Refresh"
          >
            ↻
          </button>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {error && <p className={styles.error}>{error}</p>}

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>My Resumes ({resumes.length})</h2>
            <div className={styles.sectionActions}>
              <button
                className={styles.importBtn}
                onClick={() => setImportModalOpen(true)}
                disabled={importing}
                title="Upload a resume PDF and turn it into blocks"
              >
                {importing ? 'Importing…' : '⇑ Import PDF'}
              </button>
              <Link to="/builder?new=true" className={styles.createBtn}>
                + New Resume
              </Link>
            </div>
          </div>
          {loading ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>Loading...</p>
            </div>
          ) : resumes.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>No resumes yet. Create your first one!</p>
            </div>
          ) : (
            <div className={styles.cardGrid}>
              {resumes.map((resume) => (
                <div
                  key={resume._id}
                  className={styles.card}
                  onMouseEnter={prefetchBuilderData}
                >
                  <Link
                    to={`/builder?resume=${resume._id}`}
                    className={styles.cardLink}
                    onFocus={prefetchBuilderData}
                  >
                    <h3 className={styles.cardTitle}>{resume.title || 'Untitled Resume'}</h3>
                    <p className={styles.cardMeta}>
                      {resume.sectionOrder?.length || 0} sections · Updated{' '}
                      {new Date(resume.updatedAt).toLocaleDateString()}
                    </p>
                  </Link>
                  <div className={styles.cardActions}>
                    <button
                      onClick={() => copyResume(resume)}
                      className={styles.iconBtn}
                      title="Copy resume"
                    >
                      ⎘
                    </button>
                    <button
                      onClick={() => deleteResume(resume._id)}
                      className={styles.iconBtn}
                      title="Delete resume"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionHeaderLeft}>
              <h2 className={styles.sectionTitle}>
                My Blocks ({libraryBlocks.length})
              </h2>
              <select
                className={styles.sectionSelect}
                value={selectedBlockType}
                onChange={(e) => setSelectedBlockType(e.target.value)}
                aria-label="Filter blocks by section"
              >
                <option value="all">All Sections ({libraryBlocks.length})</option>
                {SECTION_TYPES.map((st) => {
                  const count = libraryBlocks.filter(
                    (b) => b.type === st.key || (st.key === 'activities' && b.type === 'cca'),
                  ).length;
                  return (
                    <option key={st.key} value={st.key}>
                      {st.label} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
            <div className={styles.sectionActions}>
              <button className={styles.createBtn} onClick={openNewBlockModal}>
                + New Block
              </button>
            </div>
          </div>

          <div className={styles.blockToolbar}>
            <div className={styles.searchBox}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search blocks by name, role, company, skills, or tags..."
                value={blockSearchQuery}
                onChange={(e) => setBlockSearchQuery(e.target.value)}
              />
              {blockSearchQuery && (
                <button
                  type="button"
                  className={styles.clearSearchBtn}
                  onClick={() => setBlockSearchQuery('')}
                  title="Clear search"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>Loading...</p>
            </div>
          ) : libraryBlocks.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>No blocks yet. Blocks are reusable resume components.</p>
            </div>
          ) : filteredLibraryBlocks.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>
                {blockSearchQuery.trim()
                  ? `No blocks found matching “${blockSearchQuery}”.`
                  : `No ${SECTION_TYPES.find((s) => s.key === selectedBlockType)?.label || selectedBlockType} blocks found.`}
              </p>
              {(blockSearchQuery.trim() || selectedBlockType !== 'all') && (
                <button
                  type="button"
                  className={styles.clearFiltersBtn}
                  onClick={() => {
                    setBlockSearchQuery('');
                    setSelectedBlockType('all');
                  }}
                >
                  Clear Search & Filters
                </button>
              )}
            </div>
          ) : (
            <div className={styles.cardGrid}>
              {filteredLibraryBlocks.map((block) => {
                const variants = childrenOf(block);
                const blockTypeKey = block.type === 'cca' ? 'activities' : block.type;
                const dt = getBlockDisplayText(block);
                return (
                  <div
                    key={block._id || block.id}
                    className={`${styles.card} ${styles.blockCardItem}`}
                    data-block-type={blockTypeKey}
                  >
                    <div className={styles.cardHeader}>
                      <span className={styles.typeChip} data-block-type={blockTypeKey}>
                        {BLOCK_SCHEMA[block.type]?.label || block.type}
                      </span>
                      <h3
                        className={styles.cardTitle}
                        title={block.name || `${BLOCK_SCHEMA[block.type]?.label || ''} block`}
                      >
                        {block.name || `${BLOCK_SCHEMA[block.type]?.label || ''} block`}
                      </h3>
                    </div>
                    <div className={styles.cardContent}>
                      {dt.meta && (
                        <p className={styles.cardMeta} title={dt.meta}>
                          {dt.meta}
                        </p>
                      )}
                      {dt.body && (
                        <div className={styles.cardPreview} title={dt.body}>
                          <BulletedBody text={dt.body} bullets={isBulletType(block.type)} />
                        </div>
                      )}
                    </div>
                    <p className={styles.cardTags}>
                      {resolveTagNames(block.tagIds || block.jobTypeIds).map((name) => (
                        <span key={name} className={styles.tag}>{name}</span>
                      ))}
                    </p>
                    <div className={styles.cardFooter}>
                      {variants.length > 0 && (
                        <button
                          className={styles.variantsBtn}
                          onClick={() => setVariantsModalBlock(block)}
                          title="Show all child variants of this block"
                        >
                          Variants ({variants.length})
                        </button>
                      )}
                      <div className={styles.cardFooterIcons}>
                        <button
                          className={styles.editBtn}
                          onClick={() => duplicateBlock(block)}
                          title="Duplicate block"
                        >
                          &#10697;
                        </button>
                        <button
                          className={styles.editBtn}
                          onClick={() => openEditBlockModal(block)}
                          title="Edit block"
                        >
                          ✎
                        </button>
                        <button
                          className={styles.editBtn}
                          onClick={() => deleteBlock(block)}
                          title="Delete block"
                        >
                          &#128465;
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Tags ({Object.keys(tags).length})</h2>
          <p className={styles.sectionDesc}>Manage your tags. These are shared across all your blocks.</p>
          <div className={styles.tagsList}>
            {Object.entries(tags).map(([id, name]) => (
              <div key={id} className={styles.tagItem}>
                <span className={styles.tagName}>{name}</span>
                <button className={styles.deleteBtn} onClick={() => deleteTag(id)} title="Delete tag">
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className={styles.addTagRow}>
            <input
              type="text"
              className={styles.addTagInput}
              placeholder="Add new tag..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addTag();
              }}
            />
            <button className={styles.createBtn} onClick={addTag}>
              Add Tag
            </button>
          </div>
        </section>
      </main>

      {blockModalOpen && (
        <BlockModal
          tempBlock={tempBlock}
          setTempBlock={setTempBlock}
          editingBlockId={editingBlockId}
          tags={tags}
          onAddCustomTag={(name) => {
            const id = 'jt' + Date.now();
            setTags((prev) => ({ ...prev, [id]: name }));
            setTempBlock((prev) => ({
              ...prev,
              tagIds: [...(prev.tagIds || []), id],
            }));
            // Also persist to API
            fetch('/api/user/tags', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                ...getAuthHeaders()
              },
              body: JSON.stringify({ id, name }),
            });
            invalidatePrefetch('tags');
          }}
          onSave={saveBlock}
          onSaveChildVariant={saveBlockAsChildVariant}
          onClose={closeBlockModal}
        />
      )}

      {variantsModalBlock && (
        <VariantsModal
          parent={variantsModalBlock}
          variants={childrenOf(variantsModalBlock)}
          getDisplayText={getBlockDisplayText}
          onClose={() => setVariantsModalBlock(null)}
          onEdit={(variant) => {
            setVariantsModalBlock(null);
            openEditBlockModal(variant);
          }}
          onDuplicate={(variant) => duplicateBlock(variant)}
          onDelete={(variant) => deleteBlock(variant)}
        />
      )}

      {accountModalOpen && (
        <AccountModal
          userEmail={user?.email}
          initial={defaultInfo}
          onSave={saveDefaultInfo}
          onClose={() => setAccountModalOpen(false)}
        />
      )}

      {importModalOpen && (
        <ImportModal
          getAuthHeaders={getAuthHeaders}
          onImport={handlePdfImport}
          onClose={() => setImportModalOpen(false)}
        />
      )}

      {eggOpen && (
        <div className={styles.eggOverlay} onClick={() => setEggOpen(false)}>
          <div className={styles.eggCard} onClick={(e) => e.stopPropagation()}>
            <button
              className={styles.eggClose}
              onClick={() => setEggOpen(false)}
              title="Close"
            >
              &times;
            </button>
            <img
              src={hackathonTeam}
              alt="The hackathon team"
              className={styles.eggPhoto}
            />
            <p className={styles.eggCaption}>
              You found the secret! Meet the team behind the Resume Builder ✌️
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
