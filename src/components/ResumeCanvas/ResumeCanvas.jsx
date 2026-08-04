import { useState, useCallback } from 'react';
import { BLOCK_SCHEMA, TEMPLATES } from '../../utils/constants';
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
  onCanvasDragStart = () => {},
  onCanvasDragEnd = () => {},
}) {
  const [dragOverSection, setDragOverSection] = useState(null);

  const template = TEMPLATES[resume.templateId] || TEMPLATES.modern;
  const sectionOrder = resume.sectionOrder || [];
  const sections = resume.sections || {};

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

  const formatBody = (text) => {
    return text
      .split('\n')
      .filter((line) => line.trim())
      .map((line, i) => (
        <p key={i} style={{ margin: '0 0 4px 0' }}>
          {line}
        </p>
      ));
  };

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
            <div className={styles.resumeName}>{personalInfo.name}</div>
            <div className={styles.resumeContact}>
              {[personalInfo.email, personalInfo.phone, personalInfo.location]
                .filter((v) => v && v.trim())
                .join(' · ')}
            </div>
          </div>

          {sectionOrder.map((sectionTitle) => {
            const blockIds = sections[sectionTitle] || [];
            return (
              <div
                key={sectionTitle}
                className={`${styles.resumeSection} ${dragOverSection === sectionTitle ? styles.dragOver : ''}`}
                onDragOver={(e) => handleDragOver(e, sectionTitle)}
                onDrop={(e) => handleDrop(e, sectionTitle)}
                onDragLeave={handleDragLeave}
              >
                <div className={styles.sectionHeader}>
                  <input
                    className={styles.sectionTitle}
                    value={sectionTitle}
                    onChange={(e) => onUpdateSectionTitle(sectionTitle, e.target.value)}
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
                      key={`${sectionTitle}-${blockId}-${idx}`}
                      blockId={blockId}
                      blockType={block.type}
                      sectionId={sectionTitle}
                      index={idx}
                      rendered={rendered}
                      onRemove={() => onRemoveBlockFromSection(sectionTitle, idx)}
                      onEdit={() => onEditBlock(blockId)}
                      formatBody={formatBody}
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
