/** Horizontal chip row for filtering by label. Hidden until labels exist. */
export default function LabelBar({ labels, active, onChange }) {
  if (!labels.length) return null;
  return (
    <div className="-mx-3 mb-1 flex gap-1.5 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={active === null}
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
          active === null ? 'bg-[var(--text)] text-[var(--surface)]' : 'ring-1 ring-[var(--surface-line)]'
        }`}
      >
        All
      </button>
      {labels.map(({ label, count }) => (
        <button
          key={label}
          type="button"
          onClick={() => onChange(active === label ? null : label)}
          aria-pressed={active === label}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            active === label
              ? 'bg-[var(--text)] text-[var(--surface)]'
              : 'ring-1 ring-[var(--surface-line)]'
          }`}
        >
          {label} <span className="opacity-60">{count}</span>
        </button>
      ))}
    </div>
  );
}
