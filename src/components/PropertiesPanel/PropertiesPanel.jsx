import { TEMPLATES } from '../../utils/constants';
import styles from './PropertiesPanel.module.css';

export default function PropertiesPanel({
  resume,
  personalInfo,
  onSetTemplate,
  onUpdatePersonalInfo,
  onSaveDefaultPersonalInfo,
  saveDefaultStatus = '',
}) {
  return (
    <aside className={styles.panel} data-print-hide>
      {/* Tab bar above already labels this view — no repeated header */}
      <div className={styles.panelContent}>
        <label>Template</label>
        <div className={styles.templateList}>
          {Object.entries(TEMPLATES).map(([id, t]) => (
            <div
              key={id}
              className={`${styles.templateOption} ${resume.templateId === id ? styles.selected : ''}`}
              onClick={() => onSetTemplate(id)}
            >
              <h4>{t.name}</h4>
              <p>{t.description}</p>
            </div>
          ))}
        </div>

        <label className={styles.labelSpacer}>Personal Info</label>
        <div className={styles.field}>
          <input
            type="text"
            placeholder="Full name"
            value={personalInfo.name || ''}
            onChange={(e) => onUpdatePersonalInfo('name', e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <input
            type="email"
            placeholder="Email"
            value={personalInfo.email || ''}
            onChange={(e) => onUpdatePersonalInfo('email', e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <input
            type="tel"
            placeholder="Phone"
            value={personalInfo.phone || ''}
            onChange={(e) => onUpdatePersonalInfo('phone', e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <input
            type="text"
            placeholder="Location"
            value={personalInfo.location || ''}
            onChange={(e) => onUpdatePersonalInfo('location', e.target.value)}
          />
        </div>
        {/* Save this resume's personal info as the account default used to
            prefill every new resume (also editable via Dashboard → email). */}
        <button
          className={styles.saveDefaultBtn}
          onClick={onSaveDefaultPersonalInfo}
          disabled={saveDefaultStatus === 'saving'}
          title="Use these details to prefill new resumes"
        >
          {saveDefaultStatus === 'saving'
            ? 'Saving...'
            : saveDefaultStatus === 'saved'
              ? '✓ Saved as Default'
              : saveDefaultStatus === 'error'
                ? 'Failed — try again'
                : 'Save as Default'}
        </button>

        <label className={styles.labelSpacer}>Tips</label>
        <p className={styles.tipText}>
          Drag blocks from the library into a section. Reorder blocks within a section by dragging
          them. Click the pencil icon on a block to edit its content.
        </p>
      </div>
    </aside>
  );
}
