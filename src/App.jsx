import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useExportPdf } from './hooks/useExportPdf';
import {
  INITIAL_BLOCKS,
  INITIAL_RESUME,
  BLANK_RESUME,
  BLANK_BLOCKS,
  SECTION_NAME_SUGGESTIONS,
  DEFAULT_OWNER,
  BLOCK_SCHEMA,
} from './utils/constants';
import { normalizePersonalInfo } from './utils/personalInfo';
import { generateId } from './utils/id';
import { getOrFetch, invalidatePrefetch } from './utils/prefetch';
import BlockLibrary from './components/BlockLibrary/BlockLibrary';
import ResumeCanvas from './components/ResumeCanvas/ResumeCanvas';
import PropertiesPanel from './components/PropertiesPanel/PropertiesPanel';
import JobDescriptionPanel from './components/JobDescriptionPanel/JobDescriptionPanel';
import AIChat from './components/AIChat/AIChat';
import BlockModal from './components/BlockModal/BlockModal';
import ExportModal from './components/ExportModal/ExportModal';
import DebugMenu from './components/DebugMenu/DebugMenu';
import styles from './App.module.css';

export default function App() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Read once: auth data only changes on routes that unmount this component.
  // A stable reference keeps the redirect effect from re-running every render.
  const user = useMemo(() => JSON.parse(localStorage.getItem('auth-user') || 'null'), []);

  const [blocks, setBlocks, resetBlocks] = useLocalStorage('resume-builder-blocks', INITIAL_BLOCKS);
  const [resume, setResume, resetResume] = useLocalStorage('resume-builder-canvas', INITIAL_RESUME);
  // tags is an object: { jt1: "Software Development", ... }
  const [tags, setTags] = useState({});

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [tempBlock, setTempBlock] = useState({ type: 'summary', tagIds: [] });
  const [isCanvasBlockDragging, setIsCanvasBlockDragging] = useState(false);

  const [saveStatus, setSaveStatus] = useState(''); // '' | 'saving' | 'saved' | 'error'
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const exportPdf = useExportPdf();

  const handleExportPdf = useCallback(() => {
    try {
      if (localStorage.getItem('mrb-export-guide-dismissed') === '1') {
        exportPdf();
        return;
      }
    } catch {
      // localStorage unavailable
    }
    setExportModalOpen(true);
  }, [exportPdf]);

  const handleConfirmExport = useCallback(() => {
    setExportModalOpen(false);
    setTimeout(() => {
      exportPdf();
    }, 50);
  }, [exportPdf]);

  // Right panel tab state
  const [activeRightTab, setActiveRightTab] = useState('properties'); // 'properties' | 'jobDescription'
  const [extractedKeywords, setExtractedKeywords] = useState([]);
  // Mirror of the text in the Job Description panel — fed to the AI chat so
  // the assistant can answer against the targeted job description too.
  const [jobDescription, setJobDescription] = useState('');

  // Account-level default personal info (name/email/phone/location). null
  // while the fetch is in flight; {} when the user never saved any. Used to
  // prefill new resumes and saved via the Properties panel button.
  const [defaultPersonalInfo, setDefaultPersonalInfo] = useState(null);
  const [saveDefaultStatus, setSaveDefaultStatus] = useState(''); // '' | 'saving' | 'saved' | 'error'

  // Deep-link import from the "Copy JD" browser extension. main.jsx stashes
  // the payload in sessionStorage (so it survives the login redirect); read
  // it here, consume it in the fresh-resume effect below.
  const [extImport] = useState(() => {
    try {
      const jd = sessionStorage.getItem('mrb-ext-jd');
      if (!jd) return null;
      return {
        jd,
        autofill: sessionStorage.getItem('mrb-ext-autofill') === '1',
        title: sessionStorage.getItem('mrb-ext-title') || '',
      };
    } catch {
      return null;
    }
  });
  // Auto-fill needs the block library loaded before it can place blocks.
  const [extBlocksReady, setExtBlocksReady] = useState(false);
  // One-shot guard so the reset effect below can't re-blank the resume when
  // searchParams change (extImport stays truthy for the panel's autoRun prop).
  const extConsumedRef = useRef(false);

  // personalInfo now lives inside the resume object
  const personalInfo = resume.personalInfo || {};

  // Helper to get auth headers
  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
  });

  // Redirect to login if not authenticated (the builder's save + AI features
  // all require a session; anonymous edits cannot be persisted).
  useEffect(() => {
    if (!user?.email) {
      navigate('/login');
    }
  }, [user, navigate]);

  useEffect(() => {
    const previousTitle = document.title;
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    document.title = resume.title?.trim() || 'Resume';
  }, [resume.title]);

  // ---------- Fetch tags from user profile ----------
  useEffect(() => {
    if (!user?.email) return;
    getOrFetch('tags', '/api/user/tags')
      .then((data) => {
        setTags(data);
      })
      .catch((err) => {
        // A 401 here means the stored token has expired or been revoked while
        // auth-user is still present. Clear the session and send the user to
        // login so they aren't stuck behind the redirect gate with a dead token.
        if (err.status === 401) {
          localStorage.removeItem('auth-token');
          localStorage.removeItem('auth-user');
          invalidatePrefetch(); // drop cached data from the dead session
          navigate('/login');
          return;
        }
        console.error('Failed to fetch tags:', err);
        setTags({});
      });
  }, [user?.email, navigate]);

  // ---------- Fetch saved default personal info ----------
  useEffect(() => {
    if (!user?.email) return;
    getOrFetch('defaults', '/api/user/defaults')
      .then((data) => setDefaultPersonalInfo(data))
      .catch(() => setDefaultPersonalInfo({})); // treat fetch failure as "no defaults"
  }, [user?.email]);

  // ---------- Save current personal info as the account default ----------
  const saveDefaultPersonalInfo = useCallback(async () => {
    setSaveDefaultStatus('saving');
    try {
      const payload = normalizePersonalInfo(resume.personalInfo || {});
      const res = await fetch('/api/user/defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save defaults');
      const saved = await res.json();
      setDefaultPersonalInfo(saved);
      invalidatePrefetch('defaults');
      setSaveDefaultStatus('saved');
    } catch (err) {
      console.error('Save default personal info error:', err);
      setSaveDefaultStatus('error');
    } finally {
      setTimeout(() => setSaveDefaultStatus(''), 2000);
    }
  }, [resume.personalInfo]);

  // ---------- Reset resume if ?new=true (or an extension deep link arrived) ----------
  useEffect(() => {
    // While logged out the builder redirects to /login anyway; leaving the
    // payload untouched lets the Dashboard resume the flow after sign-in.
    if (!user?.email) return;
    if (searchParams.get('new') !== 'true' && !extImport) return;
    // Wait for the defaults fetch to settle so prefilled values aren't lost
    // to a late response re-running this effect.
    if (defaultPersonalInfo === null) return;
    if (extImport && extConsumedRef.current) {
      setSearchParams({});
      return;
    }
    if (extImport) extConsumedRef.current = true;

    // New resumes start from the account's saved personal details (if any).
    const blankWithDefaults = {
      ...BLANK_RESUME,
      personalInfo: normalizePersonalInfo({ ...BLANK_RESUME.personalInfo, ...defaultPersonalInfo }),
    };
    setResume(
      extImport?.title ? { ...blankWithDefaults, title: extImport.title } : blankWithDefaults,
    );

    // Fetch blocks from MongoDB for the authenticated user
    getOrFetch('blocks', '/api/blocks')
      .then((blocks) => {
        // Flatten content fields for each block
        const flattened = blocks.map((b) => {
          const { content, ...rest } = b;
          return { ...rest, ...(content || {}), id: b._id };
        });
        setBlocks(flattened);
      })
      .catch((err) => console.error('Failed to fetch blocks:', err))
      .finally(() => {
        // Unblock the pending auto-fill even if the fetch failed.
        if (extImport) setExtBlocksReady(true);
      });

    if (extImport) {
      // Deep link consumed: drop the payload and switch to the JD tab so the
      // user can watch the automatic extract + auto-fill run.
      sessionStorage.removeItem('mrb-ext-jd');
      sessionStorage.removeItem('mrb-ext-autofill');
      sessionStorage.removeItem('mrb-ext-title');
      setActiveRightTab('jobDescription');
    }

    setSearchParams({});
  }, [searchParams, setSearchParams, setResume, setBlocks, extImport, user?.email, defaultPersonalInfo]);

  // ---------- Fetch resume and blocks from MongoDB if ?resume=<id> ----------
  useEffect(() => {
    const resumeId = searchParams.get('resume');
    if (!resumeId) return;

    // Uses the prefetch cache — if the card was hovered on the dashboard,
    // these resolve instantly; otherwise they fetch as normal.
    getOrFetch('resumes', '/api/resumes')
      .then((resumes) => {
        const found = resumes.find((r) => r._id === resumeId);
        if (found) {
          // Flatten personalInfo if needed and set resume
          setResume({ ...found, id: found._id, hiddenSections: found.hiddenSections || [], showLocations: !!found.showLocations });
        }
      })
      .catch((err) => console.error('Failed to fetch resume:', err));

    getOrFetch('blocks', '/api/blocks')
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

      if (!Array.isArray(next.hiddenSections)) {
        next = { ...next, hiddenSections: [] };
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

      // Ensure personalInfo is normalized with fields list
      next.personalInfo = normalizePersonalInfo(next.personalInfo);

      return next;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Block CRUD ----------

  const openNewBlockModal = useCallback(() => {
    setEditingBlockId(null);
    setTempBlock({ type: 'summary', tagIds: [] });
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
    const { tagIds, type, name, ...contentFields } = tempBlock;
    const blockData = {
      id: blockId,
      owner,
      type,
      name: name || '',
      tagIds: tagIds || [],
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

      // Changing an existing block's type moves it to the matching section on
      // the current resume so it never renders under the wrong heading.
      if (editingBlockId && tempBlock.type) {
        const prevBlock = blocks.find((b) => b.id === editingBlockId);
        const targetTitle = BLOCK_SCHEMA[tempBlock.type]?.label;
        if (prevBlock && prevBlock.type !== tempBlock.type && targetTitle) {
          setResume((prev) => {
            const sections = {};
            for (const [title, ids] of Object.entries(prev.sections || {})) {
              sections[title] = ids.filter((id) => id !== editingBlockId);
            }
            const alreadyInTarget = (prev.sections?.[targetTitle] || []).includes(editingBlockId);
            if (!alreadyInTarget) {
              sections[targetTitle] = [...(sections[targetTitle] || []), editingBlockId];
            }
            const sectionOrder = (prev.sectionOrder || []).includes(targetTitle)
              ? prev.sectionOrder
              : [...(prev.sectionOrder || []), targetTitle];
            return { ...prev, sections, sectionOrder };
          });
        }
      }

      // Update local state
      if (editingBlockId) {
        setBlocks((prev) =>
          prev.map((b) => (b.id === editingBlockId ? { ...tempBlock, id: editingBlockId } : b)),
        );
      } else {
        setBlocks((prev) => [...prev, { ...tempBlock, id: blockId }]);
      }
      invalidatePrefetch('blocks');
      closeModal();
    } catch (err) {
      console.error('Save block error:', err);
      alert('Failed to save block to server');
    }
  }, [editingBlockId, tempBlock, blocks, setBlocks, setResume, closeModal, user?.email]);

  // Save the block being edited as a resume-scoped VARIANT: a copy with a
  // new id, marked with this resume's id, swapped in for the original in
  // this resume's sections only. The library block stays untouched, so no
  // other resume is affected.
  const saveBlockAsVariant = useCallback(async () => {
    if (!editingBlockId) return;
    const owner = user?.email || DEFAULT_OWNER;
    const variantId = generateId();

    // New resumes still carry the placeholder id 'r1' — give the resume a
    // real id up front so the variant stays attached after the first save.
    const resumeId =
      resume._id || (resume.id && resume.id !== 'r1' ? resume.id : `r-${Date.now()}`);

    const { tagIds, type, name, ...contentFields } = tempBlock;
    const blockData = {
      ...contentFields,
      id: variantId,
      owner,
      type,
      name: name || '',
      tagIds: tagIds || [],
      variantIn: resumeId,
      variantOf: editingBlockId,
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

      if (!res.ok) throw new Error('Failed to save block variant');

      // Keep the original library block; add the variant alongside it.
      setBlocks((prev) => [
        ...prev,
        { ...tempBlock, id: variantId, variantIn: resumeId, variantOf: editingBlockId },
      ]);

      // Stabilize the resume id (matters for brand-new resumes) and swap the
      // original block for the variant in every section of this resume.
      setResume((prev) => {
        const newSections = {};
        for (const [key, ids] of Object.entries(prev.sections || {})) {
          newSections[key] = (ids || []).map((id) => (id === editingBlockId ? variantId : id));
        }
        return { ...prev, id: resumeId, sections: newSections };
      });

      invalidatePrefetch('blocks');
      closeModal();
    } catch (err) {
      console.error('Save block variant error:', err);
      alert('Failed to save block variant to server');
    }
  }, [editingBlockId, tempBlock, resume, setBlocks, setResume, closeModal, user?.email]);

  // Save the block being edited as a CHILD VARIANT: a copy stored in the
  // library under the parent block (variantOf set, variantIn null). It shows
  // up in the parent's variant dropdown and can be dragged onto any resume.
  const saveBlockAsChildVariant = useCallback(async () => {
    if (!editingBlockId) return;
    const owner = user?.email || DEFAULT_OWNER;
    const variantId = generateId();

    const { tagIds, type, name, ...contentFields } = tempBlock;
    const blockData = {
      ...contentFields,
      id: variantId,
      owner,
      type,
      name: name || '',
      tagIds: tagIds || [],
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

      setBlocks((prev) => [
        ...prev,
        { ...tempBlock, id: variantId, variantOf: editingBlockId, variantIn: null },
      ]);
      invalidatePrefetch('blocks');
      closeModal();
    } catch (err) {
      console.error('Save child variant error:', err);
      alert('Failed to save child variant to server');
    }
  }, [editingBlockId, tempBlock, setBlocks, closeModal, user?.email]);

  // Duplicate a block: creates a full copy with a new id and opens the
  // editor on the copy so it can be tweaked right away. Variants stay
  // scoped to their resume. Pass targetSection (from a canvas block) to
  // also drop the copy right after the original in that section.
  const duplicateBlock = useCallback(async (blockId, targetSection = null) => {
    const source = blocks.find((b) => b.id === blockId);
    if (!source) return;
    const owner = user?.email || DEFAULT_OWNER;
    const newId = generateId();

    // Variants copy their resume scope and lineage; library blocks stay global.
    const variantIn = source.variantIn || null;
    const variantOf = variantIn ? source.variantOf || source.id : null;

    // Strip ids + server metadata that may ride along on flattened blocks,
    // leaving only the actual content fields.
    const META_KEYS = new Set(['id', '_id', 'owner', '__v', 'createdAt', 'updatedAt', 'content', 'type', 'tagIds', 'variantIn', 'variantOf']);
    const contentFields = Object.fromEntries(
      Object.entries(source).filter(([k]) => !META_KEYS.has(k))
    );
    const blockData = {
      ...contentFields,
      id: newId,
      owner,
      type: source.type,
      tagIds: source.tagIds || [],
      ...(variantIn ? { variantIn, variantOf } : {}),
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

      const copy = { ...source, id: newId, variantIn, variantOf };
      setBlocks((prev) => [...prev, copy]);

      // Canvas duplicate: insert the copy right after the original.
      if (targetSection) {
        setResume((prev) => {
          const ids = [...((prev.sections || {})[targetSection] || [])];
          const idx = ids.indexOf(blockId);
          ids.splice(idx === -1 ? ids.length : idx + 1, 0, newId);
          return { ...prev, sections: { ...prev.sections, [targetSection]: ids } };
        });
      }

      invalidatePrefetch('blocks');

      // Open the editor on the copy for immediate tweaking.
      setEditingBlockId(newId);
      setTempBlock(JSON.parse(JSON.stringify(copy)));
      setModalOpen(true);
    } catch (err) {
      console.error('Duplicate block error:', err);
      alert('Failed to duplicate block');
    }
  }, [blocks, setBlocks, setResume, user?.email]);

  const deleteBlock = useCallback(async (blockId) => {
    // Deleting a parent takes its library child variants with it so none are
    // left orphaned in the database.
    const children = blocks.filter((b) => b.variantOf === blockId && !b.variantIn);
    const message = children.length
      ? `Delete this block and its ${children.length} child variant${children.length === 1 ? '' : 's'}? It will also be removed from any resume using it.`
      : 'Delete this block from the library? It will also be removed from any resume using it.';
    if (!confirm(message)) return;

    try {
      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
      };
      // Delete from MongoDB — the server cascade-deletes library child
      // variants of a deleted parent, so one request is enough.
      const res = await fetch(`/api/blocks/${blockId}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('Failed to delete block');

      // Update local state (resume-scoped variants stay on their resume).
      setBlocks((prev) => prev.filter((b) => b.id !== blockId && !(b.variantOf === blockId && !b.variantIn)));
      setResume((prev) => {
        const newSections = { ...prev.sections };
        for (const key of Object.keys(newSections)) {
          newSections[key] = (newSections[key] || []).filter((id) => id !== blockId);
        }
        return { ...prev, sections: newSections };
      });
      invalidatePrefetch('blocks');
    } catch (err) {
      console.error('Delete block error:', err);
      alert('Failed to delete block from server');
    }
  }, [blocks, setBlocks, setResume]);

  // ---------- Tags ----------

  const addCustomTag = useCallback((name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = 'jt' + Date.now();
    setTags((prev) => ({ ...prev, [id]: trimmed }));
    setTempBlock((prev) => ({
      ...prev,
      tagIds: [...(prev.tagIds || []), id],
    }));
    // Persist to API
    const email = user?.email || DEFAULT_OWNER;
    fetch('/api/user/tags', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ email, id, name: trimmed }),
    }).then(() => invalidatePrefetch('tags'));
  }, [user?.email]);

  // ---------- Resume Operations ----------

  const updateResumeTitle = useCallback((title) => {
    setResume((prev) => ({ ...prev, title }));
  }, [setResume]);

  const setTemplate = useCallback((templateId) => {
    setResume((prev) => ({ ...prev, templateId }));
  }, [setResume]);

  const toggleShowLocations = useCallback((showLocations) => {
    setResume((prev) => ({
      ...prev,
      showLocations: typeof showLocations === 'boolean' ? showLocations : !prev.showLocations,
    }));
  }, [setResume]);

  const updatePersonalInfoField = useCallback((fieldOrObject, value) => {
    setResume((prev) => {
      let nextInfo;
      if (typeof fieldOrObject === 'object' && fieldOrObject !== null) {
        nextInfo = fieldOrObject;
      } else {
        nextInfo = { ...prev.personalInfo, [fieldOrObject]: value };
      }
      return {
        ...prev,
        personalInfo: normalizePersonalInfo(nextInfo),
      };
    });
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
        hiddenSections: (prev.hiddenSections || []).filter((t) => t !== sectionTitle),
      };
    });
  }, [setResume]);

  const updateSectionTitle = useCallback((oldTitle, newTitle, sectionIdx) => {
    if (oldTitle === newTitle) return;
    setResume((prev) => {
      const order = [...(prev.sectionOrder || [])];
      const targetIdx = typeof sectionIdx === 'number' ? sectionIdx : order.indexOf(oldTitle);
      const actualOldTitle = targetIdx >= 0 && order[targetIdx] !== undefined ? order[targetIdx] : oldTitle;

      if (targetIdx >= 0 && targetIdx < order.length) {
        order[targetIdx] = newTitle;
      } else {
        const idx = order.indexOf(oldTitle);
        if (idx >= 0) order[idx] = newTitle;
      }

      const newSections = {};
      let matched = false;
      for (const [key, val] of Object.entries(prev.sections || {})) {
        if (key === actualOldTitle && !matched) {
          newSections[newTitle] = val;
          matched = true;
        } else {
          newSections[key] = val;
        }
      }
      if (!matched) {
        newSections[newTitle] = prev.sections?.[actualOldTitle] || [];
      }
      return {
        ...prev,
        sectionOrder: order,
        sections: newSections,
        hiddenSections: (prev.hiddenSections || []).map((t) => (t === actualOldTitle ? newTitle : t)),
      };
    });
  }, [setResume]);

  const reorderSections = useCallback((fromIndex, toIndex) => {
    setResume((prev) => {
      const order = [...(prev.sectionOrder || [])];
      if (
        fromIndex < 0 ||
        fromIndex >= order.length ||
        toIndex < 0 ||
        toIndex >= order.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }
      const [moved] = order.splice(fromIndex, 1);
      order.splice(toIndex, 0, moved);
      return {
        ...prev,
        sectionOrder: order,
      };
    });
  }, [setResume]);

  const toggleSectionVisibility = useCallback((sectionTitle) => {
    setResume((prev) => {
      const hidden = prev.hiddenSections || [];
      const hiddenSections = hidden.includes(sectionTitle)
        ? hidden.filter((t) => t !== sectionTitle)
        : [...hidden, sectionTitle];
      return { ...prev, hiddenSections };
    });
  }, [setResume]);

  const clearResume = useCallback(() => {
    if (!confirm('Clear all sections from this resume? Blocks in the library will not be deleted.')) return;
    // Clear sections but keep the resume structure
    setResume((prev) => ({
      ...prev,
      sectionOrder: [],
      sections: {},
      hiddenSections: [],
    }));
  }, [setResume]);

  // ---------- Save Resume to MongoDB ----------

  const saveResumeToDb = useCallback(async () => {
    const owner = user?.email || DEFAULT_OWNER;
    setSaveStatus('saving');

    // Generate new ID for new resumes (no _id means it's new).
    // Reuse resume.id when it's already a real id so resume-scoped block
    // variants (which reference resume.id) stay attached after the first save.
    const resumeId = resume._id || (resume.id && resume.id !== 'r1' ? resume.id : `r-${Date.now()}`);

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
          hiddenSections: resume.hiddenSections || [],
          showLocations: !!resume.showLocations,
        }),
      });

      if (!res.ok) throw new Error('Save failed');
      const saved = await res.json();

      // Update local resume with the saved _id
      if (saved._id && saved._id !== resume._id) {
        setResume((prev) => ({ ...prev, _id: saved._id }));
      }

      // Dashboard list of resumes is now stale
      invalidatePrefetch('resumes');

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
      const { id, type, _id, owner: _owner, tagIds, ...fields } = b;
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
      })
        .then(() => invalidatePrefetch('blocks'))
        .catch((err) => console.error('Failed to persist auto-filled blocks:', err));
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
          <button onClick={handleExportPdf}>Export PDF</button>
          <button
            className={styles.saveBtn}
            onClick={saveResumeToDb}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'error' ? 'Save Failed' : 'Save'}
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <BlockLibrary
          blocks={blocks}
          tags={tags}
          onNewBlock={openNewBlockModal}
          onEditBlock={openEditBlockModal}
          onDuplicateBlock={duplicateBlock}
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
          onReorderSections={reorderSections}
          onToggleSectionVisibility={toggleSectionVisibility}
          onClearResume={clearResume}
          onDropFromLibrary={handleDropFromLibrary}
          onReorderInCanvas={handleReorderInCanvas}
          onRemoveBlockFromSection={removeBlockFromSection}
          onEditBlock={openEditBlockModal}
          onDuplicateBlock={duplicateBlock}
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
            {/* Both panels stay mounted; visibility toggles via CSS. Remounting
                JobDescriptionPanel would reset its one-shot refs and re-run the
                paid extract + auto-fill calls on every tab switch. */}
            <div
              className={styles.tabPane}
              style={{ display: activeRightTab === 'properties' ? 'flex' : 'none' }}
            >
              <PropertiesPanel
                resume={resume}
                personalInfo={personalInfo}
                onSetTemplate={setTemplate}
                onToggleShowLocations={toggleShowLocations}
                onUpdatePersonalInfo={updatePersonalInfoField}
                onSaveDefaultPersonalInfo={saveDefaultPersonalInfo}
                saveDefaultStatus={saveDefaultStatus}
                onReorderSections={reorderSections}
                onAddSection={addSection}
                onRemoveSection={removeSection}
              />
            </div>
            <div
              className={styles.tabPane}
              style={{ display: activeRightTab === 'jobDescription' ? 'flex' : 'none' }}
            >
              <JobDescriptionPanel
                onKeywordsExtracted={setExtractedKeywords}
                onAutoFill={handleAutoFill}
                onJobDescriptionChange={setJobDescription}
                initialJobDescription={extImport?.jd || ''}
                autoRun={!!(extImport && extImport.autofill)}
                autoFillReady={extBlocksReady}
              />
            </div>
          </div>
        </div>
      </div>

      {modalOpen && (
        <BlockModal
          tempBlock={tempBlock}
          setTempBlock={setTempBlock}
          editingBlockId={editingBlockId}
          tags={tags}
          onAddCustomTag={addCustomTag}
          onSave={saveBlock}
          onSaveVariant={saveBlockAsVariant}
          onSaveChildVariant={saveBlockAsChildVariant}
          onClose={closeModal}
        />
      )}

      {exportModalOpen && (
        <ExportModal
          onConfirm={handleConfirmExport}
          onClose={() => setExportModalOpen(false)}
        />
      )}

      <AIChat resume={resume} blocks={blocks} jobDescription={jobDescription} />
    </div>
  );
}
