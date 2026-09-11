const HAS_BULLET = /^\s*[•\-\*–—]\s*/;
const BULLET_TYPES = new Set(['experience', 'projects', 'activities', 'cca']);

// Renders body text (a string or an array of strings) as one line per
// bullet point. Lines that already carry a bullet marker (imported or
// AI-authored) are not double-bulleted. Bold `**text**` is honored.
export default function BulletedBody({ text, bullets = false, className }) {
  if (Array.isArray(text)) text = text.join('\n');
  if (typeof text !== 'string' || !text.trim()) return null;

  return text
    .split('\n')
    .filter((line) => line.trim())
    .map((line, i) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <p key={i} className={className} style={{ margin: '0 0 2px 0' }}>
          {bullets && !HAS_BULLET.test(line) ? (
            <span style={{ marginRight: '6px' }}>•</span>
          ) : null}
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
        </p>
      );
    });
}

export function isBulletType(type) {
  return BULLET_TYPES.has(type);
}