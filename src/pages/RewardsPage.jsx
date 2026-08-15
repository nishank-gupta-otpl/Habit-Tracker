import { useEffect, useState } from 'react';
import { useData } from '../context/DataContext';
import { useRewards } from '../context/RewardContext';
import { BADGES, TIER_STYLES } from '../lib/badges';
import { THEMES, applyTheme, isThemeUnlocked } from '../lib/themes';
import { levelTitle, xpForLevel } from '../lib/xp';
import { updateSettings } from '../firebase/services';
import { ProgressBar, SegmentedControl } from '../components/ui';

export default function RewardsPage({ onNewReward }) {
  const { unlockedKeys, level, rewards, unlocks, uid, settings } = useData();
  const { claimReward, seeUnlock } = useRewards();
  const [tab, setTab] = useState('badges');

  // Opening this page clears the "new unlock" badge on the nav.
  useEffect(() => {
    unlocks.filter((u) => !u.seen).forEach((u) => seeUnlock(u.key));
  }, [unlocks, seeUnlock]);

  const earned = BADGES.filter((b) => unlockedKeys.has(b.key));

  return (
    <div className="space-y-5">
      {/* Level summary */}
      <section className="card p-5 text-center">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 text-4xl font-black text-black">
          {level.level}
        </div>
        <h2 className="mt-3 text-xl font-black">{levelTitle(level.level)}</h2>
        <p className="text-sm font-bold" style={{ color: 'var(--muted)' }}>
          {level.xp.toLocaleString()} XP total
        </p>
        <div className="mt-4">
          <ProgressBar
            percent={level.percent}
            color="linear-gradient(90deg, var(--primary), var(--accent))"
            height={12}
            showShimmer
          />
          <p className="mt-1.5 text-xs font-bold" style={{ color: 'var(--muted)' }}>
            {level.xpRemaining.toLocaleString()} XP to level {level.level + 1}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Tile label="Badges" value={`${earned.length}/${BADGES.length}`} />
          <Tile label="Themes" value={`${THEMES.filter((t) => isThemeUnlocked(t.key, level.level)).length}/${THEMES.length}`} />
          <Tile label="Rewards" value={rewards.filter((r) => r.claimed).length} />
        </div>
      </section>

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: 'badges', label: '🏅 Badges' },
          { value: 'rewards', label: '🎁 My rewards' },
          { value: 'themes', label: '🎨 Themes' },
        ]}
      />

      {tab === 'badges' && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {BADGES.map((badge) => {
            const has = unlockedKeys.has(badge.key);
            return (
              <div
                key={badge.key}
                className="card flex flex-col items-center gap-1.5 p-3 text-center"
                style={{ opacity: has ? 1 : 0.45 }}
                title={badge.description}
              >
                <div
                  className={`grid h-14 w-14 place-items-center rounded-2xl text-3xl ${has ? `bg-gradient-to-br ${TIER_STYLES[badge.tier]}` : ''}`}
                  style={has ? undefined : { background: 'var(--surface-2)', filter: 'grayscale(1)' }}
                >
                  {has ? badge.emoji : '🔒'}
                </div>
                <span className="text-[11px] font-extrabold leading-tight">{badge.label}</span>
                <span className="text-[9px] leading-tight" style={{ color: 'var(--muted)' }}>
                  {badge.description}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'rewards' && (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Set your own prizes and tie them to a milestone. When you hit it, the reward unlocks and it's on
            you to actually go and collect it.
          </p>
          {rewards.map((reward) => {
            const unlocked = Boolean(reward.unlockedAt);
            return (
              <div key={reward.id} className="card flex items-center gap-3 p-4">
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl"
                  style={{
                    background: unlocked ? 'linear-gradient(135deg, #e879f9, #8b5cf6)' : 'var(--surface-2)',
                    filter: unlocked ? 'none' : 'grayscale(1)',
                  }}
                >
                  {unlocked ? reward.emoji : '🔒'}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate font-extrabold">{reward.title}</h4>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    {triggerLabel(reward.trigger)}
                  </p>
                </div>
                {reward.claimed ? (
                  <span className="chip" style={{ background: 'var(--success)', color: '#04150d' }}>
                    Claimed
                  </span>
                ) : unlocked ? (
                  <button className="btn btn-primary !px-3 !py-2 text-sm" onClick={() => claimReward(reward)}>
                    Claim
                  </button>
                ) : null}
              </div>
            );
          })}
          <button className="btn btn-ghost w-full" onClick={onNewReward}>
            + Create a reward
          </button>
        </div>
      )}

      {tab === 'themes' && (
        <div className="grid grid-cols-2 gap-3">
          {THEMES.map((theme) => {
            const unlocked = isThemeUnlocked(theme.key, level.level);
            const active = settings?.theme === theme.key;
            return (
              <button
                key={theme.key}
                disabled={!unlocked}
                onClick={() => {
                  applyTheme(theme.key);
                  updateSettings(uid, { theme: theme.key });
                }}
                className="card p-3 text-left transition active:scale-95 disabled:opacity-50"
                style={{ outline: active ? '2px solid var(--primary)' : 'none', outlineOffset: -2 }}
              >
                <div className="flex h-12 gap-1 overflow-hidden rounded-xl">
                  {theme.swatch.map((c) => (
                    <span key={c} className="flex-1" style={{ background: c }} />
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between gap-1">
                  <span className="truncate text-sm font-extrabold">
                    {theme.emoji} {theme.name}
                  </span>
                  {active && <span className="text-xs">✓</span>}
                </div>
                <span className="text-[11px] font-bold" style={{ color: 'var(--muted)' }}>
                  {unlocked ? 'Unlocked' : `🔒 Level ${theme.unlockLevel} (${xpForLevel(theme.unlockLevel).toLocaleString()} XP)`}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const Tile = ({ label, value }) => (
  <div className="rounded-xl py-2" style={{ background: 'var(--surface-2)' }}>
    <div className="text-lg font-black">{value}</div>
    <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
      {label}
    </div>
  </div>
);

function triggerLabel(trigger = {}) {
  switch (trigger.kind) {
    case 'streak':
      return `Unlocks at a ${trigger.threshold}-day streak`;
    case 'xp':
      return `Unlocks at ${Number(trigger.threshold).toLocaleString()} XP`;
    case 'level':
      return `Unlocks at level ${trigger.threshold}`;
    case 'goal':
      return 'Unlocks when the linked goal is complete';
    default:
      return 'Unlock by hand whenever you decide you’ve earned it';
  }
}
