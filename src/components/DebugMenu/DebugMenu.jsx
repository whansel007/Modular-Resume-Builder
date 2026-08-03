import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './DebugMenu.module.css';

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function DebugMenu({ resume, blocks }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const exportResumeJson = useCallback(() => {
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(resume, `resume-${resume.title || 'export'}-${date}.json`);
    setOpen(false);
  }, [resume]);

  const exportBlocksJson = useCallback(() => {
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(blocks, `blocks-${date}.json`);
    setOpen(false);
  }, [blocks]);

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        className={styles.wrenchBtn}
        onClick={() => setOpen((o) => !o)}
        title="Debug tools"
      >
        {/* wrench SVG */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownTitle}>Debug</div>
          <button className={styles.item} onClick={exportResumeJson}>
            <span className={styles.icon}>📄</span>
            Export Resume JSON
            <span className={styles.hint}>sections show block IDs</span>
          </button>
          <button className={styles.item} onClick={exportBlocksJson}>
            <span className={styles.icon}>🗂️</span>
            Export All Blocks JSON
            <span className={styles.hint}>flat block objects for this account</span>
          </button>
        </div>
      )}
    </div>
  );
}
