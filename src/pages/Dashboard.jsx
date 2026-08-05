import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BlockModal from '../components/BlockModal/BlockModal';
import AccountModal from '../components/AccountModal/AccountModal';
import ImportModal from '../components/ImportModal/ImportModal';
import { BLOCK_SCHEMA, DEFAULT_OWNER } from '../utils/constants';
import { generateId } from '../utils/id';
import { prefetchBuilderData, invalidatePrefetch, getOrFetch } from '../utils/prefetch';
import styles from './Dashboard.module.css';

// Popup listing all child variants saved under a library block.
function VariantsModal({ parent, variants, getDisplayText, onClose, onEdit, onDuplicate }) {
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
                  <span>{getDisplayText(v)}</span>
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
  const [jobTypes, setJobTypes] = useState({}); // { jt1: "Software Development", ... }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Account details modal (opened by clicking the email in the header).
  // Holds the user's saved default personal info.
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [defaultInfo, setDefaultInfo] = useState(null);

  // Import-resume-PDF modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);

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

  // Block modal state
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [tempBlock, setTempBlock] = useState({ type: 'summary', jobTypeIds: [] });
  // Variants popup: the parent block whose child variants are being shown
  const [variantsModalBlock, setVariantsModalBlock] = useState(null);

  // Job type management state
  const [newJobTypeName, setNewJobTypeName] = useState('');

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
      const [resumesData, blocksData, jobTypesData] = await Promise.all([
        getOrFetch('resumes', '/api/resumes'),
        getOrFetch('blocks', '/api/blocks'),
        getOrFetch('jobtypes', '/api/user/jobtypes'),
      ]);

      setResumes(resumesData);
      setBlocks(blocksData);
      setJobTypes(jobTypesData);
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
    setUser(null);
    navigate('/');
  };

  // ---------- Block CRUD ----------

  const openNewBlockModal = () => {
    setEditingBlockId(null);
    setTempBlock({ type: 'summary', jobTypeIds: [] });
    setBlockModalOpen(true);
  };

  const openEditBlockModal = (block) => {
    setEditingBlockId(block._id || block.id);
    // Flatten the content fields to top level for the modal
    const { content, ...rest } = block;
    setTempBlock({ ...rest, ...(content || {}), jobTypeIds: rest.jobTypeIds || rest.jobTypes || [] });
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
      jobTypeIds: block.jobTypeIds || [],
      ...(block.resumeId
        ? { resumeId: block.resumeId, variantOf: block.variantOf || block._id }
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
      jobTypeIds: tempBlock.jobTypeIds || [],
      variantOf: editingBlockId,
      resumeId: null,
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

  // ---------- Job Type Management ----------

  const addJobType = async () => {
    const name = newJobTypeName.trim();
    if (!name) return;

    const id = 'jt' + Date.now();
    try {
      const res = await fetch('/api/user/jobtypes', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ id, name }),
      });

      if (!res.ok) throw new Error('Failed to add job type');
      setJobTypes((prev) => ({ ...prev, [id]: name }));
      setNewJobTypeName('');
      invalidatePrefetch('jobtypes');
    } catch (err) {
      setError('Failed to add job type');
    }
  };

  const deleteJobType = async (id) => {
    if (!confirm('Delete this job type? It will be removed from all blocks.')) return;

    try {
      const res = await fetch(`/api/user/jobtypes?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error('Failed to delete job type');

      // Remove from local state
      setJobTypes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      // Remove from all blocks (local state)
      const updatedBlocks = blocks.map((b) => ({
        ...b,
        jobTypeIds: (b.jobTypeIds || []).filter((jtId) => jtId !== id),
      }));
      setBlocks(updatedBlocks);

      // Persist block changes to MongoDB
      const authToken = localStorage.getItem('auth-token');
      for (const block of updatedBlocks) {
        const { jobTypeIds, type, ...contentFields } = block;
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
            jobTypeIds: jobTypeIds || [],
            ...contentFields,
          }),
        });
      }
      invalidatePrefetch('blocks');
      invalidatePrefetch('jobtypes');
    } catch (err) {
      setError('Failed to delete job type');
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
    const res = await fetch('/api/user/defaults', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(info),
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
        jobTypeIds: [],
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
      const personalInfo = {
        name: '',
        email: '',
        phone: '',
        location: '',
        ...(defaultInfo || {}), // account defaults fill any gaps
        ...(parsed.personalInfo || {}), // extracted values win
      };

      const res = await fetch('/api/resumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          id: resumeId,
          owner,
          title,
          templateId: 'modern',
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

  // Helper to get display text from a block (handles both flat and nested content)
  const getBlockDisplayText = (block) => {
    const content = block.content || block;
    return content.headline || content.role || content.institution || content.category || 'Untitled';
  };

  // Helper to resolve job type IDs to names
  const resolveJobTypeNames = (jobTypeIds) => {
    return (jobTypeIds || []).map((id) => jobTypes[id] || id).filter(Boolean);
  };

  // Resume-scoped variants live only on their resume, and child variants
  // live under their parent's Variants popup — neither shows as a card.
  const libraryBlocks = blocks.filter((b) => !b.resumeId && !b.variantOf);

  // Child variants grouped by parent id, for the Variants popup.
  const childrenOf = (block) =>
    blocks.filter((b) => b.variantOf === (block._id || block.id) && !b.resumeId);

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
            <h2 className={styles.sectionTitle}>My Blocks ({libraryBlocks.length})</h2>
            <button className={styles.createBtn} onClick={openNewBlockModal}>
              + New Block
            </button>
          </div>
          {loading ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>Loading...</p>
            </div>
          ) : libraryBlocks.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>No blocks yet. Blocks are reusable resume components.</p>
            </div>
          ) : (
            <div className={styles.cardGrid}>
              {libraryBlocks.map((block) => {
                const variants = childrenOf(block);
                return (
                <div key={block._id || block.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>
                      {block.name || `${BLOCK_SCHEMA[block.type]?.label || ''} block`}
                    </h3>
                    <span className={styles.typeChip}>
                      {BLOCK_SCHEMA[block.type]?.label || block.type}
                    </span>
                    {variants.length > 0 && (
                      <button
                        className={styles.variantsBtn}
                        onClick={() => setVariantsModalBlock(block)}
                        title="Show all child variants of this block"
                      >
                        Variants ({variants.length})
                      </button>
                    )}
                  </div>
                  <p className={styles.cardMeta}>{getBlockDisplayText(block)}</p>
                  <p className={styles.cardTags}>
                    {resolveJobTypeNames(block.jobTypeIds || block.jobTypes).map((name) => (
                      <span key={name} className={styles.tag}>{name}</span>
                    ))}
                  </p>
                  <div className={styles.cardFooter}>
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
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Job Types ({Object.keys(jobTypes).length})</h2>
          <p className={styles.sectionDesc}>Manage your job types. These are shared across all your blocks.</p>
          <div className={styles.jobTypesList}>
            {Object.entries(jobTypes).map(([id, name]) => (
              <div key={id} className={styles.jobTypeItem}>
                <span className={styles.jobTypeName}>{name}</span>
                <button className={styles.deleteBtn} onClick={() => deleteJobType(id)} title="Delete">
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className={styles.addJobTypeRow}>
            <input
              type="text"
              className={styles.addJobTypeInput}
              placeholder="Add new job type..."
              value={newJobTypeName}
              onChange={(e) => setNewJobTypeName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addJobType();
              }}
            />
            <button className={styles.createBtn} onClick={addJobType}>
              Add
            </button>
          </div>
        </section>
      </main>

      {blockModalOpen && (
        <BlockModal
          tempBlock={tempBlock}
          setTempBlock={setTempBlock}
          editingBlockId={editingBlockId}
          jobTypes={jobTypes}
          onAddCustomJobType={(name) => {
            const id = 'jt' + Date.now();
            setJobTypes((prev) => ({ ...prev, [id]: name }));
            setTempBlock((prev) => ({
              ...prev,
              jobTypeIds: [...(prev.jobTypeIds || []), id],
            }));
            // Also persist to API
            fetch('/api/user/jobtypes', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                ...getAuthHeaders()
              },
              body: JSON.stringify({ id, name }),
            });
            invalidatePrefetch('jobtypes');
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
    </div>
  );
}
