import { DRAG_KEYS, DRAG_SOURCE } from '../../utils/dragKeys';
import styles from './ResumeBlock.module.css';

export default function ResumeBlock({ blockId, blockType, sectionId, index, rendered, isVariant = false, onRemove, onEdit, formatBody, onCanvasDragStart, onCanvasDragEnd }) {
  const handleDragStart = (e) => {
    e.dataTransfer.setData(DRAG_KEYS.BLOCK_ID, blockId);
    e.dataTransfer.setData(DRAG_KEYS.SOURCE, DRAG_SOURCE.CANVAS);
    e.dataTransfer.setData(DRAG_KEYS.SOURCE_SECTION, sectionId);
    e.dataTransfer.setData(DRAG_KEYS.SOURCE_INDEX, String(index));
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add(styles.dragging);
    onCanvasDragStart?.();
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove(styles.dragging);
    onCanvasDragEnd?.();
  };

  return (
    <div
      className={styles.resumeBlock}
      draggable
      data-resume-block
      data-block-type={blockType}
      data-block-id={blockId}
      data-section-id={sectionId}
      data-idx={index}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {isVariant && (
        <span
          className={styles.variantBadge}
          data-print-hide
          title="Variant — this copy only applies to this resume"
        >
          Variant
        </span>
      )}
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
