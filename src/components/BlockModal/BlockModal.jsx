import { useState, useRef, useEffect } from 'react';
import { BLOCK_SCHEMA } from '../../utils/constants';
import { formatContactUrl } from '../../utils/personalInfo';
import { SpeechSession } from '../../utils/speechTranscriber';
import styles from './BlockModal.module.css';

export default function BlockModal({
  tempBlock,
  setTempBlock,
  editingBlockId,
  tags, // Now an object: { jt1: "Software Development", ... }
  onAddCustomTag,
  onSave,
  onSaveVariant,
  onSaveChildVariant,
  onClose,
}) {
  const [newTagName, setNewTagName] = useState('');
  const [draggedSkillIdx, setDraggedSkillIdx] = useState(null);
  const [draggedDescIdx, setDraggedDescIdx] = useState(null);
  const [autoParseOpen, setAutoParseOpen] = useState(false);
  const [autoParseText, setAutoParseText] = useState('');
  const [isAutoParsing, setIsAutoParsing] = useState(false);
  const [autoParseError, setAutoParseError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('idle');
  const [recordingMessage, setRecordingMessage] = useState('');
  const speechSessionRef = useRef(null);

  const schema = BLOCK_SCHEMA[tempBlock.type];
  const tagIds = tempBlock.tagIds || [];

  // Cleanup speech session on unmount
  useEffect(() => {
    return () => {
      if (speechSessionRef.current) {
        speechSessionRef.current.cleanup();
        speechSessionRef.current = null;
      }
    };
  }, []);

  const handleToggleVoice = async () => {
    setAutoParseError('');
    if (isRecording) {
      setIsRecording(false);
      if (speechSessionRef.current) {
        await speechSessionRef.current.stop();
        speechSessionRef.current = null;
      }
    } else {
      if (speechSessionRef.current) {
        speechSessionRef.current.cleanup();
      }
      const session = new SpeechSession({
        onTranscript: (text) => {
          setAutoParseText(text);
        },
        onStatusChange: (status, message) => {
          setRecordingStatus(status);
          setRecordingMessage(message || '');
          if (status === 'listening') {
            setIsRecording(true);
          } else if (status === 'idle' || status === 'error') {
            setIsRecording(false);
          }
        },
        onError: (err) => {
          setAutoParseError(err);
          setIsRecording(false);
        },
      });
      speechSessionRef.current = session;
      await session.start(autoParseText);
    }
  };

  const handleCloseAutoParse = async () => {
    if (speechSessionRef.current) {
      await speechSessionRef.current.stop();
      speechSessionRef.current = null;
    }
    setIsRecording(false);
    setAutoParseOpen(false);
  };

  const handleAutoParseSubmit = async () => {
    if (speechSessionRef.current) {
      await speechSessionRef.current.stop();
      speechSessionRef.current = null;
      setIsRecording(false);
    }
    if (!autoParseText.trim()) {
      setAutoParseError('Please type or speak some notes to parse.');
      return;
    }
    setIsAutoParsing(true);
    setAutoParseError('');
    try {
      const token = localStorage.getItem('auth-token');
      const res = await fetch('/api/autoparse-block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          text: autoParseText.trim(),
          targetType: tempBlock.type,
          currentBlock: tempBlock,
          clientDate: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Auto-parsing failed.');
      }

      const parsed = await res.json();
      if (parsed && typeof parsed === 'object') {
        setTempBlock((prev) => {
          const next = { ...prev };
          if (parsed.type) next.type = parsed.type;
          if (parsed.name) next.name = parsed.name;
          if (parsed.fields && typeof parsed.fields === 'object') {
            Object.assign(next, parsed.fields);
            if (parsed.type === 'skills' && Array.isArray(parsed.fields.items)) {
              next.items = parsed.fields.items;
            }
          }
          return next;
        });
        setAutoParseOpen(false);
        setAutoParseText('');
      }
    } catch (err) {
      setAutoParseError(err.message || 'Failed to auto-parse block.');
    } finally {
      setIsAutoParsing(false);
    }
  };

  // Parse legacy skills into items array if needed
  const getSkillItems = () => {
    if (Array.isArray(tempBlock.items) && tempBlock.items.length > 0) {
      return tempBlock.items;
    }
    const rawSkills = String(tempBlock.skills || '');
    const lines = rawSkills.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1 && lines.some((l) => l.includes(':'))) {
      return lines.map((l) => {
        const colonIdx = l.indexOf(':');
        if (colonIdx !== -1) {
          const cat = l.slice(0, colonIdx).replace(/^[•\-\*]\s*/, '').trim();
          const val = l.slice(colonIdx + 1).trim();
          return { category: cat, skills: val };
        }
        return { category: '', skills: l.replace(/^[•\-\*]\s*/, '').trim() };
      });
    }
    return [{ category: tempBlock.category || '', skills: rawSkills }];
  };

  const skillItems = tempBlock.type === 'skills' ? getSkillItems() : [];

  const updateSkillItems = (newItems) => {
    const flatSkills = newItems
      .filter((i) => i.category?.trim() || i.skills?.trim())
      .map((i) => (i.category?.trim() ? `${i.category.trim()}: ${i.skills || ''}` : i.skills || ''))
      .join('\n');
    setTempBlock((prev) => ({
      ...prev,
      items: newItems,
      category: newItems[0]?.category || '',
      skills: flatSkills,
    }));
  };

  const handleSkillItemChange = (index, field, value) => {
    const next = skillItems.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    updateSkillItems(next);
  };

  const handleAddSkillItem = () => {
    const next = [...skillItems, { category: '', skills: '' }];
    updateSkillItems(next);
  };

  const handleRemoveSkillItem = (index) => {
    const next = skillItems.filter((_, i) => i !== index);
    updateSkillItems(next.length ? next : [{ category: '', skills: '' }]);
  };

  const handleSkillDragStart = (e, index) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setDraggedSkillIdx(index);
  };

  const handleSkillDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleSkillDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedSkillIdx === null || draggedSkillIdx === targetIndex) return;
    const next = [...skillItems];
    const [moved] = next.splice(draggedSkillIdx, 1);
    next.splice(targetIndex, 0, moved);
    updateSkillItems(next);
    setDraggedSkillIdx(null);
  };

  const handleSkillDragEnd = () => {
    setDraggedSkillIdx(null);
  };

