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
import JobDescriptionPanel from './components/JobDescriptionPanel/JobDescriptionPanel';
import AIChat from './components/AIChat/AIChat';
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
  const [isCanvasBlockDragging, setIsCanvasBlockDragging] = useState(false);

  const [saveStatus, setSaveStatus] = useState(''); // '' | 'saving' | 'saved' | 'error'
  const exportPdf = useExportPdf();

  // Right panel tab state
  const [activeRightTab, setActiveRightTab] = useState('properties'); // 'properties' | 'jobDescription'
  const [extractedKeywords, setExtractedKeywords] = useState([]);

  // personalInfo now lives inside the resume object
  const personalInfo = resume.personalInfo || {};

  // Helper to get auth headers
  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
  });

  // ---------- Fetch job types from user profile ----------
  useEffect(() => {
    const email = user?.email || DEFAULT_OWNER;
    fetch('/api/user/jobtypes', { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((data) => {
        if (Object.keys(data).length === 0) {
          // Seed defaults if user has no job types
          setJobTypes(DEFAULT_JOB_TYPES_MAP);
          // Also persist defaults to API
          Object.entries(DEFAULT_JOB_TYPES_MAP).forEach(([id, name]) => {
            fetch('/api/user/jobtypes', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                ...getAuthHeaders()
              },
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
      
      // Fetch blocks from MongoDB for the authenticated user
      const email = user?.email || DEFAULT_OWNER;
      fetch('/api/blocks', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
        }
      })
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
      
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, setResume, setBlocks, user?.email]);

  // ---------- Fetch resume and blocks from MongoDB if ?resume=<id> ----------
  useEffect(() => {
    const resumeId = searchParams.get('resume');
    if (!resumeId) return;

    const authToken = localStorage.getItem('auth-token');
    const headers = { 'Authorization': `Bearer ${authToken}` };

    // Fetch the specific resume
    fetch('/api/resumes', { headers })
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
    fetch('/api/blocks', { headers })
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
  }, [searchParams, setSearchParams, setResume, setBlocks]);

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
      
      // Track new job types that need to be created
      const newJobTypes = {};
      
      const migrated = prev.map((b) => {
        if (b.jobTypeIds) return b;
        if (!b.jobTypes) return { ...b, jobTypeIds: [] };
        
        const ids = b.jobTypes.map((name) => {
          // If we have a matching ID, use it
          if (nameToId[name]) return nameToId[name];
          // Otherwise, create a new ID for this job type
          const newId = `jt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          newJobTypes[newId] = name;
          nameToId[name] = newId; // Cache for subsequent blocks
          return newId;
        });
        
        const { jobTypes: _, ...rest } = b;
        return { ...rest, jobTypeIds: ids };
      });
      
      // Persist new job types to the API
      if (Object.keys(newJobTypes).length > 0) {
        const email = user?.email || DEFAULT_OWNER;
        Object.entries(newJobTypes).forEach(([id, name]) => {
          fetch('/api/user/jobtypes', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
            },
            body: JSON.stringify({ email, id, name }),
          }).catch((err) => console.error('Failed to create job type:', err));
        });
        
        // Update local jobTypes state
        setJobTypes((prev) => ({ ...prev, ...newJobTypes }));
      }
      
      return migrated;
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

  const saveBlock = useCallback(async () => {
    const owner = user?.email || DEFAULT_OWNER;
    const blockId = editingBlockId || generateId();
    
    // Prepare block data for API (flatten content fields)
    const { jobTypeIds, type, ...contentFields } = tempBlock;
    const blockData = {
      id: blockId,
      owner,
      type,
      jobTypeIds: jobTypeIds || [],
      ...contentFields,
    };

    try {
      // Save to MongoDB
      const res = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
        },
        body: JSON.stringify(blockData),
      });

      if (!res.ok) throw new Error('Failed to save block');

      // Update local state
      if (editingBlockId) {
        setBlocks((prev) =>
          prev.map((b) => (b.id === editingBlockId ? { ...tempBlock, id: editingBlockId } : b)),
        );
      } else {
        setBlocks((prev) => [...prev, { ...tempBlock, id: blockId }]);
      }
      closeModal();
    } catch (err) {
      console.error('Save block error:', err);
      alert('Failed to save block to server');
    }
  }, [editingBlockId, tempBlock, setBlocks, closeModal, user?.email]);

  const deleteBlock = useCallback(async (blockId) => {
    if (!confirm('Delete this block from the library? It will also be removed from any resume using it.')) return;
    
    try {
      // Delete from MongoDB
      const res = await fetch(`/api/blocks/${blockId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
        }
      });

      if (!res.ok) throw new Error('Failed to delete block');

      // Update local state
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
      setResume((prev) => {
        const newSections = { ...prev.sections };
        for (const key of Object.keys(newSections)) {
          newSections[key] = newSections[key].filter((id) => id !== blockId);
        }
        return { ...prev, sections: newSections };
      });
    } catch (err) {
      console.error('Delete block error:', err);
      alert('Failed to delete block from server');
    }
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
      headers: { 
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
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
      // Find first unused suggestion
      let title = SECTION_NAME_SUGGESTIONS.find((n) => !used.has(n));
      
      // If all suggestions are used, generate a unique title
      if (!title) {
        let counter = 1;
        title = `Section ${counter}`;
        while (used.has(title)) {
          counter++;
          title = `Section ${counter}`;
        }
      }
      
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
    // Clear sections but keep the resume structure
    setResume((prev) => ({
      ...prev,
      sectionOrder: [],
      sections: {},
    }));
  }, [setResume]);

  // ---------- Save Resume to MongoDB ----------

  const saveResumeToDb = useCallback(async () => {
    const owner = user?.email || DEFAULT_OWNER;
    setSaveStatus('saving');

    // Generate new ID for new resumes (no _id means it's new)
    const resumeId = resume._id || `r-${Date.now()}`;

    try {
      const res = await fetch('/api/resumes', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
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

  // ---------- AI Auto-fill ----------

  const handleAutoFill = useCallback(async ({ jobDescription, keywords }) => {
    const owner = user?.email || DEFAULT_OWNER;

    // Slim view of the block library for the AI (strip Mongo/internal fields)
    const blockSummaries = blocks.map((b) => {
      const { id, type, _id, owner: _owner, jobTypeIds, ...fields } = b;
      return { id, type, ...fields };
    });

    const res = await fetch('/api/autofill-resume', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        jobDescription,
        keywords,
        resume: { sectionOrder: resume.sectionOrder, sections: resume.sections },
        blocks: blockSummaries,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to auto-fill resume');
    }

    const result = await res.json();
    const newBlocks = (result.newBlocks || []).map((b) => ({ ...b, owner }));

    if (newBlocks.length > 0) {
      setBlocks((prev) => [...prev, ...newBlocks]);
      // Persist new blocks to MongoDB (best effort — canvas already works off local state)
      fetch('/api/blocks/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(newBlocks),
      }).catch((err) => console.error('Failed to persist auto-filled blocks:', err));
    }

    const addedSections = Object.keys(result.sections || {}).filter(
      (title) => !(resume.sections || {})[title],
    );

    setResume((prev) => {
      const sections = { ...(prev.sections || {}) };
      for (const [title, ids] of Object.entries(result.sections || {})) {
        if (!sections[title]) {
          sections[title] = ids;
        }
      }

      // Use the server's computed order, but never drop existing sections
      const serverOrder = Array.isArray(result.sectionOrder) ? result.sectionOrder : [];
      const mergedOrder = serverOrder.filter((t) => sections[t] !== undefined);
      for (const t of prev.sectionOrder || []) {
        if (!mergedOrder.includes(t) && sections[t] !== undefined) mergedOrder.push(t);
      }

      return { ...prev, sections, sectionOrder: mergedOrder };
    });

    if (addedSections.length === 0) {
      return 'Resume already has all default sections';
    }

    const placedCount = addedSections.reduce(
      (n, title) => n + ((result.sections || {})[title]?.length || 0),
      0,
    );
    const emptySections = addedSections.filter(
      (title) => !((result.sections || {})[title]?.length > 0),
    );

    let message = `Added ${addedSections.join(', ')}`;
    message += placedCount > 0
      ? ` and placed ${placedCount} matching block${placedCount === 1 ? '' : 's'} from your library.`
      : '.';
    if (emptySections.length > 0) {
      message += ` ${emptySections.join(', ')} had no matching blocks — drag some in from the library.`;
    }
    return message;
  }, [blocks, resume.sectionOrder, resume.sections, user?.email, setBlocks, setResume]);

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
      if (index < 0 || index >= ids.length) return prev;
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
          onCanvasDragEnd={() => setIsCanvasBlockDragging(false)}
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
          onCanvasDragStart={() => setIsCanvasBlockDragging(true)}
          onCanvasDragEnd={() => setIsCanvasBlockDragging(false)}
        />

        <div className={styles.rightPanel} data-print-hide>
          <div className={styles.tabBar}>
            <button
              className={`${styles.tab} ${activeRightTab === 'properties' ? styles.activeTab : ''}`}
              onClick={() => setActiveRightTab('properties')}
            >
              Properties
            </button>
            <button
              className={`${styles.tab} ${activeRightTab === 'jobDescription' ? styles.activeTab : ''}`}
              onClick={() => setActiveRightTab('jobDescription')}
            >
              Job Description
            </button>
          </div>
          <div className={styles.tabContent}>
            {activeRightTab === 'properties' ? (
              <PropertiesPanel
                resume={resume}
                personalInfo={personalInfo}
                onSetTemplate={setTemplate}
                onUpdatePersonalInfo={updatePersonalInfoField}
              />
            ) : (
              <JobDescriptionPanel onKeywordsExtracted={setExtractedKeywords} onAutoFill={handleAutoFill} />
            )}
          </div>
        </div>
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

      <AIChat resume={resume} blocks={blocks} />
    </div>
  );
}
