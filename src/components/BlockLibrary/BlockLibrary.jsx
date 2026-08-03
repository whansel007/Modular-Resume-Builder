import { useState, useMemo, useCallback } from 'react';
import { BLOCK_SCHEMA, SECTION_TYPES } from '../../utils/constants';
import { DRAG_KEYS, DRAG_SOURCE } from '../../utils/dragKeys';
import styles from './BlockLibrary.module.css';

export default function BlockLibrary({ blocks, jobTypes, onEditBlock, onDeleteBlock }) {
  // jobTypes is now an object: { jt1: "Software Development", ... }
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState('all');
  const [jobTypeModes, setJobTypeModes] = useState({}); // { jt1: 'include', jt2: 'require', ... }

  const jobTypeEntries = Object.entries(jobTypes); // [[id, name], ...]

  const includedJobTypeIds = useMemo(
    () => jobTypeEntries.filter(([id]) => jobTypeModes[id] === 'include').map(([id]) => id),
    [jobTypeEntries, jobTypeModes],
  );
  const requiredJobTypeIds = useMemo(
    () => jobTypeEntries.filter(([id]) => jobTypeModes[id] === 'require').map(([id]) => id),
    [jobTypeEntries, jobTypeModes],
  );

  const filtered = useMemo(() => {
    return blocks.filter((b) => {
      const blockJobTypeIds = b.jobTypeIds || [];
      const matchesSearch =
        !searchQuery ||
        JSON.stringify(b).toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSection = selectedSection === 'all' || b.type === selectedSection;
      const matchesRequired = requiredJobTypeIds.every((jtId) => blockJobTypeIds.includes(jtId));
      const matchesIncluded =
        includedJobTypeIds.length === 0 ||
        includedJobTypeIds.some((jtId) => blockJobTypeIds.includes(jtId));
      return matchesSearch && matchesSection && matchesRequired && matchesIncluded;
    });
  }, [blocks, searchQuery, selectedSection, includedJobTypeIds, requiredJobTypeIds]);

  const CYCLE = { off: 'include', include: 'require', require: 'off' };

  const cycleJobType = (jtId) => {
    setJobTypeModes((prev) => {
      const current = prev[jtId] || 'off';
      const next = CYCLE[current];
      return { ...prev, [jtId]: next };
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

  const isFilterActive = includedJobTypeIds.length > 0 || requiredJobTypeIds.length > 0;

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
            {jobTypeEntries.map(([id, name]) => {
              const mode = jobTypeModes[id] || 'off';
              const pillClass = mode === 'require' ? styles.required : mode === 'include' ? styles.active : '';
              return (
                <span
                  key={id}
                  className={`${styles.tag} ${pillClass}`}
                  onClick={() => cycleJobType(id)}
                >
                  {name}
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
            const blockJobTypeIds = block.jobTypeIds || [];
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
                  {blockJobTypeIds.map((jtId) => (
                    <span key={jtId} className={styles.tag}>{jobTypes[jtId] || jtId}</span>
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
