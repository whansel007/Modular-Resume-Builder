import { useState, useCallback } from 'react';
import { BLOCK_SCHEMA, TEMPLATES } from '../../utils/constants';
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
}) {
  const [dragOverSection, setDragOverSection] = useState(null);

  const template = TEMPLATES[resume.templateId] || TEMPLATES.modern;

  const handleDragOver = useCallback((e, sectionId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSection(sectionId);
  }, []);

  const handleDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverSection(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e, sectionId) => {
      e.preventDefault();
      setDragOverSection(null);

      const blockId = e.dataTransfer.getData('application/x-block-id');
      const source = e.dataTransfer.getData('application/x-drag-source');

      if (!blockId) return;

      const afterElement = getDragAfterElement(e.currentTarget, e.clientY);
      const insertIndex = afterElement ? Number(afterElement.dataset.idx) : null;

      if (source === 'library') {
        onDropFromLibrary(blockId, sectionId, insertIndex);
      } else if (source === 'canvas') {
        const sourceSectionId = e.dataTransfer.getData('application/x-source-section');
        const sourceIndex = Number(e.dataTransfer.getData('application/x-source-index'));
        onReorderInCanvas(sourceSectionId, sourceIndex, sectionId, insertIndex ?? 999);
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

          {resume.sections.map((section) => (
            <div
              key={section.id}
              className={`${styles.resumeSection} ${dragOverSection === section.id ? styles.dragOver : ''}`}
              onDragOver={(e) => handleDragOver(e, section.id)}
              onDrop={(e) => handleDrop(e, section.id)}
              onDragLeave={handleDragLeave}
            >
              <div className={styles.sectionHeader}>
                <input
                  className={styles.sectionTitle}
                  value={section.title}
                  onChange={(e) => onUpdateSectionTitle(section.id, e.target.value)}
                />
                <div className={styles.sectionActions} data-print-hide>
                  <button
                    className={styles.iconBtn}
                    onClick={() => onRemoveSection(section.id)}
                    title="Remove section"
                  >
                    &times;
                  </button>
                </div>
              </div>

              {section.blockIds.length === 0 && (
                <div className={styles.dropHint} data-print-hide>Drag blocks here</div>
              )}

              {section.blockIds.map((blockId, idx) => {
                const block = blocks.find((b) => b.id === blockId);
                if (!block) return null;
                const schema = BLOCK_SCHEMA[block.type];
                if (!schema) return null;
                const rendered = schema.render(block);

                return (
                  <ResumeBlock
                    key={`${section.id}-${blockId}-${idx}`}
                    blockId={blockId}
                    sectionId={section.id}
                    index={idx}
                    rendered={rendered}
                    onRemove={() => onRemoveBlockFromSection(section.id, idx)}
                    onEdit={() => onEditBlock(blockId)}
                    formatBody={formatBody}
                  />
                );
              })}
            </div>
          ))}

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
