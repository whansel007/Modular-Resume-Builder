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

  const template = TEMPLATES[resume.templateId] || TEMPLATES.classic;
  const sectionOrder = resume.sectionOrder || [];
  const sections = resume.sections || {};

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

  const handleDragOver = useCallback((e, sectionTitle) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSection(sectionTitle);
  }, []);

  const handleDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverSection(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e, sectionTitle) => {
      e.preventDefault();
      setDragOverSection(null);

      const blockId = e.dataTransfer.getData(DRAG_KEYS.BLOCK_ID);
      const source = e.dataTransfer.getData(DRAG_KEYS.SOURCE);

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
    [onDropFromLibrary, onReorderInCanvas],
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
            return (
              <div
                key={sectionIdx}
                className={`${styles.resumeSection} ${dragOverSection === sectionTitle ? styles.dragOver : ''}`}
                onDragOver={(e) => handleDragOver(e, sectionTitle)}
                onDrop={(e) => handleDrop(e, sectionTitle)}
                onDragLeave={handleDragLeave}
              >
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitlePrint}>{sectionTitle}</h2>
                  <input
                    className={styles.sectionTitle}
                    value={sectionTitle}
                    onChange={(e) => onUpdateSectionTitle(sectionTitle, e.target.value)}
                    data-print-hide
                  />
                  <div className={styles.sectionActions} data-print-hide>
                    <button
                      className={styles.iconBtn}
                      onClick={() => onRemoveSection(sectionTitle)}
                      title="Remove section"
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
