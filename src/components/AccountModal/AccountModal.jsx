import { useState } from 'react';
import styles from './AccountModal.module.css';

const FIELDS = [
  { key: 'name', label: 'Full name', type: 'text', placeholder: 'e.g. Jane Doe' },
  { key: 'email', label: 'Email', type: 'email', placeholder: 'e.g. jane@example.com' },
  { key: 'phone', label: 'Phone', type: 'tel', placeholder: 'e.g. +65 9123 4567' },
  { key: 'location', label: 'Location', type: 'text', placeholder: 'e.g. Singapore' },
];

// Account details modal (opened by clicking the email in the Dashboard
// header). Edits the user's DEFAULT personal info, which prefills the
// personal-info fields of every new resume.
export default function AccountModal({ userEmail, initial, onSave, onClose }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    location: initial?.location || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

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
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          <p className={styles.signedIn}>
            Signed in as <strong>{userEmail}</strong>
          </p>
          <p className={styles.hint}>
            These are your default personal details. They prefill the personal info of every new
            resume — you can still edit them per resume, or save the current resume's values via
            “Save as Default” in the builder's Properties tab.
          </p>

          {FIELDS.map((f) => (
            <div className={styles.field} key={f.key}>
              <label htmlFor={`acct-${f.key}`}>{f.label}</label>
              <input
                id={`acct-${f.key}`}
                type={f.type}
                placeholder={f.placeholder}
                value={form[f.key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
            </div>
          ))}

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
    </div>
  );
}
