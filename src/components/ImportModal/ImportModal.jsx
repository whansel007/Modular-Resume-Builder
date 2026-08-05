import { useRef, useState } from 'react';
import { extractLinesFromFile, parseResumeLines, parseResumeWithAI } from '../../utils/pdfImport';
import styles from './ImportModal.module.css';

// Upload-a-resume flow: reads a PDF in the browser, splits it into sections
// and blocks (heuristically, with an optional AI assist for odd layouts),
// then hands the parsed result to the dashboard for persistence.
export default function ImportModal({ getAuthHeaders, onImport, onClose }) {
  const fileInputRef = useRef(null);
  const [phase, setPhase] = useState('idle'); // idle | working | done | error
  const [status, setStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [useAI, setUseAI] = useState(false);
  const [result, setResult] = useState(null); // { parsed, viaAI, fileName, rawText }
  const [dragOver, setDragOver] = useState(false);

  const runParse = async (file, forceAI) => {
    setPhase('working');
    setErrorMsg('');
    try {
      setStatus('Reading PDF…');
      const lines = await extractLinesFromFile(file);
      if (!lines.length) throw new Error('No selectable text found — this PDF may be a scan/image.');
      const rawText = lines.map((l) => l.text).join('\n');

      let parsed;
      let viaAI = false;
      if (forceAI) {
        setStatus('Structuring with AI…');
        parsed = await parseResumeWithAI(rawText, getAuthHeaders());
        viaAI = true;
      } else {
        setStatus('Finding sections…');
        parsed = parseResumeLines(lines);
        // Heuristics struck out → fall back to AI automatically.
        if (parsed.blocks.length === 0) {
          setStatus('Layout unclear — structuring with AI…');
          parsed = await parseResumeWithAI(rawText, getAuthHeaders());
          viaAI = true;
        }
      }

      if (!parsed.blocks.length) {
        setPhase('error');
        setErrorMsg('No recognizable resume sections found in this PDF.');
        return;
      }
      setResult({ parsed, viaAI, fileName: file.name, rawText });
      setPhase('done');
    } catch (err) {
      console.error('PDF import error:', err);
      setPhase('error');
      setErrorMsg(err.message || 'Failed to read the PDF.');
    }
  };

  const handleFile = (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      setPhase('error');
      setErrorMsg('Please choose a PDF file.');
      return;
    }
    runParse(file, useAI);
  };

  // Re-run just the AI step on the already-extracted text (no re-read).
  const retryWithAI = async () => {
    if (!result) return;
    setPhase('working');
    setErrorMsg('');
    try {
      setStatus('Structuring with AI…');
      const parsed = await parseResumeWithAI(result.rawText, getAuthHeaders());
      if (!parsed.blocks.length) {
        setPhase('error');
        setErrorMsg('The AI could not find recognizable resume sections either.');
        return;
      }
      setResult({ ...result, parsed, viaAI: true });
      setPhase('done');
    } catch (err) {
      console.error('AI import error:', err);
      setPhase('error');
      setErrorMsg(err.message || 'AI structuring failed.');
    }
  };

  const counts = result
    ? result.parsed.blocks.reduce((acc, b) => ({ ...acc, [b.type]: (acc[b.type] || 0) + 1 }), {})
    : {};

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Import Resume PDF</h3>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        {phase === 'idle' && (
          <>
            <p className={styles.hint}>
              Sections are detected in your browser — each entry becomes an editable block.
              Only the AI fallback sends text to the server.
            </p>
            <div
              className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFile(e.dataTransfer.files?.[0]);
              }}
            >
              <span className={styles.dropIcon}>⇪</span>
              <span>Drop your resume PDF here or click to browse</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <label className={styles.aiToggle}>
              <input type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)} />
              Use AI assist (better for unusual layouts)
            </label>
          </>
        )}

        {phase === 'working' && (
          <div className={styles.working}>
            <span className={styles.spinner} aria-hidden="true" />
            <span>{status}</span>
          </div>
        )}

        {phase === 'error' && (
          <>
            <p className={styles.errorBox}>{errorMsg}</p>
            <div className={styles.footer}>
              <button
                className={styles.secondaryBtn}
                onClick={() => { setPhase('idle'); setErrorMsg(''); }}
              >
                Try another file
              </button>
              <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            </div>
          </>
        )}

        {phase === 'done' && result && (
          <>
            <p className={styles.doneTitle}>
              {result.fileName} — {result.parsed.blocks.length} block
              {result.parsed.blocks.length === 1 ? '' : 's'} extracted
              {result.viaAI ? ' (via AI)' : ''}
            </p>
            <div className={styles.countRow}>
              {['summary', 'experience', 'education', 'skills'].map(
                (t) =>
                  counts[t] ? (
                    <span key={t} className={styles.countChip}>
                      {counts[t]} {t}
                    </span>
                  ) : null,
              )}
            </div>
            {result.parsed.personalInfo?.name && (
              <p className={styles.personalLine}>
                Personal info: {result.parsed.personalInfo.name}
                {result.parsed.personalInfo.email ? ` · ${result.parsed.personalInfo.email}` : ''}
              </p>
            )}
            {result.parsed.skippedSections?.length > 0 && (
              <p className={styles.skipNote}>
                Sections skipped (no matching block type): {result.parsed.skippedSections.join(', ')}
              </p>
            )}
            <div className={styles.footer}>
              <button
                className={styles.primaryBtn}
                onClick={() =>
                  onImport(result.parsed, `Imported — ${result.fileName.replace(/\.pdf$/i, '')}`)
                }
              >
                Create Resume
              </button>
              {!result.viaAI && (
                <button className={styles.secondaryBtn} onClick={retryWithAI}>
                  Retry with AI
                </button>
              )}
              <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
