// Copy Job Description — Modular Resume Builder
// Injects a "Copy JD" button onto LinkedIn job description panels and copies
// the description text to the clipboard, ready to paste into the builder.
(() => {
  const BUTTON_FLAG = 'mrbCopyAttached';
  const BTN_CLASS = 'mrb-copy-btn';
  // LinkedIn renders the description in these containers depending on the
  // view (jobs search split-pane vs. standalone job page). Order = priority.
  const DESCRIPTION_SELECTORS = [
    '.jobs-description__content',
    '.jobs-description .show-more-less-html__markup',
    '.jobs-description',
  ];

  function findDescription() {
    for (const sel of DESCRIPTION_SELECTORS) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 0) return el;
    }
    return null;
  }

  function extractText(descEl) {
    // innerText preserves line breaks and bullet formatting, which the
    // builder's keyword extractor and autofill both rely on.
    let text = (descEl.innerText || descEl.textContent || '').trim();
    // Collapse 3+ blank lines created by decorative spacing.
    text = text.replace(/\n{3,}/g, '\n\n');
    return text;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback for pages where async clipboard is denied.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      ta.remove();
      return ok;
    }
  }

  function showToast(message, isError) {
    document.querySelectorAll('.mrb-toast').forEach((t) => t.remove());
    const toast = document.createElement('div');
    toast.className = 'mrb-toast' + (isError ? ' mrb-toast-error' : '');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2600);
  }

  function makeButton(descEl) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = BTN_CLASS;
    btn.textContent = 'Copy JD';
    btn.title = 'Copy this job description for Modular Resume Builder';
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const text = extractText(descEl);
      if (!text) {
        showToast('Nothing to copy — description looks empty', true);
        return;
      }
      const ok = await copyText(text);
      if (ok) {
        btn.textContent = 'Copied!';
        btn.classList.add('mrb-copy-btn-done');
        showToast('Job description copied — paste it into the Resume Builder');
        setTimeout(() => {
          btn.textContent = 'Copy JD';
          btn.classList.remove('mrb-copy-btn-done');
        }, 1800);
      } else {
        showToast('Copy failed — select the text manually', true);
      }
    });
    return btn;
  }

  function attachButton() {
    const descEl = findDescription();
    if (!descEl || descEl.dataset[BUTTON_FLAG]) return;
    descEl.dataset[BUTTON_FLAG] = '1';

    // Make the button track the description container. LinkedIn's panel
    // scrolls independently, so anchor inside it rather than using fixed.
    const host = descEl.closest('.jobs-description') || descEl;
    const prevPosition = getComputedStyle(host).position;
    if (prevPosition === 'static') host.style.position = 'relative';
    host.appendChild(makeButton(descEl));
  }

  // LinkedIn is an SPA — the panel re-renders on every job click, so re-scan
  // whenever the DOM settles. Debounced to keep it cheap.
  let pending = false;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      attachButton();
    }, 300);
  });

  observer.observe(document.body, { childList: true, subtree: true });
  attachButton();
})();
