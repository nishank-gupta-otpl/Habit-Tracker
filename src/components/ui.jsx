import { useEffect, useRef } from 'react';

export function ProgressBar({ percent, color = 'var(--primary)', height = 10, showShimmer = false }) {
  const clamped = Math.max(0, Math.min(100, percent || 0));
  return (
    <div
      className="w-full overflow-hidden rounded-full"
      style={{ height, background: 'var(--surface-2)' }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`relative h-full rounded-full transition-all duration-700 ease-out ${showShimmer ? 'shimmer' : ''}`}
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  );
}

/** Circular progress used on goal cards — reads better than a bar at a glance. */
export function RingProgress({ percent, size = 64, stroke = 7, color = 'var(--primary)', label }) {
  const clamped = Math.max(0, Math.min(100, percent || 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (clamped / 100) * circumference}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.34, 1.3, 0.64, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-sm font-extrabold">{label ?? `${clamped}%`}</span>
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide = false }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === ref.current && onClose?.()}
      ref={ref}
    >
      <div
        className={`animate-pop-in card max-h-[92vh] w-full overflow-y-auto rounded-b-none sm:rounded-b-3xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b px-5 py-4"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button onClick={onClose} className="btn btn-ghost !px-3 !py-1.5" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && (
          <div
            className="sticky bottom-0 flex gap-3 border-t px-5 py-4"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ emoji, title, body, action }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="text-5xl">{emoji}</div>
      <h3 className="text-xl font-extrabold">{title}</h3>
      <p className="max-w-sm text-sm" style={{ color: 'var(--muted)' }}>
        {body}
      </p>
      {action}
    </div>
  );
}

export function Stat({ label, value, accent }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
        {label}
      </span>
      <span className="text-lg font-extrabold" style={{ color: accent }}>
        {value}
      </span>
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 py-2.5 text-left"
      role="switch"
      aria-checked={checked}
    >
      <span className="min-w-0">
        <span className="block font-semibold">{label}</span>
        {description && (
          <span className="block text-xs" style={{ color: 'var(--muted)' }}>
            {description}
          </span>
        )}
      </span>
      <span
        className="relative h-7 w-12 shrink-0 rounded-full transition"
        style={{ background: checked ? 'var(--primary)' : 'var(--surface-2)' }}
      >
        <span
          className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all"
          style={{ left: checked ? 26 : 4 }}
        />
      </span>
    </button>
  );
}

export function SegmentedControl({ options, value, onChange }) {
  return (
    <div
      className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl p-1"
      style={{ background: 'var(--surface-2)' }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className="flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold transition"
          style={
            value === option.value
              ? { background: 'var(--primary)', color: '#0a0a16' }
              : { color: 'var(--muted)' }
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const EMOJI_CHOICES = [
  '✅','🔥','💪','🏃','🧘','📚','💧','🥗','😴','🦷','🧹','💰','🎸','🎨','✍️','🧠','🚴','🏊','⛰️','🌱',
  '🚭','🍺','🍔','📱','🎮','☕','🍬','💸','😤','⏰','🎯','🏆','⭐','💎','🚀','🌟','🎁','📈','🗓️','🧩',
];

export function EmojiPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-10 gap-1.5">
      {EMOJI_CHOICES.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onChange(emoji)}
          className="aspect-square rounded-lg text-xl transition active:scale-90"
          style={{
            background: value === emoji ? 'var(--primary)' : 'var(--surface-2)',
            outline: value === emoji ? '2px solid var(--primary-soft)' : 'none',
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

export function ColorPicker({ value, onChange, colors }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(colors).map(([key, c]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-label={key}
          className="h-9 w-9 rounded-full transition active:scale-90"
          style={{
            background: `linear-gradient(135deg, ${c.from}, ${c.to})`,
            outline: value === key ? '3px solid var(--text)' : 'none',
            outlineOffset: 2,
          }}
        />
      ))}
    </div>
  );
}

/** Floating "+15 XP" numbers that rise from the bottom of the screen. */
export function XpFloaters({ floaters }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex flex-col items-center gap-1">
      {floaters.map((f) => (
        <div
          key={f.id}
          className="animate-rise-fade rounded-full px-4 py-1.5 text-sm font-extrabold shadow-lg"
          style={{ background: 'var(--primary)', color: '#0a0a16' }}
        >
          +{f.amount} XP
        </div>
      ))}
    </div>
  );
}

export function Confetti({ count = 40 }) {
  const pieces = Array.from({ length: count }, (_, i) => i);
  const colors = ['#8b5cf6', '#22d3ee', '#fbbf24', '#fb7185', '#34d399', '#e879f9'];
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((i) => (
        <span
          key={i}
          className="absolute block h-2.5 w-2 rounded-sm"
          style={{
            left: `${(i * 97) % 100}%`,
            background: colors[i % colors.length],
            animation: `confetti-fall ${1.6 + ((i * 7) % 12) / 10}s linear ${(i % 10) / 12}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
