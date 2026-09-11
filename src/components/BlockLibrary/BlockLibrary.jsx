import { useState, useMemo, useCallback, useEffect } from 'react';
import { BLOCK_SCHEMA, SECTION_TYPES } from '../../utils/constants';
import { DRAG_KEYS, DRAG_SOURCE } from '../../utils/dragKeys';
import BulletedBody, { isBulletType } from '../BulletedBody/BulletedBody';
import styles from './BlockLibrary.module.css';

export default function BlockLibrary({ blocks, tags, onNewBlock, onEditBlock, onDuplicateBlock, onDeleteBlock, onRemoveBlockFromResume = () => {}, isCanvasBlockDragging = false, onCanvasDragEnd }) {
  // tags is now an object: { jt1: "Software Development", ... }
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState('all');
  const [tagModes, setTagModes] = useState({}); // { jt1: 'include', jt2: 'require', ... }
  // Variant dropdown: which parent card is open, and which variant each
  // parent card currently shows/drags (null = the parent itself).
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [pickedVariants, setPickedVariants] = useState({});
  const dragOver = isCanvasBlockDragging;

  const tagEntries = Object.entries(tags); // [[id, name], ...]

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

  const handleDropZoneDragLeave = useCallback(() => {
  }, []);

  const includedTagIds = useMemo(
    () => tagEntries.filter(([id]) => tagModes[id] === 'include').map(([id]) => id),
    [tagEntries, tagModes],
  );
  const requiredTagIds = useMemo(
    () => tagEntries.filter(([id]) => tagModes[id] === 'require').map(([id]) => id),
    [tagEntries, tagModes],
  );

  const filtered = useMemo(() => {
    return blocks.filter((b) => {
      // Resume-scoped variants live only on their resume's canvas, and child
      // variants live under their parent's dropdown — neither shows as a
      // standalone library card.
      if (b.variantIn || b.variantOf) return false;
      const blockTagIds = b.tagIds || [];
      const matchesSearch =
        !searchQuery ||
        JSON.stringify(b).toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSection = selectedSection === 'all' || b.type === selectedSection;
      const matchesRequired = requiredTagIds.every((tagId) => blockTagIds.includes(tagId));
      const matchesIncluded =
        includedTagIds.length === 0 ||
        includedTagIds.some((tagId) => blockTagIds.includes(tagId));
      return matchesSearch && matchesSection && matchesRequired && matchesIncluded;
    });
  }, [blocks, searchQuery, selectedSection, includedTagIds, requiredTagIds]);

  const CYCLE = { off: 'include', include: 'require', require: 'off' };

  // Child variants grouped by parent id (library-scoped only).
  const childrenByParent = useMemo(() => {
    const map = {};
    for (const b of blocks) {
      if (b.variantOf && !b.variantIn) {
        (map[b.variantOf] ||= []).push(b);
      }
    }
    return map;
  }, [blocks]);

  // Close the variant dropdown on any outside click.
  useEffect(() => {
    if (!openDropdownId) return;
    const close = () => setOpenDropdownId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openDropdownId]);

  const pickVariant = (parentId, variantId) => {
    setPickedVariants((prev) => {
      const next = { ...prev };
      if (variantId) next[parentId] = variantId;
      else delete next[parentId];
      return next;
    });
    setOpenDropdownId(null);
  };

  const cycleTag = (tagId) => {
    setTagModes((prev) => {
      const current = prev[tagId] || 'off';
      const next = CYCLE[current];
      return { ...prev, [tagId]: next };
    });
  };

  const clearFilters = () => setTagModes({});

  const handleDragStart = (e, blockId) => {
    e.dataTransfer.setData(DRAG_KEYS.BLOCK_ID, blockId);
    e.dataTransfer.setData(DRAG_KEYS.SOURCE, DRAG_SOURCE.LIBRARY);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add(styles.dragging);
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove(styles.dragging);
  };

  const isFilterActive = includedTagIds.length > 0 || requiredTagIds.length > 0;

  return (
    <aside
      className={styles.panel}
      data-print-hide
    >
      <div className={styles.panelHeader}>
        Block Library
        <button className={styles.newBlockBtn} onClick={onNewBlock} title="Create a new block">
          + New Block
        </button>
      </div>
      <div
        className={`${styles.dropZone} ${dragOver ? styles.dropActive : ''}`}
        onDragOver={handleDropZoneDragOver}
        onDrop={handleDropZoneDrop}
        onDragLeave={handleDropZoneDragLeave}
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
{tagEntries.map(([id, name]) => {
              const mode = tagModes[id] || 'off';
              const pillClass = mode === 'include' ? styles.tagPillActive : mode === 'require' ? styles.tagPillRequired : '';
              return (
                <span
                  key={id}
                  className={`${styles.tag} ${pillClass}`}
                  onClick={() => cycleTag(id)}
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
            const childVariants = childrenByParent[block.id] || [];
            // The card shows/drags the picked child variant, or the parent.
            const pickedId = pickedVariants[block.id];
            const active =
              (pickedId && blocks.find((b) => b.id === pickedId)) || block;
            const activeSchema = BLOCK_SCHEMA[active.type] || schema;
            const rendered = activeSchema.render(active);
            const blockTagIds = active.tagIds || [];
            const isShowingVariant = active.id !== block.id;
            return (
              <div
                key={block.id}
                className={styles.blockCard}
                data-block-type={block.type}
                data-block-id={block.id}
                draggable
                onDragStart={(e) => handleDragStart(e, active.id)}
                onDragEnd={handleDragEnd}
                onClick={
                  childVariants.length > 0
                    ? () => setOpenDropdownId((prev) => (prev === block.id ? null : block.id))
                    : undefined
                }
              >
                <div className={styles.cardHeader}>
                  <h4 title={active.name || `${schema.label} block`}>
                    {active.name || `${schema.label} block`}
                  </h4>
                  <span className={styles.typeChip}>{schema.label}</span>
                </div>

                {openDropdownId === block.id && (
                  <div className={styles.variantMenu} onClick={(e) => e.stopPropagation()}>
                    <button
                      className={!isShowingVariant ? styles.variantMenuActive : ''}
                      onClick={() => pickVariant(block.id, null)}
                    >
                      {block.name || `${schema.label} block`} (original)
                    </button>
                    {childVariants.map((v) => (
                      <div key={v.id} className={styles.variantMenuRow}>
                        <button
                          className={pickedId === v.id ? styles.variantMenuActive : ''}
                          onClick={() => pickVariant(block.id, v.id)}
                        >
                          {v.name || `${BLOCK_SCHEMA[v.type]?.label || v.type} variant`}
                        </button>
                        <button
                          className={styles.variantMenuDelete}
                          onClick={() => onDeleteBlock(v.id)}
                          title="Delete this variant"
                          aria-label="Delete this variant"
                        >
                          &#128465;
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {isShowingVariant && (
                  <div className={styles.variantPicked}>&#8627; variant of {block.name || `${schema.label} block`}</div>
                )}

                {(rendered.title || rendered.subtitle) && (
                  <div className={styles.meta}>
                    {rendered.title}
                    {rendered.subtitle ? (rendered.title ? ` · ${rendered.subtitle}` : rendered.subtitle) : ''}
                  </div>
                )}
                <div className={styles.preview}>
                  {rendered.body ? (
                    <BulletedBody text={rendered.body} bullets={isBulletType(active.type)} />
                  ) : (
                    'No additional details.'
                  )}
                </div>
                <div className={styles.tags}>
                  {blockTagIds.map((tagId) => (
                    <span key={tagId} className={styles.tag}>{tags[tagId] || tagId}</span>
                  ))}
                </div>
                <div className={styles.cardFooter} onClick={(e) => e.stopPropagation()}>
                  {childVariants.length > 0 && (
                    <button
                      type="button"
                      className={styles.variantToggle}
                      title="Show this block's child variants"
                      onClick={() =>
                        setOpenDropdownId((prev) => (prev === block.id ? null : block.id))
                      }
                    >
                      &#9662; {childVariants.length} {childVariants.length === 1 ? 'variant' : 'variants'}
                    </button>
                  )}
                  <div className={styles.actions}>
                    <button
                      className={styles.small}
                      onClick={() => onEditBlock(active.id)}
                      title="Edit block"
                      aria-label="Edit block"
                    >
                      &#9998;
                    </button>
                    <button
                      className={styles.small}
                      onClick={() => onDuplicateBlock?.(active.id)}
                      title="Duplicate this block to build a similar one"
                      aria-label="Duplicate block"
                    >
                      &#10697;
                    </button>
                    <button
                      className={`${styles.small} ${styles.danger}`}
                      onClick={() => onDeleteBlock(active.id)}
                      title="Delete block"
                      aria-label="Delete block"
                    >
                      &#128465;
                    </button>
                  </div>
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
