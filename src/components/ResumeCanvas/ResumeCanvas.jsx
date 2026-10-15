import { useState, useCallback } from 'react';
import { BLOCK_SCHEMA, TEMPLATES } from '../../utils/constants';
import { normalizePersonalInfo, resolveContactUrl } from '../../utils/personalInfo';
import { DRAG_KEYS, DRAG_SOURCE } from '../../utils/dragKeys';
import ResumeBlock from './ResumeBlock';
import styles from './ResumeCanvas.module.css';

export default function ResumeCanvas({
  resume,
  blocks,
  personalInfo,
  onUpdateTitle,
  onAddSection,
  onRemoveSection,
  onUpdateSectionTitle,
  onReorderSections,
  onToggleSectionVisibility,
  onClearResume,
  onDropFromLibrary,
  onReorderInCanvas,
  onRemoveBlockFromSection,
  onEditBlock,
  onDuplicateBlock,
  onCanvasDragStart = () => {},
  onCanvasDragEnd = () => {},
}) {
  const [dragOverSection, setDragOverSection] = useState(null);
  const [draggedSectionIdx, setDraggedSectionIdx] = useState(null);
  const [sectionDropTarget, setSectionDropTarget] = useState(null);

  const template = TEMPLATES[resume.templateId] || TEMPLATES.classic;
  const sectionOrder = resume.sectionOrder || [];
  const sections = resume.sections || {};
  const hiddenSections = resume.hiddenSections || [];

  const normInfo = normalizePersonalInfo(personalInfo);
  const contactItems = Array.isArray(normInfo.fields)
    ? normInfo.fields
        .filter((f) => (f.value || '').trim())
        .map((f) => ({
          id: f.id,
          text: (f.value || '').trim(),
          url: resolveContactUrl(f),
        }))
    : [
        { id: 'c-email', text: (normInfo.email || '').trim(), url: normInfo.email ? `mailto:${normInfo.email.trim()}` : null },
        { id: 'c-phone', text: (normInfo.phone || '').trim(), url: null },
        { id: 'c-loc', text: (normInfo.location || '').trim(), url: null },
      ].filter((item) => item.text);

  const handleSectionDragStart = (e, index, title) => {
    setDraggedSectionIdx(index);
    e.dataTransfer.setData(DRAG_KEYS.SOURCE, DRAG_SOURCE.SECTION);
    e.dataTransfer.setData(DRAG_KEYS.SECTION_INDEX, String(index));
    e.dataTransfer.setData(DRAG_KEYS.SECTION_TITLE, title);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSectionDragEnd = () => {
    setDraggedSectionIdx(null);
    setSectionDropTarget(null);
  };

  const handleDragOver = useCallback((e, sectionIdx, sectionTitle) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // If dragging a section, compute drop target relative to this section
    const isSectionDrag = draggedSectionIdx !== null || e.dataTransfer.types.includes(DRAG_KEYS.SECTION_INDEX);
    if (isSectionDrag) {
      setDragOverSection(null);
      const rect = e.currentTarget.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const position = e.clientY < midY ? 'before' : 'after';
      setSectionDropTarget((prev) => {
        if (prev?.index === sectionIdx && prev?.position === position) return prev;
        return { index: sectionIdx, position };
      });
      return;
    }

    // Otherwise dragging a block into this section
    setSectionDropTarget(null);
    setDragOverSection(sectionTitle);
  }, [draggedSectionIdx]);

  const handleDragLeave = useCallback((e, sectionIdx) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverSection((prev) => (prev === sectionOrder[sectionIdx] ? null : prev));
      setSectionDropTarget((prev) => (prev?.index === sectionIdx ? null : prev));
    }
  }, [sectionOrder]);

  const handleDrop = useCallback(
    (e, sectionIdx, sectionTitle) => {
      e.preventDefault();
      setDragOverSection(null);

      // Check if dropped item is a section reorder
      const source = e.dataTransfer.getData(DRAG_KEYS.SOURCE);
      const rawSectionIdx = e.dataTransfer.getData(DRAG_KEYS.SECTION_INDEX);
      const isSectionDrop = source === DRAG_SOURCE.SECTION || rawSectionIdx !== '' || draggedSectionIdx !== null;

      if (isSectionDrop) {
        const sourceIdx = draggedSectionIdx !== null
          ? draggedSectionIdx
          : (rawSectionIdx !== '' ? Number(rawSectionIdx) : null);

        const rect = e.currentTarget.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const position = sectionDropTarget?.position || (e.clientY < midY ? 'before' : 'after');

        if (sourceIdx !== null && !isNaN(sourceIdx)) {
          let targetIndex = position === 'after'
            ? (sourceIdx > sectionIdx ? sectionIdx + 1 : sectionIdx)
            : (sourceIdx < sectionIdx ? sectionIdx - 1 : sectionIdx);

          targetIndex = Math.max(0, Math.min(sectionOrder.length - 1, targetIndex));
          if (sourceIdx !== targetIndex) {
            onReorderSections?.(sourceIdx, targetIndex);
          }
        }
        setDraggedSectionIdx(null);
        setSectionDropTarget(null);
        return;
      }

      setSectionDropTarget(null);

      // Otherwise handle dropping block
      const blockId = e.dataTransfer.getData(DRAG_KEYS.BLOCK_ID);
      if (!blockId) return;

      const afterElement = getDragAfterElement(e.currentTarget, e.clientY);
      const insertIndex = afterElement ? Number(afterElement.dataset.idx) : null;

      if (source === DRAG_SOURCE.LIBRARY) {
        onDropFromLibrary(blockId, sectionTitle, insertIndex);
      } else if (source === DRAG_SOURCE.CANVAS) {
        const sourceSectionTitle = e.dataTransfer.getData(DRAG_KEYS.SOURCE_SECTION);
        const sourceIndex = Number(e.dataTransfer.getData(DRAG_KEYS.SOURCE_INDEX));
        onReorderInCanvas(sourceSectionTitle, sourceIndex, sectionTitle, insertIndex ?? 999);
      }
    },
    [draggedSectionIdx, sectionDropTarget, sectionOrder.length, onReorderSections, onDropFromLibrary, onReorderInCanvas],
  );

  return (
    <main className={styles.panel}>
      <div className={styles.canvasHeader} data-print-hide>
        <input
          className={styles.canvasTitle}
          value={resume.title}
          onChange={(e) => onUpdateTitle(e.target.value)}
        />
        <div className={styles.headerActions}>
          <button onClick={onClearResume}>Clear</button>
          <button onClick={onAddSection}>+ Section</button>
        </div>
      </div>

      <div className={styles.canvasScroll}>
        <div className={`${styles.resumePage} ${styles[template.className] || ''}`}>
          <div className={styles.resumeHeader}>
            <div className={styles.resumeName}>{normInfo.name}</div>
            <div className={styles.resumeContact}>
              {contactItems.map((item, idx) => (
                <span key={item.id || idx}>
                  {idx > 0 && <span> | </span>}
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.contactLink}
                      title={item.url}
                    >
                      {item.text}
                    </a>
                  ) : (
                    <span>{item.text}</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {sectionOrder.map((sectionTitle, sectionIdx) => {
            const blockIds = sections[sectionTitle] || [];
            const isDraggingThis = draggedSectionIdx === sectionIdx;
            const isDropBefore = sectionDropTarget?.index === sectionIdx && sectionDropTarget?.position === 'before';
            const isDropAfter = sectionDropTarget?.index === sectionIdx && sectionDropTarget?.position === 'after';
            const isHeaderHidden = hiddenSections.includes(sectionTitle);

            return (
              <div
                key={`sec-${sectionIdx}`}
                className={`
                  ${styles.resumeSection}
                  ${dragOverSection === sectionTitle ? styles.dragOver : ''}
                  ${isDraggingThis ? styles.sectionDragging : ''}
                  ${isDropBefore ? styles.dropTargetBefore : ''}
                  ${isDropAfter ? styles.dropTargetAfter : ''}
                `}
                onDragOver={(e) => handleDragOver(e, sectionIdx, sectionTitle)}
                onDrop={(e) => handleDrop(e, sectionIdx, sectionTitle)}
                onDragLeave={(e) => handleDragLeave(e, sectionIdx)}
              >
                <div className={`${styles.sectionHeader} ${isHeaderHidden ? styles.sectionHeaderHidden : ''}`}>
                  <div className={styles.sectionHeaderLeft}>
                    <div
                      className={styles.sectionDragHandle}
                      draggable
                      onDragStart={(e) => handleSectionDragStart(e, sectionIdx, sectionTitle)}
                      onDragEnd={handleSectionDragEnd}
                      title="Drag to reorder section"
                      aria-label="Drag to reorder section"
                      data-print-hide
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                        <rect x="2" y="3" width="12" height="2" rx="0.5" />
                        <rect x="2" y="7" width="12" height="2" rx="0.5" />
                        <rect x="2" y="11" width="12" height="2" rx="0.5" />
                      </svg>
                    </div>
                    <h2 className={styles.sectionTitlePrint}>{sectionTitle}</h2>
                    <input
                      className={styles.sectionTitle}
                      value={sectionTitle}
                      onChange={(e) => onUpdateSectionTitle(sectionTitle, e.target.value, sectionIdx)}
                      data-print-hide
                    />
                  </div>
                  <div className={styles.sectionActions} data-print-hide>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${styles.visibilityBtn} ${isHeaderHidden ? styles.visibilityBtnHidden : ''}`}
                      onClick={() => onToggleSectionVisibility?.(sectionTitle)}
                      title={isHeaderHidden ? 'Show section header and line' : 'Hide section header and line'}
                      aria-label={isHeaderHidden ? 'Show section header' : 'Hide section header'}
                      aria-pressed={isHeaderHidden}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" />
                        <circle cx="8" cy="8" r="2" />
                        {isHeaderHidden && <path d="M2.5 2.5l11 11" />}
                      </svg>
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${styles.reorderBtn}`}
                      onClick={() => onReorderSections?.(sectionIdx, sectionIdx - 1)}
                      disabled={sectionIdx === 0}
                      title={sectionIdx === 0 ? 'Top section' : 'Move section up'}
                      aria-label="Move section up"
                    >
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 10l5-5 5 5" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${styles.reorderBtn}`}
                      onClick={() => onReorderSections?.(sectionIdx, sectionIdx + 1)}
                      disabled={sectionIdx === sectionOrder.length - 1}
                      title={sectionIdx === sectionOrder.length - 1 ? 'Bottom section' : 'Move section down'}
                      aria-label="Move section down"
                    >
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 6l5 5 5-5" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${styles.deleteBtn}`}
                      onClick={() => onRemoveSection(sectionTitle)}
                      title="Remove section"
                      aria-label="Remove section"
                    >
                      &times;
                    </button>
                  </div>
                </div>

                {blockIds.length === 0 && (
                  <div className={styles.dropHint} data-print-hide>Drag blocks here</div>
                )}

                {blockIds.map((blockId, idx) => {
                  const block = blocks.find((b) => b.id === blockId);
                  if (!block) return null;
                  const schema = BLOCK_SCHEMA[block.type];
                  if (!schema) return null;
                  const rendered = schema.render(block);

                  return (
                    <ResumeBlock
                      key={blockId}
                      blockId={blockId}
                      blockType={block.type}
                      sectionId={sectionTitle}
                      index={idx}
                      rendered={rendered}
                      showLocations={!!resume.showLocations}
                      variantKind={block.variantIn ? 'resume' : block.variantOf ? 'child' : null}
                      onRemove={() => onRemoveBlockFromSection(sectionTitle, idx)}
                      onEdit={() => onEditBlock(blockId)}
                      onDuplicate={() => onDuplicateBlock?.(blockId, sectionTitle)}
                      onCanvasDragStart={onCanvasDragStart}
                      onCanvasDragEnd={onCanvasDragEnd}
                    />
                  );
                })}
              </div>
            );
          })}

          <button className={styles.addSection} onClick={onAddSection} data-print-hide>
            + Add Section
          </button>
        </div>
      </div>
    </main>
  );
}

function getDragAfterElement(container, y) {
  const elements = [...container.querySelectorAll('[data-resume-block]')];
  return elements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY },
  ).element;
}
