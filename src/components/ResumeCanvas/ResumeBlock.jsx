import styles from './ResumeBlock.module.css';

export default function ResumeBlock({ blockId, sectionId, index, rendered, onRemove, onEdit, formatBody }) {
  const handleDragStart = (e) => {
    e.dataTransfer.setData('application/x-block-id', blockId);
    e.dataTransfer.setData('application/x-drag-source', 'canvas');
    e.dataTransfer.setData('application/x-source-section', sectionId);
    e.dataTransfer.setData('application/x-source-index', String(index));
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add(styles.dragging);
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove(styles.dragging);
  };

  return (
    <div
      className={styles.resumeBlock}
      draggable
      data-resume-block
      data-block-id={blockId}
      data-section-id={sectionId}
      data-idx={index}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.blockActions} data-print-hide>
        <button className={styles.iconBtn} onClick={onEdit} title="Edit">
          &#9998;
        </button>
        <button className={styles.iconBtn} onClick={onRemove} title="Remove">
          &times;
        </button>
      </div>
      <div className={styles.entryTitle}>{rendered.title}</div>
      {rendered.subtitle && (
        <div className={styles.entrySubtitle}>
          {rendered.subtitle}
          {rendered.dates ? ` · ${rendered.dates}` : ''}
        </div>
      )}
      {!rendered.subtitle && rendered.dates && (
        <div className={styles.entrySubtitle}>{rendered.dates}</div>
      )}
      {rendered.body && <div className={styles.entryBody}>{formatBody(rendered.body)}</div>}
    </div>
  );
}
