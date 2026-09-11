import { DRAG_KEYS, DRAG_SOURCE } from '../../utils/dragKeys';
import { formatContactUrl } from '../../utils/personalInfo';
import BulletedBody, { isBulletType } from '../BulletedBody/BulletedBody';
import styles from './ResumeBlock.module.css';

export default function ResumeBlock({ blockId, blockType, sectionId, index, rendered, variantKind = null, onRemove, onEdit, onDuplicate, onCanvasDragStart, onCanvasDragEnd }) {
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

  const isLocationUrl = rendered.location && (
    /^https?:\/\//i.test(rendered.location.trim()) ||
    /^(www\.)?(github\.com|linkedin\.com|gitlab\.com)/i.test(rendered.location.trim())
  );

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
      {variantKind && (
        <span
          className={styles.variantBadge}
          data-print-hide
          title={
            variantKind === 'resume'
              ? 'Variant — this copy only applies to this resume'
              : 'Child variant — a copy of a library block, saved under its parent'
          }
        >
          {variantKind === 'resume' ? 'Variant' : 'Child Variant'}
        </span>
      )}
      <div className={styles.blockActions} data-print-hide>
        <button
          className={styles.iconBtn}
          onClick={onDuplicate}
          title="Duplicate — copy this block right after it to build a similar one"
        >
          &#10697;
        </button>
        <button className={styles.iconBtn} onClick={onEdit} title="Edit">
          &#9998;
        </button>
        <button className={styles.iconBtn} onClick={onRemove} title="Remove">
          &times;
        </button>
      </div>
      {(rendered.title || rendered.location) && (
        <div className={styles.entryHeader}>
          {rendered.title && (
            <div className={styles.entryTitle}>
              {rendered.link ? (
                <a
                  href={formatContactUrl(rendered.link.trim())}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.headerLink}
                  title={`Open link: ${rendered.link.trim()}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {rendered.title}
                  <svg
                    className={styles.externalIcon}
                    width="10"
                    height="10"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    data-print-hide
                  >
                    <path d="M11 3h2v2M8 8l5-5M13 9v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4" />
                  </svg>
                </a>
              ) : (
                rendered.title
              )}
            </div>
          )}
          {rendered.location && (
            <div className={styles.entryLocation}>
              {isLocationUrl ? (
                <a
                  href={formatContactUrl(rendered.location.trim())}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                >
                  {rendered.location}
                </a>
              ) : (
                rendered.location
              )}
            </div>
          )}
        </div>
      )}
      {(rendered.subtitle || rendered.dates) && (
        <div className={styles.entrySubHeader}>
          {rendered.subtitle && <div className={styles.entrySubtitle}>{rendered.subtitle}</div>}
          {rendered.dates && <div className={styles.entryDates}>{rendered.dates}</div>}
        </div>
      )}
      {rendered.body && (
        <div className={styles.entryBody}>
          <BulletedBody text={rendered.body} bullets={isBulletType(blockType)} />
        </div>
      )}
    </div>
  );
}
