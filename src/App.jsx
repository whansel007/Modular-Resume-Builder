import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useExportPdf } from './hooks/useExportPdf';
import {
  INITIAL_BLOCKS,
  INITIAL_RESUME,
  BLANK_RESUME,
  BLANK_BLOCKS,
  DEFAULT_JOB_TYPES_MAP,
  SECTION_NAME_SUGGESTIONS,
  DEFAULT_OWNER,
} from './utils/constants';
import { generateId } from './utils/id';
import BlockLibrary from './components/BlockLibrary/BlockLibrary';
import ResumeCanvas from './components/ResumeCanvas/ResumeCanvas';
import PropertiesPanel from './components/PropertiesPanel/PropertiesPanel';
import BlockModal from './components/BlockModal/BlockModal';
import DebugMenu from './components/DebugMenu/DebugMenu';
import styles from './App.module.css';

export default function App() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = JSON.parse(localStorage.getItem('auth-user') || 'null');

  const [blocks, setBlocks, resetBlocks] = useLocalStorage('resume-builder-blocks', INITIAL_BLOCKS);
  const [resume, setResume, resetResume] = useLocalStorage('resume-builder-canvas', INITIAL_RESUME);
  // jobTypes is now an object: { jt1: "Software Development", ... }
  const [jobTypes, setJobTypes] = useState({});

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [tempBlock, setTempBlock] = useState({ type: 'summary', jobTypeIds: [] });

  const [saveStatus, setSaveStatus] = useState(''); // '' | 'saving' | 'saved' | 'error'
  const exportPdf = useExportPdf();

  // personalInfo now lives inside the resume object
  const personalInfo = resume.personalInfo || {};

  // ---------- Fetch job types from user profile ----------
  useEffect(() => {
    const email = user?.email || DEFAULT_OWNER;
    fetch(`/api/user/jobtypes?email=${encodeURIComponent(email)}`)
      .then((res) => res.json())
      .then((data) => {
        if (Object.keys(data).length === 0) {
          // Seed defaults if user has no job types
          setJobTypes(DEFAULT_JOB_TYPES_MAP);
          // Also persist defaults to API
          Object.entries(DEFAULT_JOB_TYPES_MAP).forEach(([id, name]) => {
            fetch('/api/user/jobtypes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, id, name }),
            });
          });
        } else {
          setJobTypes(data);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch job types:', err);
        setJobTypes(DEFAULT_JOB_TYPES_MAP);
      });
  }, [user?.email]);

  // ---------- Reset resume if ?new=true ----------
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setResume(BLANK_RESUME);
      // Don't clear blocks - they're shared across all resumes
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, setResume]);

  // ---------- Fetch resume and blocks from MongoDB if ?resume=<id> ----------
  useEffect(() => {
    const resumeId = searchParams.get('resume');
    if (!resumeId) return;

    const email = user?.email || DEFAULT_OWNER;

    // Fetch the specific resume
    fetch(`/api/resumes?owner=${encodeURIComponent(email)}`)
      .then((res) => res.json())
      .then((resumes) => {
        const found = resumes.find((r) => r._id === resumeId);
        if (found) {
          // Flatten personalInfo if needed and set resume
          setResume({ ...found, id: found._id });
        }
      })
      .catch((err) => console.error('Failed to fetch resume:', err));

    // Fetch blocks for this user
    fetch(`/api/blocks?owner=${encodeURIComponent(email)}`)
      .then((res) => res.json())
      .then((blocks) => {
        // Flatten content fields for each block
        const flattened = blocks.map((b) => {
          const { content, ...rest } = b;
          return { ...rest, ...(content || {}), id: b._id };
        });
        setBlocks(flattened);
      })
      .catch((err) => console.error('Failed to fetch blocks:', err));

    // Clear the query param so we don't re-fetch on every render
    setSearchParams({});
  }, [searchParams, setSearchParams, user?.email, setResume, setBlocks]);

  // ---------- Data migrations (old localStorage formats) ----------
  useEffect(() => {
    // Migrate blocks: flatten nested `content` into top-level properties
    setBlocks((prev) => {
      if (!prev.some((b) => b.content)) return prev;
      return prev.map((b) => {
        if (!b.content) return b;
        const { content, ...rest } = b;
        return { ...rest, ...content };
      });
    });

    // Migrate blocks: jobTypes (string array) → jobTypeIds
    setBlocks((prev) => {
      if (!prev.some((b) => b.jobTypes && !b.jobTypeIds)) return prev;
      // Build reverse lookup: name → id
      const nameToId = {};
      Object.entries(jobTypes).forEach(([id, name]) => {
        nameToId[name] = id;
      });
      return prev.map((b) => {
        if (b.jobTypeIds) return b;
        if (!b.jobTypes) return { ...b, jobTypeIds: [] };
        const ids = b.jobTypes.map((name) => nameToId[name]).filter(Boolean);
        const { jobTypes: _, ...rest } = b;
        return { ...rest, jobTypeIds: ids };
      });
    });

    // Migrate resume: old sections array → { sectionOrder, sections: { Title: [ids] } }
    // Also migrate old separate personalInfo localStorage into resume.personalInfo
    setResume((prev) => {
      let next = prev;

      // Migrate sections array → object
      if (Array.isArray(next.sections)) {
        const sectionOrder = next.sections.map((s) => s.title);
        const sections = {};
        next.sections.forEach((s) => {
          sections[s.title] = s.blockIds || [];
        });
        next = { ...next, sectionOrder, sections };
      }

      if (!next.sectionOrder) {
        next = { ...next, sectionOrder: Object.keys(next.sections || {}) };
      }

      // Migrate separate personalInfo localStorage key into resume
      if (!next.personalInfo) {
        try {
          const stored = localStorage.getItem('resume-builder-personal');
          const oldInfo = stored ? JSON.parse(stored) : {};
          // Handle old `contact` string format
          if (oldInfo.contact) {
            const parts = oldInfo.contact.split(' · ').map((s) => s.trim());
            next.personalInfo = {
              name: oldInfo.name || '',
              email: oldInfo.email || parts[0] || '',
              phone: oldInfo.phone || parts[2] || parts[1] || '',
              location: oldInfo.location || (parts[2] ? parts[1] : ''),
            };
          } else {
            next.personalInfo = {
              name: oldInfo.name || '',
              email: oldInfo.email || '',
              phone: oldInfo.phone || '',
              location: oldInfo.location || '',
            };
          }
          // Clean up old localStorage key
          localStorage.removeItem('resume-builder-personal');
        } catch {
          next.personalInfo = { name: '', email: '', phone: '', location: '' };
        }
      }

      // Ensure all personalInfo fields exist
      next.personalInfo = {
        name: '',
        email: '',
        phone: '',
        location: '',
        ...next.personalInfo,
      };

      return next;
    });
  }, [jobTypes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Block CRUD ----------

  const openNewBlockModal = useCallback(() => {
    setEditingBlockId(null);
    setTempBlock({ type: 'summary', jobTypeIds: [] });
    setModalOpen(true);
  }, []);

  const openEditBlockModal = useCallback((blockId) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;
    setEditingBlockId(blockId);
    setTempBlock(JSON.parse(JSON.stringify(block)));
    setModalOpen(true);
  }, [blocks]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingBlockId(null);
  }, []);

  const saveBlock = useCallback(() => {
    if (editingBlockId) {
      setBlocks((prev) =>
        prev.map((b) => (b.id === editingBlockId ? { ...tempBlock, id: editingBlockId } : b)),
      );
    } else {
      setBlocks((prev) => [...prev, { ...tempBlock, id: generateId() }]);
    }
    closeModal();
  }, [editingBlockId, tempBlock, setBlocks, closeModal]);

  const deleteBlock = useCallback((blockId) => {
    if (!confirm('Delete this block from the library? It will also be removed from any resume using it.')) return;
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    setResume((prev) => {
      const newSections = { ...prev.sections };
      for (const key of Object.keys(newSections)) {
        newSections[key] = newSections[key].filter((id) => id !== blockId);
      }
      return { ...prev, sections: newSections };
    });
  }, [setBlocks, setResume]);

  // ---------- Job Types ----------

  const addCustomJobType = useCallback((name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = 'jt' + Date.now();
    setJobTypes((prev) => ({ ...prev, [id]: trimmed }));
    setTempBlock((prev) => ({
      ...prev,
      jobTypeIds: [...(prev.jobTypeIds || []), id],
    }));
    // Persist to API
    const email = user?.email || DEFAULT_OWNER;
    fetch('/api/user/jobtypes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, id, name: trimmed }),
    });
  }, [user?.email]);

  // ---------- Resume Operations ----------

  const updateResumeTitle = useCallback((title) => {
    setResume((prev) => ({ ...prev, title }));
  }, [setResume]);

  const setTemplate = useCallback((templateId) => {
    setResume((prev) => ({ ...prev, templateId }));
  }, [setResume]);

  const updatePersonalInfoField = useCallback((field, value) => {
    setResume((prev) => ({
      ...prev,
      personalInfo: { ...prev.personalInfo, [field]: value },
    }));
  }, [setResume]);

  const addSection = useCallback(() => {
    setResume((prev) => {
      const used = new Set(prev.sectionOrder || []);
      const title = SECTION_NAME_SUGGESTIONS.find((n) => !used.has(n)) || 'Section';
      return {
        ...prev,
        sectionOrder: [...(prev.sectionOrder || []), title],
        sections: { ...(prev.sections || {}), [title]: [] },
      };
    });
  }, [setResume]);

  const removeSection = useCallback((sectionTitle) => {
    if (!confirm('Remove this section from the resume?')) return;
    setResume((prev) => {
      const newSections = { ...prev.sections };
      delete newSections[sectionTitle];
      return {
        ...prev,
        sectionOrder: (prev.sectionOrder || []).filter((t) => t !== sectionTitle),
        sections: newSections,
      };
    });
  }, [setResume]);

  const updateSectionTitle = useCallback((oldTitle, newTitle) => {
    if (oldTitle === newTitle) return;
    setResume((prev) => {
      const newSections = {};
      for (const key of Object.keys(prev.sections || {})) {
        newSections[key === oldTitle ? newTitle : key] = prev.sections[key];
      }
      return {
        ...prev,
        sectionOrder: (prev.sectionOrder || []).map((t) => (t === oldTitle ? newTitle : t)),
        sections: newSections,
      };
    });
  }, [setResume]);

  const clearResume = useCallback(() => {
    if (!confirm('Clear all sections from this resume? Blocks in the library will not be deleted.')) return;
    resetResume();
  }, [resetResume]);

  // ---------- Save Resume to MongoDB ----------

  const saveResumeToDb = useCallback(async () => {
    const owner = user?.email || DEFAULT_OWNER;
    setSaveStatus('saving');

    // Generate new ID for new resumes (no _id means it's new)
    const resumeId = resume._id || `r-${Date.now()}`;

    try {
      const res = await fetch('/api/resumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: resumeId,
          owner,
          title: resume.title,
          templateId: resume.templateId,
          personalInfo: resume.personalInfo,
          sectionOrder: resume.sectionOrder,
          sections: resume.sections,
        }),
      });

      if (!res.ok) throw new Error('Save failed');
      const saved = await res.json();

      // Update local resume with the saved _id
      if (saved._id && saved._id !== resume._id) {
        setResume((prev) => ({ ...prev, _id: saved._id }));
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      console.error('Save error:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  }, [resume, user?.email, setResume]);

  // ---------- Drag and Drop ----------

  const handleDropFromLibrary = useCallback((blockId, sectionTitle, insertIndex) => {
    setResume((prev) => {
      const currentIds = prev.sections[sectionTitle] || [];
      if (currentIds.includes(blockId)) return prev;
      const newIds = [...currentIds];
      if (insertIndex == null || insertIndex >= newIds.length) {
        newIds.push(blockId);
      } else {
        newIds.splice(insertIndex, 0, blockId);
      }
      return {
        ...prev,
        sections: { ...prev.sections, [sectionTitle]: newIds },
      };
    });
  }, [setResume]);

  const handleReorderInCanvas = useCallback((sourceTitle, sourceIndex, targetTitle, targetIndex) => {
    setResume((prev) => {
      const newSections = { ...prev.sections };
      const sourceIds = [...(newSections[sourceTitle] || [])];
      const targetIds = sourceTitle === targetTitle ? sourceIds : [...(newSections[targetTitle] || [])];

      let adjustedTarget = targetIndex;
      if (sourceTitle === targetTitle && sourceIndex < targetIndex) {
        adjustedTarget--;
      }

      const [movedId] = sourceIds.splice(sourceIndex, 1);
      targetIds.splice(adjustedTarget, 0, movedId);

      newSections[sourceTitle] = sourceIds;
      if (sourceTitle !== targetTitle) {
        newSections[targetTitle] = targetIds;
      }

      return { ...prev, sections: newSections };
    });
  }, [setResume]);

  const removeBlockFromSection = useCallback((sectionTitle, index) => {
    setResume((prev) => {
      const ids = [...(prev.sections[sectionTitle] || [])];
      ids.splice(index, 1);
      return {
        ...prev,
        sections: { ...prev.sections, [sectionTitle]: ids },
      };
    });
  }, [setResume]);

  return (
    <div className={styles.app}>
      <header className={styles.header} data-print-hide>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => navigate('/dashboard')} title="Back to Dashboard">
            ←
          </button>
          <input
            className={styles.headerTitleInput}
            value={resume.title}
            onChange={(e) => updateResumeTitle(e.target.value)}
            placeholder="Resume title..."
          />
        </div>
        <div className={styles.headerActions}>
          <DebugMenu resume={resume} blocks={blocks} />
          <button onClick={exportPdf}>Export PDF</button>
          <button
            className={styles.saveBtn}
            onClick={saveResumeToDb}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'error' ? 'Save Failed' : 'Save'}
          </button>
          <button className={styles.primary} onClick={openNewBlockModal}>+ New Block</button>
        </div>
      </header>

      <div className={styles.body}>
        <BlockLibrary
          blocks={blocks}
          jobTypes={jobTypes}
          onEditBlock={openEditBlockModal}
          onDeleteBlock={deleteBlock}
          onRemoveBlockFromResume={removeBlockFromSection}
          isCanvasBlockDragging={isCanvasBlockDragging}
          onCanvasDragEnd={handleCanvasDragEnd}
        />

        <ResumeCanvas
          resume={resume}
          blocks={blocks}
          personalInfo={personalInfo}
          onUpdateTitle={updateResumeTitle}
          onAddSection={addSection}
          onRemoveSection={removeSection}
          onUpdateSectionTitle={updateSectionTitle}
          onClearResume={clearResume}
          onDropFromLibrary={handleDropFromLibrary}
          onReorderInCanvas={handleReorderInCanvas}
          onRemoveBlockFromSection={removeBlockFromSection}
          onEditBlock={openEditBlockModal}
          onCanvasDragStart={handleCanvasDragStart}
          onCanvasDragEnd={handleCanvasDragEnd}
        />

        <PropertiesPanel
          resume={resume}
          personalInfo={personalInfo}
          onSetTemplate={setTemplate}
          onUpdatePersonalInfo={updatePersonalInfoField}
        />
      </div>

      {modalOpen && (
        <BlockModal
          tempBlock={tempBlock}
          setTempBlock={setTempBlock}
          editingBlockId={editingBlockId}
          jobTypes={jobTypes}
          onAddCustomJobType={addCustomJobType}
          onSave={saveBlock}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
