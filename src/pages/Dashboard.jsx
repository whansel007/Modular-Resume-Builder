import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BlockModal from '../components/BlockModal/BlockModal';
import { BLOCK_SCHEMA, DEFAULT_OWNER } from '../utils/constants';
import { generateId } from '../utils/id';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('auth-user') || 'null'));

  const [resumes, setResumes] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [jobTypes, setJobTypes] = useState({}); // { jt1: "Software Development", ... }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user?.email) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Block modal state
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [tempBlock, setTempBlock] = useState({ type: 'summary', jobTypeIds: [] });

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
      const [resumesRes, blocksRes, jobTypesRes] = await Promise.all([
        fetch('/api/resumes', { headers: getAuthHeaders() }),
        fetch('/api/blocks', { headers: getAuthHeaders() }),
        fetch('/api/user/jobtypes', { headers: getAuthHeaders() }),
      ]);

      if (!resumesRes.ok || !blocksRes.ok || !jobTypesRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const resumesData = await resumesRes.json();
      const blocksData = await blocksRes.json();
      const jobTypesData = await jobTypesRes.json();

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
      closeBlockModal();
    } catch (err) {
      console.error('Save block error:', err);
      setError('Failed to save block');
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
    } catch (err) {
      setError('Failed to delete job type');
    }
  };

  // ---------- Resume CRUD ----------

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

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.logo}>Modular Resume Builder</h1>
        <div className={styles.userSection}>
          <span className={styles.email}>{user?.email}</span>
          <button onClick={fetchData} className={styles.refreshBtn} title="Refresh">
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
            <Link to="/builder?new=true" className={styles.createBtn}>
              + New Resume
            </Link>
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
                <div key={resume._id} className={styles.card}>
                  <Link to={`/builder?resume=${resume._id}`} className={styles.cardLink}>
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
            <h2 className={styles.sectionTitle}>My Blocks ({blocks.length})</h2>
            <button className={styles.createBtn} onClick={openNewBlockModal}>
              + New Block
            </button>
          </div>
          {loading ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>Loading...</p>
            </div>
          ) : blocks.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>No blocks yet. Blocks are reusable resume components.</p>
            </div>
          ) : (
            <div className={styles.cardGrid}>
              {blocks.map((block) => (
                <div key={block._id || block.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>
                      {BLOCK_SCHEMA[block.type]?.label || block.type?.charAt(0).toUpperCase() + block.type?.slice(1)}
                    </h3>
                    <button
                      className={styles.editBtn}
                      onClick={() => openEditBlockModal(block)}
                      title="Edit block"
                    >
                      ✎
                    </button>
                  </div>
                  <p className={styles.cardMeta}>{getBlockDisplayText(block)}</p>
                  <p className={styles.cardTags}>
                    {resolveJobTypeNames(block.jobTypeIds || block.jobTypes).map((name) => (
                      <span key={name} className={styles.tag}>{name}</span>
                    ))}
                  </p>
                </div>
              ))}
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
          }}
          onSave={saveBlock}
          onClose={closeBlockModal}
        />
      )}
    </div>
  );
}
