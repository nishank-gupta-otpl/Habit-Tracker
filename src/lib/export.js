// Data export — one of the optional extras from the brief.
//
// Everything the app knows, in one JSON file. Firestore Timestamps are
// converted to ISO strings so the backup is readable without the SDK.

export function exportAll({ profile, habits, quitHabits, goals, entries, urges, rewards, unlocks }) {
  return {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    profile: clean(profile),
    habits: (habits || []).map(clean),
    quitHabits: (quitHabits || []).map(clean),
    goals: (goals || []).map(clean),
    entries: (entries || []).map(clean),
    urges: (urges || []).map(clean),
    rewards: (rewards || []).map(clean),
    unlocks: (unlocks || []).map(clean),
  };
}

/** Recursively convert Firestore Timestamps to ISO strings. */
function clean(value) {
  if (value == null) return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(clean);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v)]));
  }
  return value;
}

export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick so the download has definitely started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
