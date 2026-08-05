import { useState } from 'react';
import { BLOCK_SCHEMA } from '../../utils/constants';
import styles from './BlockModal.module.css';

export default function BlockModal({
  tempBlock,
  setTempBlock,
  editingBlockId,
  jobTypes, // Now an object: { jt1: "Software Development", ... }
  onAddCustomJobType,
  onSave,
  onSaveVariant,
  onSaveChildVariant,
  onClose,
}) {
  const [newJobTypeName, setNewJobTypeName] = useState('');
  const schema = BLOCK_SCHEMA[tempBlock.type];
  const jobTypeIds = tempBlock.jobTypeIds || [];
  // Two variant kinds:
  //  - resume variant: resumeId set — lives only on one resume.
  //  - child variant: variantOf set, no resumeId — lives in the library
  //    under its parent block's dropdown.
  const isResumeVariant = !!tempBlock.resumeId;
  const isChildVariant = !isResumeVariant && !!tempBlock.variantOf;
  const isVariant = isResumeVariant || isChildVariant;
  // Saving as a variant copies the block being edited, so only offer it for
  // plain library blocks (not when already editing a variant).
  const canSaveAsVariant = !!editingBlockId && !!onSaveVariant && !isVariant;
  const canSaveAsChildVariant = !!editingBlockId && !!onSaveChildVariant && !isVariant;

  const handleTypeChange = (e) => {
    // Reset content fields when switching type, keep id/type/jobTypeIds
    const { id, type, jobTypeIds: jtIds } = tempBlock;
    setTempBlock({ id, type: e.target.value, jobTypeIds: jtIds || [] });
  };

  const handleFieldChange = (name, value) => {
    setTempBlock((prev) => ({ ...prev, [name]: value }));
  };

  const toggleJobType = (jtId) => {
    setTempBlock((prev) => {
      const ids = prev.jobTypeIds || [];
      const has = ids.includes(jtId);
      return {
        ...prev,
        jobTypeIds: has ? ids.filter((id) => id !== jtId) : [...ids, jtId],
      };
    });
  };

  const handleAddCustomJobType = () => {
    if (!newJobTypeName.trim()) return;
    onAddCustomJobType(newJobTypeName);
    setNewJobTypeName('');
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>
            {editingBlockId
              ? isResumeVariant
                ? 'Edit Block Variant'
                : isChildVariant
                  ? 'Edit Child Variant'
                  : 'Edit Block'
              : 'New Block'}
          </h3>
          <button className={styles.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>

        {isResumeVariant && (
          <p className={styles.variantNote}>
            This block is a resume variant — it belongs to this resume only. Changes here won't
            affect the original block or any other resume.
          </p>
        )}

        {isChildVariant && (
          <p className={styles.variantNote}>
            This block is a child variant — it lives in the library under its parent block and can
            be picked from the parent's dropdown. Changes here won't affect the parent.
          </p>
        )}

        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label>Block Name</label>
            <input
              type="text"
              placeholder={`${schema.label} block`}
              value={tempBlock.name || ''}
              onChange={(e) => handleFieldChange('name', e.target.value)}
            />
            <span className={styles.nameHint}>
              Only used to recognize the block at a glance — defaults to “{schema.label} block”.
            </span>
          </div>

          <div className={styles.field}>
            <label>Block Type</label>
            <select
              value={tempBlock.type}
              onChange={handleTypeChange}
              disabled={!!editingBlockId}
            >
              {Object.entries(BLOCK_SCHEMA).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.label}
                </option>
              ))}
            </select>
          </div>

          {schema.fields.map((field) => (
            <div key={field.name} className={styles.field}>
              <label>{field.label}</label>
              {field.type === 'textarea' ? (
                <textarea
                  value={tempBlock[field.name] || ''}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                />
              ) : (
                <input
                  type="text"
                  value={tempBlock[field.name] || ''}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                />
              )}
            </div>
          ))}

          <div className={styles.field}>
            <label>Job Types</label>
            <div className={styles.jobTypeSelect}>
              {Object.entries(jobTypes).map(([id, name]) => (
                <span
                  key={id}
                  className={`${styles.tag} ${jobTypeIds.includes(id) ? styles.active : ''}`}
                  onClick={() => toggleJobType(id)}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <input
              type="text"
              placeholder="Add custom job type..."
              value={newJobTypeName}
              onChange={(e) => setNewJobTypeName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddCustomJobType();
                  e.preventDefault();
                }
              }}
            />
            <button className={styles.addBtn} onClick={handleAddCustomJobType}>
              Add Job Type
            </button>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button onClick={onClose}>Cancel</button>
          {canSaveAsChildVariant && (
            <button
              className={styles.childVariantBtn}
              onClick={onSaveChildVariant}
              title="Save a copy into the library under this block — pick it from the parent's dropdown"
            >
              Save as Child Variant
            </button>
          )}
          {canSaveAsVariant && (
            <button
              className={styles.variantBtn}
              onClick={onSaveVariant}
              title="Save a copy of this block that only applies to the current resume"
            >
              Save as Resume Variant
            </button>
          )}
          <button className={styles.primaryBtn} onClick={onSave}>
            {isResumeVariant ? 'Save Variant' : 'Save Block'}
          </button>
        </div>
      </div>
    </div>
  );
}
