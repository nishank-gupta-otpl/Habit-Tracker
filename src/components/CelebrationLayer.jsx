import { useEffect } from 'react';
import { Confetti } from './ui';
import { TIER_STYLES } from '../lib/badges';
import { levelTitle } from '../lib/xp';
import { useRewards } from '../context/RewardContext';

/**
 * Full-screen celebration overlay. Only ever shows the front of the queue, so
 * earning three badges at once plays three pop-ups in sequence rather than
 * stacking them on top of each other.
 */
export default function CelebrationLayer() {
  const { celebrations, dismissCelebration } = useRewards();
  const current = celebrations[0];

  useEffect(() => {
    if (!current) return undefined;
    // Auto-dismiss so a celebration never blocks a quick check-in run.
    const timer = setTimeout(() => dismissCelebration(current.id), 5000);
    if (navigator.vibrate) navigator.vibrate(current.type === 'level' ? [40, 60, 90] : 40);
    return () => clearTimeout(timer);
  }, [current, dismissCelebration]);

  if (!current) return null;

  return (
    <>
      <Confetti />
      <div
        className="fixed inset-0 z-[61] grid place-items-center bg-black/75 p-6 backdrop-blur-md"
        onClick={() => dismissCelebration(current.id)}
        role="alertdialog"
        aria-live="assertive"
      >
        <div className="animate-pop-in flex w-full max-w-sm flex-col items-center gap-4 text-center">
          {current.type === 'level' && <LevelUp celebration={current} />}
          {current.type === 'badge' && <BadgeUnlocked badge={current.badge} />}
          {current.type === 'goal' && <GoalComplete goal={current.goal} />}
          {current.type === 'reward' && <RewardUnlocked reward={current.reward} />}
          {current.type === 'claimed' && <RewardClaimed reward={current.reward} />}
          <button className="btn btn-primary mt-2 w-full">Nice!</button>
        </div>
      </div>
    </>
  );
}

function LevelUp({ celebration }) {
  return (
    <>
      <div className="animate-pulse-ring grid h-32 w-32 place-items-center rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 text-5xl font-black text-black">
        {celebration.level}
      </div>
      <h2 className="text-3xl font-black">LEVEL UP!</h2>
      <p className="text-lg font-bold" style={{ color: 'var(--accent)' }}>
        You’re now a {levelTitle(celebration.level)}
      </p>
      {celebration.themes?.length > 0 && (
        <div className="card w-full p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
            New theme{celebration.themes.length > 1 ? 's' : ''} unlocked
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {celebration.themes.map((theme) => (
              <span key={theme.key} className="chip">
                {theme.emoji} {theme.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function BadgeUnlocked({ badge }) {
  return (
    <>
      <div
        className={`animate-pulse-ring grid h-32 w-32 place-items-center rounded-3xl bg-gradient-to-br text-6xl ${TIER_STYLES[badge.tier] || TIER_STYLES.bronze}`}
      >
        {badge.emoji}
      </div>
      <h2 className="text-2xl font-black">BADGE UNLOCKED</h2>
      <p className="text-xl font-extrabold" style={{ color: 'var(--accent)' }}>
        {badge.label}
      </p>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        {badge.description}
      </p>
    </>
  );
}

function GoalComplete({ goal }) {
  return (
    <>
      <div className="animate-pulse-ring grid h-32 w-32 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-orange-600 text-6xl">
        {goal.emoji || '🎯'}
      </div>
      <h2 className="text-3xl font-black">GOAL COMPLETE!</h2>
      <p className="text-xl font-extrabold" style={{ color: 'var(--accent)' }}>
        {goal.title}
      </p>
      <p className="text-sm font-bold" style={{ color: 'var(--muted)' }}>
        +150 XP
      </p>
    </>
  );
}

function RewardUnlocked({ reward }) {
  return (
    <>
      <div className="animate-pulse-ring grid h-32 w-32 place-items-center rounded-3xl bg-gradient-to-br from-fuchsia-500 to-violet-600 text-6xl">
        {reward.emoji || '🎁'}
      </div>
      <h2 className="text-2xl font-black">REWARD EARNED</h2>
      <p className="text-xl font-extrabold" style={{ color: 'var(--accent)' }}>
        {reward.title}
      </p>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        You set this one yourself — go and claim it.
      </p>
    </>
  );
}

function RewardClaimed({ reward }) {
  return (
    <>
      <div className="grid h-32 w-32 place-items-center rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-600 text-6xl">
        {reward.emoji || '🎁'}
      </div>
      <h2 className="text-2xl font-black">ENJOY IT</h2>
      <p className="text-lg font-bold">{reward.title}</p>
    </>
  );
}
