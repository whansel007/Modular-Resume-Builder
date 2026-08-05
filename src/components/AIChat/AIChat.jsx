import { useState, useRef, useEffect } from 'react';
import styles from './AIChat.module.css';

const SUGGESTIONS = [
  'How can I improve this resume?',
  "What's missing from my resume?",
  'Is my summary strong enough?',
];

export default function AIChat({ resume, blocks }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to the latest message
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  // Focus the input when the chat opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const sendMessage = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    setInput('');
    setError('');
    const nextMessages = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const res = await fetch('/api/resume-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth-token')}`,
        },
        body: JSON.stringify({
          messages: nextMessages.slice(-10),
          resume: {
            title: resume.title,
            personalInfo: resume.personalInfo,
            sectionOrder: resume.sectionOrder,
            sections: resume.sections,
          },
          blocks,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to reach the AI assistant');
      }

      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      console.error('AI chat error:', err);
      setError(err.message || 'Failed to reach the AI assistant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-print-hide>
      {open && (
        <div className={styles.chatWindow}>
          <div className={styles.chatHeader}>
            <div className={styles.chatHeaderTitle}>
              <span className={styles.chatHeaderIcon}>✦</span> Resume Assistant
            </div>
            <button className={styles.closeBtn} onClick={() => setOpen(false)} title="Close chat">
              &times;
            </button>
          </div>

          <div className={styles.messages} ref={listRef}>
            {messages.length === 0 && (
              <div className={styles.welcome}>
                <p className={styles.welcomeText}>
                  Hi! Ask me anything about your resume — I can see what's on the canvas right now.
                </p>
                <div className={styles.suggestions}>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      className={styles.suggestionBtn}
                      onClick={() => sendMessage(s)}
                      disabled={loading}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`${styles.messageRow} ${m.role === 'user' ? styles.userRow : styles.assistantRow}`}
              >
                <div className={`${styles.bubble} ${m.role === 'user' ? styles.userBubble : styles.assistantBubble}`}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className={`${styles.messageRow} ${styles.assistantRow}`}>
                <div className={`${styles.bubble} ${styles.assistantBubble} ${styles.typing}`}>
                  Thinking<span className={styles.dots}>...</span>
                </div>
              </div>
            )}

            {error && <div className={styles.chatError}>{error}</div>}
          </div>

          <div className={styles.inputRow}>
            <input
              ref={inputRef}
              className={styles.chatInput}
              placeholder="Ask about your resume..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendMessage();
              }}
              disabled={loading}
            />
            <button
              className={styles.sendBtn}
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              title="Send"
            >
              ➤
            </button>
          </div>
        </div>
      )}

      <button
        className={`${styles.aiButton} ${open ? styles.aiButtonActive : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        title={open ? 'Close AI assistant' : 'Ask AI about your resume'}
      >
        <span className={styles.aiButtonIcon}>✦</span>
        <span className={styles.aiButtonLabel}>AI</span>
      </button>
    </div>
  );
}
