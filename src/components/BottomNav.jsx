import { useData } from '../context/DataContext';

const TABS = [
  { key: 'home', label: 'Today', emoji: '🏠' },
  { key: 'habits', label: 'Habits', emoji: '🔥' },
  { key: 'goals', label: 'Goals', emoji: '🎯' },
  { key: 'rewards', label: 'Rewards', emoji: '🏆' },
  { key: 'review', label: 'Review', emoji: '📊' },
];

export default function BottomNav({ active, onChange }) {
  const { unlocks, settings } = useData();
  const unseen = unlocks.filter((u) => !u.seen).length;
  const tabs = settings?.features?.weeklyReview === false ? TABS.filter((t) => t.key !== 'review') : TABS;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-xl"
      style={{
        background: 'color-mix(in srgb, var(--bg) 88%, transparent)',
        borderColor: 'var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="mx-auto flex max-w-2xl">
        {tabs.map((tab) => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5 transition active:scale-90"
              style={{ color: isActive ? 'var(--primary-soft)' : 'var(--muted)' }}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="text-xl leading-none">{tab.emoji}</span>
              <span className="text-[10px] font-bold uppercase tracking-wide">{tab.label}</span>
              {tab.key === 'rewards' && unseen > 0 && (
                <span
                  className="absolute right-[22%] top-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-black"
                  style={{ background: 'var(--danger)', color: '#1a0510' }}
                >
                  {unseen}
                </span>
              )}
              {isActive && (
                <span
                  className="absolute inset-x-[28%] top-0 h-0.5 rounded-full"
                  style={{ background: 'var(--primary)' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