// Two variant kinds:
  //  - resume variant: variantIn set — lives only on one resume.
  //  - child variant: variantOf set, no variantIn — lives in the library
  //    under its parent block's dropdown.
  const isResumeVariant = !!tempBlock.variantIn;
  const isChildVariant = !isResumeVariant && !!tempBlock.variantOf;
  const isVariant = isResumeVariant || isChildVariant;
  // Saving as a variant copies the block being edited, so only offer it for
  // plain library blocks (not when already editing a variant).
  const canSaveAsVariant = !!editingBlockId && !!onSaveVariant && !isVariant;
  const canSaveAsChildVariant = !!editingBlockId && !!onSaveChildVariant && !isVariant;

  const handleTypeChange = (e) => {
    const nextType = e.target.value;
    if (nextType === tempBlock.type) return;
    // Reset content fields so the old type's fields don't leak into the new
    // type; identity (id/name), job types and variant markers are kept.
    const { id, name, tagIds: tIds, variantIn, variantOf } = tempBlock;
    const next = { type: nextType, tagIds: tIds || [] };
    if (nextType === 'skills') {
      next.items = [{ category: '', skills: '' }];
    }
    if (id !== undefined) next.id = id;
    if (name !== undefined) next.name = name;
    if (variantIn !== undefined) next.variantIn = variantIn;
    if (variantOf !== undefined) next.variantOf = variantOf;
    setTempBlock(next);
  };

  const handleFieldChange = (name, value) => {
    setTempBlock((prev) => ({ ...prev, [name]: value }));
  };

  // Description is stored as an array of bullet strings, edited one bullet per
  // cell (mirrors the skills builder). Strings from legacy data are handled.
  const getDescriptionItems = () => {
    const d = tempBlock.description;
    if (Array.isArray(d)) return d;
    if (typeof d === 'string')
      return d.split('\n').map((s) => s.trim()).filter(Boolean);
    return [];
  };

  const updateDescriptionItem = (index, value) => {
    const items = getDescriptionItems();
    while (items.length <= index) items.push('');
    items[index] = value;
    setTempBlock((prev) => ({ ...prev, description: items }));
  };

  const addDescriptionItem = () => {
    setTempBlock((prev) => ({ ...prev, description: [...getDescriptionItems(), ''] }));
  };

  const removeDescriptionItem = (index) => {
    const items = getDescriptionItems();
    const next = items.filter((_, i) => i !== index);
    setTempBlock((prev) => ({ ...prev, description: next.length ? next : [''] }));
  };

  const handleDescDragStart = (e, index) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setDraggedDescIdx(index);
  };

  const handleDescDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedDescIdx === null || draggedDescIdx === targetIndex) return;
    const items = getDescriptionItems();
    const [moved] = items.splice(draggedDescIdx, 1);
    items.splice(targetIndex, 0, moved);
    setTempBlock((prev) => ({ ...prev, description: items }));
    setDraggedDescIdx(null);
  };

  // Show at least one editable cell so a fresh block isn't a dead list.
  const descItems = getDescriptionItems();
  const visibleDescItems = descItems.length ? descItems : [''];

  const toggleTag = (tagId) => {
    setTempBlock((prev) => {
      const ids = prev.tagIds || [];
      const has = ids.includes(tagId);
      return {
        ...prev,
        tagIds: has ? ids.filter((id) => id !== tagId) : [...ids, tagId],
      };
    });
  };

  const handleAddCustomTag = () => {
    if (!newTagName.trim()) return;
    onAddCustomTag(newTagName);
    setNewTagName('');
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
            <select value={tempBlock.type} onChange={handleTypeChange}>
              {Object.entries(BLOCK_SCHEMA).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.label}
                </option>
              ))}
            </select>
            {!!editingBlockId && (
              <span className={styles.nameHint}>
                Changing the type clears this block's fields and moves it to the matching section
                on the canvas.
              </span>
            )}
          </div>

          {tempBlock.type === 'skills' ? (
            <div className={styles.skillsBuilder}>
              <div className={styles.skillsBuilderHeader}>
                <label>Skills & Categories</label>
                <span className={styles.nameHint}>
                  Add categories (e.g. Languages, Tools) or leave Category empty for simple bullet points. Drag ☰ to reorder.
                </span>
              </div>
              <div className={styles.skillsList}>
                {skillItems.map((item, idx) => (
                  <div
                    key={idx}
                    className={`${styles.skillRow} ${draggedSkillIdx === idx ? styles.skillRowDragging : ''}`}
                    draggable
                    onDragStart={(e) => handleSkillDragStart(e, idx)}
                    onDragOver={handleSkillDragOver}
                    onDrop={(e) => handleSkillDrop(e, idx)}
                    onDragEnd={handleSkillDragEnd}
                  >
                    <span className={styles.dragHandle} title="Drag to reorder">
                      &#9776;
                    </span>
                    <input
                      type="text"
                      className={styles.catInput}
                      placeholder="Category (e.g. Languages)"
                      value={item.category || ''}
                      onChange={(e) => handleSkillItemChange(idx, 'category', e.target.value)}
                    />
                    <span className={styles.colonLabel}>:</span>
                    <input
                      type="text"
                      className={styles.skillInput}
                      placeholder="Skills (e.g. JavaScript, Python, SQL)"
                      value={item.skills || ''}
                      onChange={(e) => handleSkillItemChange(idx, 'skills', e.target.value)}
                    />
                    <button
                      type="button"
                      className={styles.removeSkillBtn}
                      onClick={() => handleRemoveSkillItem(idx)}
                      title="Remove row"
                      disabled={skillItems.length <= 1 && !item.category && !item.skills}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className={styles.addSkillBtn}
                onClick={handleAddSkillItem}
              >
                + Add Category
              </button>
            </div>
          ) : (
            schema.fields.map((field) => (
              <div key={field.name} className={styles.field}>
                <div className={styles.fieldLabelRow}>
                  <label>{field.label}</label>
                  {field.name === 'link' && tempBlock.link && (
                    <a
                      href={formatContactUrl(tempBlock.link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.linkPreview}
                      title="Test link in new tab"
                    >
                      Test Link ↗
                    </a>
                  )}
                </div>
                {field.name === 'description' ? (
                  <div className={styles.descriptionBuilder}>
                    <div className={styles.skillsList}>
                      {visibleDescItems.map((item, idx) => (
                        <div
                          key={idx}
                          className={`${styles.skillRow} ${draggedDescIdx === idx ? styles.skillRowDragging : ''}`}
                          draggable
                          onDragStart={(e) => handleDescDragStart(e, idx)}
                          onDragOver={handleSkillDragOver}
                          onDrop={(e) => handleDescDrop(e, idx)}
                          onDragEnd={handleSkillDragEnd}
                        >
                          <span className={styles.dragHandle} title="Drag to reorder">
                            &#9776;
                          </span>
                          <span className={styles.bulletLabel}>•</span>
                          <input
                            type="text"
                            className={styles.skillInput}
                            placeholder="Accomplishment, detail, or result…"
                            value={item}
                            onChange={(e) => updateDescriptionItem(idx, e.target.value)}
                          />
                          <button
                            type="button"
                            className={styles.removeSkillBtn}
                            onClick={() => removeDescriptionItem(idx)}
                            title="Remove bullet point"
                            disabled={descItems.length <= 1 && !item}
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                    <button type="button" className={styles.addSkillBtn} onClick={addDescriptionItem}>
                      + Add Bullet Point
                    </button>
                    <span className={styles.nameHint}>
                      One bullet point per cell — each becomes a • bullet point on the canvas and exported PDF.
                    </span>
                  </div>
                ) : field.type === 'textarea' ? (
                  <textarea
                    placeholder={field.placeholder || ''}
                    value={tempBlock[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  />
                ) : (
                  <input
                    type="text"
                    placeholder={field.placeholder || (field.name === 'link' ? 'e.g. https://github.com/username/project' : '')}
                    value={tempBlock[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  />
                )}
                {field.name === 'link' && (
                  <span className={styles.nameHint}>
                    Makes the project header a clickable hyperlink on the canvas and exported PDF.
                  </span>
                )}
              </div>
            ))
          )}

          <div className={styles.field}>
            <label>Tags</label>
            <div className={styles.jobTypeSelect}>
              {Object.entries(tags).map(([id, name]) => (
                <span
                  key={id}
                  className={`${styles.tag} ${tagIds.includes(id) ? styles.active : ''}`}
                  onClick={() => toggleTag(id)}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <input
              type="text"
              placeholder="Add custom tag..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddCustomTag();
                  e.preventDefault();
                }
              }}
            />
            <button className={styles.addBtn} onClick={handleAddCustomTag}>
              Add Tag
            </button>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.autoParseBtn}
            onClick={() => {
              setAutoParseError('');
              setAutoParseOpen(true);
            }}
            title="Open AI auto-parse window to structure raw experience into STAR bullet points"
          >
            ✨ Auto-Parse
          </button>
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

        {autoParseOpen && (
          <div className={styles.autoParseOverlay} onClick={handleCloseAutoParse}>
            <div className={styles.autoParseModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.autoParseHeader}>
                <div className={styles.autoParseTitleGroup}>
                  <span className={styles.sparkleIcon}>✨</span>
                  <div>
                    <h4>Auto-Parse Experience</h4>
                    <span className={styles.autoParseSubtitle}>
                      Powered by AI & STAR sentence structure (Situation, Task, Action, Result)
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={handleCloseAutoParse}
                >
                  &times;
                </button>
              </div>

              <div className={styles.autoParseBody}>
                <div className={styles.starGuideBox}>
                  <div className={styles.starPills}>
                    <span className={styles.starPill}><strong>S</strong>ituation</span>
                    <span className={styles.starPill}><strong>T</strong>ask</span>
                    <span className={styles.starPill}><strong>A</strong>ction</span>
                    <span className={styles.starPill}><strong>R</strong>esult</span>
                  </div>
                  <p className={styles.starGuideText}>
                    Type, paste, or speak out what you went through (your role, company, challenges, actions taken, and measurable results). The AI will structure it into impactful STAR-method bullet points with quantified results.
                  </p>
                </div>

                <div className={styles.autoParseField}>
                  <div className={styles.autoParseLabelRow}>
                    <label>What did you work on?</label>
                    <button
                      type="button"
                      className={`${styles.micBtn} ${isRecording ? styles.micBtnActive : ''}`}
                      onClick={handleToggleVoice}
                      disabled={isAutoParsing}
                      title={
                        isRecording
                          ? 'Click to stop voice dictation'
                          : 'Talk out your experience (Real-time Speech-to-Text)'
                      }
                    >
                      <span className={styles.micIconWrap}>
                        {isRecording ? (
                          <span className={styles.recordingPulseDot} />
                        ) : (
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                          </svg>
                        )}
                      </span>
                      <span>{isRecording ? 'Listening (Click to Stop)' : '🎙️ Voice Dictate'}</span>
                      <span className={styles.modelPill}>Whisper AI</span>
                    </button>
                  </div>

                  {isRecording && (
                    <div className={styles.liveVoiceBar}>
                      <div className={styles.liveBadgeGroup}>
                        <span className={styles.liveBadge}>● LIVE</span>
                        <div className={styles.soundWave}>
                          <span />
                          <span />
                          <span />
                          <span />
                          <span />
                        </div>
                      </div>
                      <span className={styles.liveStatusText}>
                        {recordingMessage || 'Listening in real time... Speak freely'}
                      </span>
                      <button
                        type="button"
                        className={styles.stopVoiceBtn}
                        onClick={handleToggleVoice}
                      >
                        Stop Recording
                      </button>
                    </div>
                  )}

                  <textarea
                    className={styles.autoParseTextarea}
                    rows={6}
                    placeholder="e.g. I was a Senior Software Engineer at TechCorp from Jan 2021 to Present in San Francisco. Our API had latency spikes causing 15% drop-offs during black friday. I redesigned the cache with Redis and optimized SQL queries, reducing latency by 45% and saving $80k in cloud infrastructure. Also mentored 4 junior devs."
                    value={autoParseText}
                    onChange={(e) => setAutoParseText(e.target.value)}
                    disabled={isAutoParsing}
                    autoFocus
                  />
                </div>

                {autoParseError && (
                  <div className={styles.autoParseError}>{autoParseError}</div>
                )}
              </div>

              <div className={styles.autoParseFooter}>
                <button
                  type="button"
                  onClick={handleCloseAutoParse}
                  disabled={isAutoParsing}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.autoParseSubmitBtn}
                  onClick={handleAutoParseSubmit}
                  disabled={isAutoParsing || !autoParseText.trim()}
                >
                  {isAutoParsing ? (
                    <>
                      <span className={styles.spinner} />
                      Parsing with AI...
                    </>
                  ) : (
                    '⚡ Generate & Map to Block'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
