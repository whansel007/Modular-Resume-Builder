import { useState, useMemo, useCallback } from 'react';
import { BLOCK_SCHEMA, SECTION_TYPES } from '../../utils/constants';
import { DRAG_KEYS, DRAG_SOURCE } from '../../utils/dragKeys';
import styles from './BlockLibrary.module.css';

export default function BlockLibrary({ blocks, jobTypes, onEditBlock, onDeleteBlock, onRemoveBlockFromResume = () => {}, isCanvasBlockDragging = false, onCanvasDragEnd }) {
  const dragOver = isCanvasBlockDragging;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState('all');
  const [jobTypeModes, setJobTypeModes] = useState({});

  const includedJobTypes = useMemo(
    () => jobTypes.filter((jt) => jobTypeModes[jt] === 'include'),
    [jobTypes, jobTypeModes],
  );
  const requiredJobTypes = useMemo(
    () => jobTypes.filter((jt) => jobTypeModes[jt] === 'require'),
    [jobTypes, jobTypeModes],
  );

  const filtered = useMemo(() => {
    return blocks.filter((b) => {
      const matchesSearch =
        !searchQuery ||
        JSON.stringify(b.content).toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSection = selectedSection === 'all' || b.type === selectedSection;
      const matchesRequired = requiredJobTypes.every((jt) => b.jobTypes.includes(jt));
      const matchesIncluded =
        includedJobTypes.length === 0 ||
        includedJobTypes.some((jt) => b.jobTypes.includes(jt));
      return matchesSearch && matchesSection && matchesRequired && matchesIncluded;
    });
  }, [blocks, searchQuery, selectedSection, includedJobTypes, requiredJobTypes]);

  const CYCLE = { off: 'include', include: 'require', require: 'off' };

  const cycleJobType = (jt) => {
    setJobTypeModes((prev) => {
      const current = prev[jt] || 'off';
      const next = CYCLE[current];
      return { ...prev, [jt]: next };
    });
  };

  const clearFilters = () => setJobTypeModes({});

  const handleDragStart = (e, blockId) => {
    e.dataTransfer.setData(DRAG_KEYS.BLOCK_ID, blockId);
    e.dataTransfer.setData(DRAG_KEYS.SOURCE, DRAG_SOURCE.LIBRARY);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add(styles.dragging);
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove(styles.dragging);
  };

  const handleDropZoneDragOver = useCallback((e) => {
    // Allow drop from canvas blocks
    if (Array.from(e.dataTransfer.types).includes(DRAG_KEYS.SOURCE_SECTION)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  }, []);

  const handleDropZoneDrop = useCallback((e) => {
    e.preventDefault();
    const blockId = e.dataTransfer.getData(DRAG_KEYS.BLOCK_ID);
    const sourceSection = e.dataTransfer.getData(DRAG_KEYS.SOURCE_SECTION);
    const sourceIndex = Number(e.dataTransfer.getData(DRAG_KEYS.SOURCE_INDEX));
    if (blockId && sourceSection && Number.isInteger(sourceIndex) && sourceIndex >= 0) {
      onRemoveBlockFromResume(sourceSection, sourceIndex);
    }
    // The source element may be unmounted before its `dragend` fires,
    // so explicitly clear the drag state here.
    onCanvasDragEnd?.();
  }, [onRemoveBlockFromResume, onCanvasDragEnd]);

  const isFilterActive = includedJobTypes.length > 0 || requiredJobTypes.length > 0;

  return (
    <aside
      className={styles.panel}
      data-print-hide
    >
      <div className={styles.panelHeader}>Block Library</div>
      <div
        className={`${styles.dropZone} ${dragOver ? styles.dropActive : ''}`}
        onDragOver={handleDropZoneDragOver}
        onDrop={handleDropZoneDrop}
      >
        <div className={`${styles.dropHint} ${dragOver ? styles.dropHintVisible : ''}`}>Drop here to remove from resume</div>
        <div className={styles.panelContent}>
        <div className={styles.toolbar}>
          <div className={styles.field}>
            <label htmlFor="section-select">Section</label>
            <select
              id="section-select"
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
            >
              <option value="all">All Sections</option>
              {SECTION_TYPES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <input
            type="text"
            placeholder="Search blocks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className={styles.filterRow}>
            <span
              className={`${styles.tag} ${!isFilterActive ? styles.active : ''}`}
              onClick={clearFilters}
            >
              All
            </span>
            {jobTypes.map((jt) => {
              const mode = jobTypeModes[jt] || 'off';
              const pillClass = mode === 'require' ? styles.required : mode === 'include' ? styles.active : '';
              return (
                <span
                  key={jt}
                  className={`${styles.tag} ${pillClass}`}
                  onClick={() => cycleJobType(jt)}
                >
                  {jt}
                </span>
              );
            })}
          </div>

          <p className={styles.filterHint}>
            Click once to include, twice to require, three times to deselect.
          </p>
        </div>

        <div className={styles.blockList}>
          {filtered.length === 0 && (
            <div className={styles.emptyState}>
              No blocks found. Create your first block to get started.
            </div>
          )}
          {filtered.map((block) => {
            const schema = BLOCK_SCHEMA[block.type];
            if (!schema) return null;
            const rendered = schema.render(block);
            return (
              <div
                key={block.id}
                className={styles.blockCard}
                draggable
                onDragStart={(e) => handleDragStart(e, block.id)}
                onDragEnd={handleDragEnd}
              >
                <h4>{schema.label}</h4>
                <div className={styles.meta}>
                  {rendered.title}
                  {rendered.subtitle ? ` · ${rendered.subtitle}` : ''}
                </div>
                <div className={styles.preview}>{rendered.body || 'No additional details.'}</div>
                <div className={styles.tags}>
                  {block.jobTypes.map((jt) => (
                    <span key={jt} className={styles.tag}>{jt}</span>
                  ))}
                </div>
                <div className={styles.actions}>
                  <button className={styles.small} onClick={() => onEditBlock(block.id)}>
                    Edit
                  </button>
                  <button
                    className={`${styles.small} ${styles.danger}`}
                    onClick={() => onDeleteBlock(block.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </div>
    </aside>
  );
}
