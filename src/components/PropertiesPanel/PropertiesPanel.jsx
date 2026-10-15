import { useState } from 'react';
import { TEMPLATES } from '../../utils/constants';
import { normalizePersonalInfo, DEFAULT_FIELD_SUGGESTIONS } from '../../utils/personalInfo';
import styles from './PropertiesPanel.module.css';

export default function PropertiesPanel({
  resume,
  personalInfo,
  onSetTemplate,
  onToggleShowLocations,
  onUpdatePersonalInfo,
  onSaveDefaultPersonalInfo,
  saveDefaultStatus = '',
  onReorderSections,
  onAddSection,
  onRemoveSection,
}) {
  const normInfo = normalizePersonalInfo(personalInfo);
  const fields = normInfo.fields || [];
  const sectionOrder = resume.sectionOrder || [];
  const sections = resume.sections || {};

  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [draggedSecIdx, setDraggedSecIdx] = useState(null);
  const [dragOverSecIdx, setDragOverSecIdx] = useState(null);
  const [linkModalIdx, setLinkModalIdx] = useState(null);
  const [linkInputUrl, setLinkInputUrl] = useState('');

  const handleSecDragStart = (e, index) => {
    if (e.target.tagName === 'BUTTON') {
      e.preventDefault();
      return;
    }
    setDraggedSecIdx(index);
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSecDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSecIdx !== index) {
      setDragOverSecIdx(index);
    }
  };

  const handleSecDragLeave = (e, index) => {
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) {
      return;
    }
    if (dragOverSecIdx === index) {
      setDragOverSecIdx(null);
    }
  };

  const handleSecDrop = (e, targetIdx) => {
    e.preventDefault();
    const sourceIdx = draggedSecIdx ?? (e.dataTransfer.getData('text/plain') !== '' ? Number(e.dataTransfer.getData('text/plain')) : null);
    if (sourceIdx !== null && !isNaN(sourceIdx) && sourceIdx !== targetIdx) {
      onReorderSections?.(sourceIdx, targetIdx);
    }
    setDraggedSecIdx(null);
    setDragOverSecIdx(null);
  };

  const handleSecDragEnd = () => {
    setDraggedSecIdx(null);
    setDragOverSecIdx(null);
  };

  const handleNameChange = (name) => {
    if (typeof onUpdatePersonalInfo === 'function') {
      onUpdatePersonalInfo({ ...normInfo, name });
    }
  };

  const handleFieldChange = (index, key, value) => {
    const nextFields = fields.map((f, i) => (i === index ? { ...f, [key]: value } : f));
    if (typeof onUpdatePersonalInfo === 'function') {
      onUpdatePersonalInfo({ ...normInfo, fields: nextFields });
    }
  };

  const handleAddField = () => {
    const existingLabels = new Set(fields.map((f) => f.label.toLowerCase()));
    const nextLabel =
      DEFAULT_FIELD_SUGGESTIONS.find((l) => !existingLabels.has(l.toLowerCase())) ||
      `Field ${fields.length + 1}`;
    const newField = {
      id: `f-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      label: nextLabel,
      value: '',
      url: '',
    };
    if (typeof onUpdatePersonalInfo === 'function') {
      onUpdatePersonalInfo({ ...normInfo, fields: [...fields, newField] });
    }
  };

  const handleRemoveField = (index) => {
    if (fields.length <= 3) return; // Enforce minimum length of 3
    const nextFields = fields.filter((_, i) => i !== index);
    if (typeof onUpdatePersonalInfo === 'function') {
      onUpdatePersonalInfo({ ...normInfo, fields: nextFields });
    }
  };

  const handleMoveField = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= fields.length || fromIdx === toIdx) return;
    const nextFields = [...fields];
    const [moved] = nextFields.splice(fromIdx, 1);
    nextFields.splice(toIdx, 0, moved);
    if (typeof onUpdatePersonalInfo === 'function') {
      onUpdatePersonalInfo({ ...normInfo, fields: nextFields });
    }
  };

  const handleDragStart = (e, index) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') {
      e.preventDefault();
      return;
    }
    setDraggedIdx(index);
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDragLeave = (e, index) => {
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) {
      return;
    }
    if (dragOverIdx === index) {
      setDragOverIdx(null);
    }
  };

  const handleDrop = (e, targetIdx) => {
    e.preventDefault();
    const sourceIdx = draggedIdx ?? (e.dataTransfer.getData('text/plain') !== '' ? Number(e.dataTransfer.getData('text/plain')) : null);
    if (sourceIdx !== null && !isNaN(sourceIdx) && sourceIdx !== targetIdx) {
      handleMoveField(sourceIdx, targetIdx);
    }
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleOpenLinkModal = (index) => {
    setLinkModalIdx(index);
    setLinkInputUrl(fields[index]?.url || '');
  };

  const handleCloseLinkModal = () => {
    setLinkModalIdx(null);
    setLinkInputUrl('');
  };

  const handleSaveLink = () => {
    if (linkModalIdx !== null) {
      handleFieldChange(linkModalIdx, 'url', linkInputUrl.trim());
    }
    handleCloseLinkModal();
  };

  const handleRemoveLink = () => {
    if (linkModalIdx !== null) {
      handleFieldChange(linkModalIdx, 'url', '');
    }
    handleCloseLinkModal();
  };

  return (
    <aside className={styles.panel} data-print-hide>
      <div className={styles.panelContent}>
        <div className={styles.panelSection}>
          <h3 className={styles.sectionTitle}>Template</h3>
          <div className={styles.templateToggleRow}>
            {Object.entries(TEMPLATES).map(([id, t]) => {
              const isSelected = (resume.templateId || 'classic') === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={`${styles.templateToggleBtn} ${isSelected ? styles.templateToggleActive : ''}`}
                  onClick={() => onSetTemplate(id)}
                >
                  {id === 'classic' ? 'Classic' : id === 'modern' ? 'Modern' : t.name}
                </button>
              );
            })}
          </div>

          <div className={styles.templateOptionRow}>
            <label className={styles.templateCheckboxLabel}>
              <input
                type="checkbox"
                className={styles.templateCheckboxInput}
                checked={!!resume.showLocations}
                onChange={(e) => onToggleShowLocations?.(e.target.checked)}
              />
              <span className={styles.templateCheckboxText}>Show block locations</span>
            </label>
          </div>
        </div>

        <div className={styles.sectionDivider} />

        <div className={styles.panelSection}>
          <div className={styles.sectionHeadingRow}>
            <h3 className={styles.sectionTitle}>Sections ({sectionOrder.length})</h3>
            <button
              type="button"
              className={styles.addSectionSmallBtn}
              onClick={onAddSection}
              title="Add a new section"
            >
              + Add Section
            </button>
          </div>

          <div className={`${styles.fieldsList} ${draggedSecIdx !== null ? styles.dragActive : ''}`}>
            {sectionOrder.length === 0 ? (
              <p className={styles.emptySecNote}>No sections added yet.</p>
            ) : (
              sectionOrder.map((title, idx) => {
                const blockCount = (sections[title] || []).length;
                const isFirst = idx === 0;
                const isLast = idx === sectionOrder.length - 1;

                return (
                  <div
                    key={`sec-${idx}`}
                    className={`
                      ${styles.sectionItemCard}
                      ${draggedSecIdx === idx ? styles.dragging : ''}
                      ${dragOverSecIdx === idx && draggedSecIdx !== idx ? styles.dragOver : ''}
                    `}
                    draggable
                    onDragStart={(e) => handleSecDragStart(e, idx)}
                    onDragEnd={handleSecDragEnd}
                    onDragOver={(e) => handleSecDragOver(e, idx)}
                    onDragLeave={(e) => handleSecDragLeave(e, idx)}
                    onDrop={(e) => handleSecDrop(e, idx)}
                  >
                    <div className={styles.sectionItemLeft}>
                      <div
                        className={styles.dragHandleBtn}
                        title="Drag to reorder"
                        aria-label="Drag to reorder"
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                          <rect x="2" y="3" width="12" height="2" rx="0.5" />
                          <rect x="2" y="7" width="12" height="2" rx="0.5" />
                          <rect x="2" y="11" width="12" height="2" rx="0.5" />
                        </svg>
                      </div>
                      <div className={styles.sectionItemInfo}>
                        <span className={styles.sectionItemName} title={title}>{title}</span>
                        <span className={styles.sectionCountBadge}>
                          {blockCount} {blockCount === 1 ? 'block' : 'blocks'}
                        </span>
                      </div>
                    </div>

                    <div className={styles.sectionItemActions}>
                      <button
                        type="button"
                        className={styles.fieldActionBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          onReorderSections?.(idx, idx - 1);
                        }}
                        disabled={isFirst}
                        title={isFirst ? 'Top section' : 'Move section up'}
                        aria-label="Move section up"
                      >
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 10l5-5 5 5" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={styles.fieldActionBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          onReorderSections?.(idx, idx + 1);
                        }}
                        disabled={isLast}
                        title={isLast ? 'Bottom section' : 'Move section down'}
                        aria-label="Move section down"
                      >
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6l5 5 5-5" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={`${styles.fieldActionBtn} ${styles.deleteBtn}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveSection?.(title);
                        }}
                        title="Remove section"
                        aria-label="Remove section"
                      >
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <line x1="3" y1="3" x2="13" y2="13" />
                          <line x1="13" y1="3" x2="3" y2="13" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={styles.sectionDivider} />

        <div className={styles.panelSection}>
          <h3 className={styles.sectionTitle}>Personal Info</h3>

          <div className={styles.field}>
            <label className={styles.subLabel}>Full Name</label>
            <input
              className={styles.nameInput}
              type="text"
              placeholder="e.g. Jane Doe"
              value={normInfo.name || ''}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </div>

          <div className={`${styles.fieldsList} ${draggedIdx !== null ? styles.dragActive : ''}`}>
            <label className={styles.subLabel}>Contact & Details ({fields.length})</label>
            {fields.map((f, idx) => (
              <div
                key={f.id || idx}
                className={`${styles.fieldCard} ${draggedIdx === idx ? styles.dragging : ''} ${dragOverIdx === idx && draggedIdx !== idx ? styles.dragOver : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragLeave={(e) => handleDragLeave(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
              >
                <div className={styles.fieldCardHeader}>
                  <input
                    className={styles.fieldLabelInput}
                    type="text"
                    value={f.label}
                    placeholder="Label"
                    draggable={false}
                    onDragStart={(e) => e.stopPropagation()}
                    onChange={(e) => handleFieldChange(idx, 'label', e.target.value)}
                    title="Field label (e.g. Email, LinkedIn, Portfolio)"
                  />
                  <div className={styles.fieldActions}>
                    <div
                      className={styles.dragHandleBtn}
                      title="Drag to reorder"
                      aria-label="Drag to reorder"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                        <rect x="2" y="3" width="12" height="2" rx="0.5" />
                        <rect x="2" y="7" width="12" height="2" rx="0.5" />
                        <rect x="2" y="11" width="12" height="2" rx="0.5" />
                      </svg>
                    </div>
                    <button
                      type="button"
                      className={`${styles.fieldActionBtn} ${styles.linkBtn} ${f.url ? styles.linkActive : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenLinkModal(idx);
                      }}
                      draggable={false}
                      onDragStart={(e) => e.stopPropagation()}
                      title={f.url ? `Linked to: ${f.url} (click to edit)` : 'Attach link to text'}
                      aria-label="Attach link"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M6.5 9.5a3.5 3.5 0 0 0 4.95 0l2.12-2.12a3.5 3.5 0 0 0-4.95-4.95l-1.06 1.06" />
                        <path d="M9.5 6.5a3.5 3.5 0 0 0-4.95 0L2.43 8.62a3.5 3.5 0 0 0 4.95 4.95l1.06-1.06" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className={`${styles.fieldActionBtn} ${styles.deleteBtn}`}
                      onClick={() => handleRemoveField(idx)}
                      draggable={false}
                      onDragStart={(e) => e.stopPropagation()}
                      disabled={fields.length <= 3}
                      title={
                        fields.length <= 3
                          ? 'Minimum 3 fields required'
                          : 'Remove field'
                      }
                      aria-label="Remove field"
                    >
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <line x1="3" y1="3" x2="13" y2="13" />
                        <line x1="13" y1="3" x2="3" y2="13" />
                      </svg>
                    </button>
                  </div>
                </div>
                <input
                  className={styles.fieldValueInput}
                  type="text"
                  placeholder={`Enter ${f.label.toLowerCase()}...`}
                  value={f.value || ''}
                  draggable={false}
                  onDragStart={(e) => e.stopPropagation()}
                  onChange={(e) => handleFieldChange(idx, 'value', e.target.value)}
                />
              </div>
            ))}

            <button
              type="button"
              className={styles.addFieldBtn}
              onClick={handleAddField}
              title="Add another contact or info field"
            >
              + Add Field
            </button>
            {fields.length <= 3 && (
              <p className={styles.minNote}>Minimum 3 contact fields required.</p>
            )}
          </div>

          {/* Save this resume's personal info as the account default used to
              prefill every new resume (also editable via Dashboard → email). */}
          <button
            className={styles.saveDefaultBtn}
            onClick={onSaveDefaultPersonalInfo}
            disabled={saveDefaultStatus === 'saving'}
            title="Use these details and field order to prefill new resumes"
          >
            {saveDefaultStatus === 'saving'
              ? 'Saving...'
              : saveDefaultStatus === 'saved'
                ? '✓ Saved as Default'
                : saveDefaultStatus === 'error'
                  ? 'Failed — try again'
                  : 'Save as Default'}
          </button>
        </div>

        <div className={styles.sectionDivider} />

        <div className={styles.panelSection}>
          <h3 className={styles.sectionTitle}>Tips</h3>
          <p className={styles.tipText}>
            Drag blocks from the library into a section. Reorder blocks within a section by dragging
            them. Click the pencil icon on a block to edit its content.
          </p>
        </div>
      </div>

      {/* Link Window Modal */}
      {linkModalIdx !== null && fields[linkModalIdx] && (
        <div className={styles.modalOverlay} onClick={handleCloseLinkModal} data-print-hide>
          <div className={styles.linkModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitle}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6.5 9.5a3.5 3.5 0 0 0 4.95 0l2.12-2.12a3.5 3.5 0 0 0-4.95-4.95l-1.06 1.06" />
                  <path d="M9.5 6.5a3.5 3.5 0 0 0-4.95 0L2.43 8.62a3.5 3.5 0 0 0 4.95 4.95l1.06-1.06" />
                </svg>
                <h3>Attach Link</h3>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={handleCloseLinkModal}
                aria-label="Close"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="3" x2="13" y2="13" />
                  <line x1="13" y1="3" x2="3" y2="13" />
                </svg>
              </button>
            </div>

            <div className={styles.modalBody}>
              <p className={styles.linkTargetDesc}>
                Connecting link for{' '}
                <strong>{fields[linkModalIdx]?.value || fields[linkModalIdx]?.label || 'this field'}</strong>
              </p>

              <label className={styles.modalInputLabel} htmlFor="link-url-input">
                Web Address or Link
              </label>
              <input
                id="link-url-input"
                className={styles.modalInput}
                type="text"
                placeholder="e.g. https://github.com/username or github.com/username"
                value={linkInputUrl}
                onChange={(e) => setLinkInputUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveLink();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    handleCloseLinkModal();
                  }
                }}
                autoFocus
              />
              <span className={styles.modalHint}>
                Paste any link (e.g. GitHub, LinkedIn, Portfolio, or email).
              </span>
            </div>

            <div className={styles.modalFooter}>
              {fields[linkModalIdx]?.url ? (
                <button
                  type="button"
                  className={styles.removeLinkBtn}
                  onClick={handleRemoveLink}
                >
                  Remove Link
                </button>
              ) : <div />}
              <div className={styles.modalFooterRight}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={handleCloseLinkModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.saveLinkBtn}
                  onClick={handleSaveLink}
                >
                  {fields[linkModalIdx]?.url ? 'Update Link' : 'Attach Link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
