import { useState, useCallback, useEffect } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useExportPdf } from './hooks/useExportPdf';
import {
  INITIAL_BLOCKS,
  INITIAL_RESUME,
  INITIAL_PERSONAL_INFO,
  DEFAULT_JOB_TYPES,
  SECTION_NAME_SUGGESTIONS,
  TEMPLATES,
} from './utils/constants';
import { generateId } from './utils/id';
import BlockLibrary from './components/BlockLibrary/BlockLibrary';
import ResumeCanvas from './components/ResumeCanvas/ResumeCanvas';
import PropertiesPanel from './components/PropertiesPanel/PropertiesPanel';
import BlockModal from './components/BlockModal/BlockModal';
import styles from './App.module.css';

export default function App() {
  const [blocks, setBlocks] = useLocalStorage('resume-builder-blocks', INITIAL_BLOCKS);
  const [resume, setResume] = useLocalStorage('resume-builder-canvas', INITIAL_RESUME);
  const [personalInfo, setPersonalInfo] = useLocalStorage('resume-builder-personal', INITIAL_PERSONAL_INFO);
  const [jobTypes, setJobTypes] = useLocalStorage('resume-builder-jobtypes', [...DEFAULT_JOB_TYPES]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [tempBlock, setTempBlock] = useState({ type: 'summary', content: {}, jobTypes: [] });

  const exportPdf = useExportPdf();

  // Migrate old single-field `contact` schema to separate email/phone/location
  useEffect(() => {
    if (personalInfo.contact && !personalInfo.email) {
      const parts = personalInfo.contact.split(' · ').map((s) => s.trim());
      setPersonalInfo((prev) => {
        const { contact, ...rest } = prev;
        return {
          ...rest,
          email: parts[0] || '',
          phone: parts[2] || parts[1] || '',
          location: parts[2] ? parts[1] : '',
        };
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Block CRUD ----------

  const openNewBlockModal = useCallback(() => {
    setEditingBlockId(null);
    setTempBlock({ type: 'summary', content: {}, jobTypes: [] });
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
    setResume((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => ({
        ...s,
        blockIds: s.blockIds.filter((id) => id !== blockId),
      })),
    }));
  }, [setBlocks, setResume]);

  // ---------- Job Types ----------

  const addCustomJobType = useCallback((name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setJobTypes((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setTempBlock((prev) => ({
      ...prev,
      jobTypes: prev.jobTypes.includes(trimmed) ? prev.jobTypes : [...prev.jobTypes, trimmed],
    }));
  }, [setJobTypes]);

  // ---------- Resume Operations ----------

  const updateResumeTitle = useCallback((title) => {
    setResume((prev) => ({ ...prev, title }));
  }, [setResume]);

  const setTemplate = useCallback((templateId) => {
    setResume((prev) => ({ ...prev, templateId }));
  }, [setResume]);

  const updatePersonalInfoField = useCallback((field, value) => {
    setPersonalInfo((prev) => ({ ...prev, [field]: value }));
  }, [setPersonalInfo]);

  const addSection = useCallback(() => {
    setResume((prev) => {
      const used = new Set(prev.sections.map((s) => s.title));
      const title = SECTION_NAME_SUGGESTIONS.find((n) => !used.has(n)) || 'Section';
      return {
        ...prev,
        sections: [...prev.sections, { id: generateId(), title, blockIds: [] }],
      };
    });
  }, [setResume]);

  const removeSection = useCallback((sectionId) => {
    if (!confirm('Remove this section from the resume?')) return;
    setResume((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== sectionId),
    }));
  }, [setResume]);

  const updateSectionTitle = useCallback((sectionId, title) => {
    setResume((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === sectionId ? { ...s, title } : s)),
    }));
  }, [setResume]);

  const clearResume = useCallback(() => {
    if (!confirm('Clear all sections from this resume? Blocks in the library will not be deleted.')) return;
    setResume((prev) => ({ ...prev, sections: [] }));
  }, [setResume]);

  // ---------- Drag and Drop ----------

  const handleDropFromLibrary = useCallback((blockId, sectionId, insertIndex) => {
    setResume((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => {
        if (s.id !== sectionId) return s;
        if (s.blockIds.includes(blockId)) return s;
        const newIds = [...s.blockIds];
        if (insertIndex == null || insertIndex >= newIds.length) {
          newIds.push(blockId);
        } else {
          newIds.splice(insertIndex, 0, blockId);
        }
        return { ...s, blockIds: newIds };
      }),
    }));
  }, [setResume]);

  const handleReorderInCanvas = useCallback((sourceSectionId, sourceIndex, targetSectionId, targetIndex) => {
    setResume((prev) => {
      const newSections = prev.sections.map((s) => ({ ...s, blockIds: [...s.blockIds] }));
      const sourceSection = newSections.find((s) => s.id === sourceSectionId);
      const targetSection = newSections.find((s) => s.id === targetSectionId);
      if (!sourceSection || !targetSection) return prev;

      let adjustedTarget = targetIndex;
      if (sourceSectionId === targetSectionId && sourceIndex < targetIndex) {
        adjustedTarget--;
      }

      const [movedId] = sourceSection.blockIds.splice(sourceIndex, 1);
      targetSection.blockIds.splice(adjustedTarget, 0, movedId);

      return { ...prev, sections: newSections };
    });
  }, [setResume]);

  const removeBlockFromSection = useCallback((sectionId, index) => {
    setResume((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => {
        if (s.id !== sectionId) return s;
        const newIds = [...s.blockIds];
        newIds.splice(index, 1);
        return { ...s, blockIds: newIds };
      }),
    }));
  }, [setResume]);

  return (
    <div className={styles.app}>
      <header className={styles.header} data-print-hide>
        <h1 className={styles.headerTitle}>Modular Resume Builder</h1>
        <div className={styles.headerActions}>
          <button onClick={exportPdf}>Export PDF</button>
          <button className={styles.primary} onClick={openNewBlockModal}>+ New Block</button>
        </div>
      </header>

      <div className={styles.body}>
        <BlockLibrary
          blocks={blocks}
          jobTypes={jobTypes}
          onEditBlock={openEditBlockModal}
          onDeleteBlock={deleteBlock}
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
