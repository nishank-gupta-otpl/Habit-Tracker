import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { levelTitle } from '../lib/xp';
import { ProgressBar } from './ui';

export default function AppHeader({ onOpenSettings }) {
  const { profile, level } = useData();
  const { user } = useAuth();

  return (
    <header
      className="sticky top-0 z-30 border-b px-4 pb-3 pt-4 backdrop-blur-xl"
      style={{ background: 'color-mix(in srgb, var(--bg) 82%, transparent)', borderColor: 'var(--border)' }}
    >
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <button onClick={onOpenSettings} className="shrink-0" aria-label="Open settings">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="h-11 w-11 rounded-2xl object-cover"
              style={{ border: '2px solid var(--primary)' }}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 text-lg font-black text-black">
              {(profile?.displayName || 'H')[0]}
            </div>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-extrabold">
              Level {level.level} · {levelTitle(level.level)}
            </span>
            <span className="shrink-0 text-xs font-bold" style={{ color: 'var(--muted)' }}>
              {level.xpIntoLevel} / {level.xpForNextLevel} XP
            </span>
          </div>
          <div className="mt-1.5">
            <ProgressBar
              percent={level.percent}
              color="linear-gradient(90deg, var(--primary), var(--accent))"
              height={8}
              showShimmer
            />
          </div>
        </div>
      </div>
    </header>
  );
}
