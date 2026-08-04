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
  onClose,
}) {
  const [newJobTypeName, setNewJobTypeName] = useState('');
  const schema = BLOCK_SCHEMA[tempBlock.type];
  const jobTypeIds = tempBlock.jobTypeIds || [];

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
          <h3>{editingBlockId ? 'Edit Block' : 'New Block'}</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>

        <div className={styles.modalBody}>
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
          <button className={styles.primaryBtn} onClick={onSave}>
            Save Block
          </button>
        </div>
      </div>
    </div>
  );
}
