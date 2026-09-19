import { NOTE_COLORS } from '../lib/colors.js';
import { CheckIcon } from './icons.jsx';

export default function ColorPicker({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Note colour" className="flex flex-wrap gap-2">
      {NOTE_COLORS.map((color) => (
        <button
          key={color.key}
          type="button"
          role="radio"
          aria-checked={value === color.key}
          aria-label={color.name}
          onClick={() => onChange(color.key)}
          className={`note-paper note-${color.key} grid h-9 w-9 place-items-center rounded-full ring-1 ring-black/10 dark:ring-white/15 ${
            value === color.key ? 'ring-2 ring-offset-2 ring-offset-[var(--surface-raised)]' : ''
          }`}
        >
          {value === color.key ? <CheckIcon width={16} height={16} strokeWidth={2.5} /> : null}
        </button>
      ))}
    </div>
  );
}
