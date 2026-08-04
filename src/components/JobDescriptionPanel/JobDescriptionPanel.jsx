import { useState } from 'react';
import styles from './JobDescriptionPanel.module.css';

export default function JobDescriptionPanel({ onKeywordsExtracted, onAutoFill }) {
  const [jobDescription, setJobDescription] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [selected, setSelected] = useState({}); // { keyword: boolean }
  const [loading, setLoading] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const selectedKeywords = keywords.filter((k) => selected[k]);

  const reportSelected = (nextSelected) => {
    if (onKeywordsExtracted) {
      onKeywordsExtracted(keywords.filter((k) => nextSelected[k]));
    }
  };

  const handleExtract = async () => {
    if (!jobDescription.trim()) {
      setError('Please paste a job description first');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/extract-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(data.error || 'Failed to extract keywords');
      }

      const data = await res.json();
      const list = data.keywords || [];
      setKeywords(list);
      // Check all keywords by default
      const allSelected = Object.fromEntries(list.map((k) => [k, true]));
      setSelected(allSelected);

      if (onKeywordsExtracted) {
        onKeywordsExtracted(list);
      }
    } catch (err) {
      console.error('Extract keywords error:', err);
      setError(err.message || 'Failed to extract keywords');
    } finally {
      setLoading(false);
    }
  };

  const toggleKeyword = (keyword) => {
    const nextSelected = { ...selected, [keyword]: !selected[keyword] };
    setSelected(nextSelected);
    reportSelected(nextSelected);
  };

  const setAll = (checked) => {
    const nextSelected = Object.fromEntries(keywords.map((k) => [k, checked]));
    setSelected(nextSelected);
    reportSelected(nextSelected);
  };

  const handleAutoFill = async () => {
    if (!onAutoFill || selectedKeywords.length === 0) return;

    setAutofilling(true);
    setError('');
    setSuccess('');

    try {
      const message = await onAutoFill({ jobDescription, keywords: selectedKeywords });
      setSuccess(message || 'Resume auto-filled');
    } catch (err) {
      console.error('Auto-fill error:', err);
      setError(err.message || 'Failed to auto-fill resume');
    } finally {
      setAutofilling(false);
    }
  };

  const handleClear = () => {
    setJobDescription('');
    setKeywords([]);
    setSelected({});
    setError('');
    setSuccess('');
    if (onKeywordsExtracted) {
      onKeywordsExtracted([]);
    }
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Job Description</h3>
      <p className={styles.description}>
        Paste a job description to extract relevant keywords for your resume.
      </p>

      <textarea
        className={styles.textarea}
        placeholder="Paste the job description here..."
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
        rows={12}
      />

      <div className={styles.buttonGroup}>
        <button
          className={styles.extractBtn}
          onClick={handleExtract}
          disabled={loading || !jobDescription.trim()}
        >
          {loading ? 'Extracting...' : 'Extract Keywords'}
        </button>
        <button
          className={styles.clearBtn}
          onClick={handleClear}
          disabled={loading || autofilling}
        >
          Clear
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {success && <p className={styles.success}>{success}</p>}

      {keywords.length > 0 && (
        <div className={styles.keywordsSection}>
          <div className={styles.keywordsHeader}>
            <h4 className={styles.keywordsTitle}>
              Keywords ({selectedKeywords.length}/{keywords.length})
            </h4>
            <div className={styles.keywordsActions}>
              <button className={styles.linkBtn} onClick={() => setAll(true)}>
                Select all
              </button>
              <button className={styles.linkBtn} onClick={() => setAll(false)}>
                Clear all
              </button>
            </div>
          </div>
          <p className={styles.checklistHint}>
            Check the keywords you want to target in your resume.
          </p>
          <ul className={styles.checklist}>
            {keywords.map((keyword) => (
              <li key={keyword} className={styles.checklistItem}>
                <label className={styles.checklistLabel}>
                  <input
                    type="checkbox"
                    className={styles.checklistCheckbox}
                    checked={!!selected[keyword]}
                    onChange={() => toggleKeyword(keyword)}
                  />
                  <span
                    className={`${styles.checklistText} ${
                      selected[keyword] ? '' : styles.checklistTextUnchecked
                    }`}
                  >
                    {keyword}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {onAutoFill && (
            <button
              className={styles.autofillBtn}
              onClick={handleAutoFill}
              disabled={autofilling || selectedKeywords.length === 0}
            >
              {autofilling ? 'Auto-filling...' : '✦ Auto-fill Resume'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
