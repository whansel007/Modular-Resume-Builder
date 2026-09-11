import { useState } from 'react';
import { normalizePersonalInfo, DEFAULT_FIELD_SUGGESTIONS } from '../../utils/personalInfo';
import styles from './AccountModal.module.css';

// Account details modal (opened by clicking the email in the Dashboard
// header). Edits the user's DEFAULT personal info, which prefills the
// personal-info fields of every new resume in the preserved order.
export default function AccountModal({ userEmail, initial, onSave, onClose }) {
  const [form, setForm] = useState(() => normalizePersonalInfo(initial));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const fields = form.fields || [];

  const handleNameChange = (name) => {
    setForm((prev) => normalizePersonalInfo({ ...prev, name }));
  };

  const handleFieldChange = (index, key, value) => {
    setForm((prev) => {
      const nextFields = (prev.fields || []).map((f, i) =>
        i === index ? { ...f, [key]: value } : f,
      );
      return normalizePersonalInfo({ ...prev, fields: nextFields });
    });
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
    };
    setForm((prev) =>
      normalizePersonalInfo({ ...prev, fields: [...(prev.fields || []), newField] }),
    );
  };

  const handleRemoveField = (index) => {
    if (fields.length <= 3) return; // Enforce minimum length of 3
    setForm((prev) => {
      const nextFields = (prev.fields || []).filter((_, i) => i !== index);
      return normalizePersonalInfo({ ...prev, fields: nextFields });
    });
  };

  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [linkModalIdx, setLinkModalIdx] = useState(null);
  const [linkInputUrl, setLinkInputUrl] = useState('');

  const handleMoveField = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= fields.length || fromIdx === toIdx) return;
    setForm((prev) => {
      const nextFields = [...(prev.fields || [])];
      const [moved] = nextFields.splice(fromIdx, 1);
      nextFields.splice(toIdx, 0, moved);
      return normalizePersonalInfo({ ...prev, fields: nextFields });
    });
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

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await onSave(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message || 'Failed to save account details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose} data-print-hide>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Account Details</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="3" x2="13" y2="13" />
              <line x1="13" y1="3" x2="3" y2="13" />
            </svg>
          </button>
        </div>

        <div className={styles.modalBody}>
          <p className={styles.signedIn}>
            Signed in as <strong>{userEmail}</strong>
          </p>
          <p className={styles.hint}>
            These are your default personal details and contact fields. They prefill every new
            resume in this exact order. (Minimum 3 contact fields preserved).
          </p>

          <div className={styles.field}>
            <label htmlFor="acct-name" className={styles.subLabel}>
              Full Name
            </label>
            <input
              id="acct-name"
              type="text"
              placeholder="e.g. Jane Doe"
              value={form.name || ''}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </div>

          <div className={`${styles.fieldsSection} ${draggedIdx !== null ? styles.dragActive : ''}`}>
            <div className={styles.fieldsSectionHeader}>
              <label className={styles.subLabel}>Default Contact Fields ({fields.length})</label>
            </div>

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
                    placeholder="Field label"
                    draggable={false}
                    onDragStart={(e) => e.stopPropagation()}
                    onChange={(e) => handleFieldChange(idx, 'label', e.target.value)}
                    title="Field label"
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
                      title={f.url ? `Linked to: ${f.url} (click to edit)` : 'Attach link'}
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
                      title={fields.length <= 3 ? 'Minimum 3 fields required' : 'Remove field'}
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
                  placeholder={`Default value for ${f.label.toLowerCase()}...`}
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
              title="Add another default field"
            >
              + Add Default Field
            </button>
            {fields.length <= 3 && (
              <p className={styles.minNote}>Minimum 3 fields required.</p>
            )}
          </div>

          {error && <p className={styles.error}>{error}</p>}
          {saved && <p className={styles.success}>Saved — new resumes will use these details.</p>}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.secondaryBtn} onClick={onClose}>
            Close
          </button>
          <button className={styles.primaryBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Account Details'}
          </button>
        </div>
      </div>

      {/* Nested Link Modal */}
      {linkModalIdx !== null && fields[linkModalIdx] && (
        <div className={styles.linkModalOverlay} onClick={handleCloseLinkModal} data-print-hide>
          <div className={styles.linkModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.linkModalHeader}>
              <div className={styles.linkModalHeaderTitle}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6.5 9.5a3.5 3.5 0 0 0 4.95 0l2.12-2.12a3.5 3.5 0 0 0-4.95-4.95l-1.06 1.06" />
                  <path d="M9.5 6.5a3.5 3.5 0 0 0-4.95 0L2.43 8.62a3.5 3.5 0 0 0 4.95 4.95l1.06-1.06" />
                </svg>
                <h3>Attach Default Link</h3>
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

            <div className={styles.linkModalBody}>
              <p className={styles.linkTargetDesc}>
                Default link for{' '}
                <strong>{fields[linkModalIdx]?.value || fields[linkModalIdx]?.label || 'this field'}</strong>
              </p>

              <label className={styles.modalInputLabel} htmlFor="acct-link-url-input">
                Link URL
              </label>
              <input
                id="acct-link-url-input"
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
            </div>

            <div className={styles.linkModalFooter}>
              {fields[linkModalIdx]?.url ? (
                <button
                  type="button"
                  className={styles.removeLinkBtn}
                  onClick={handleRemoveLink}
                >
                  Remove Link
                </button>
              ) : <div />}
              <div className={styles.linkModalFooterRight}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={handleCloseLinkModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={handleSaveLink}
                >
                  {fields[linkModalIdx]?.url ? 'Update Link' : 'Attach Link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
