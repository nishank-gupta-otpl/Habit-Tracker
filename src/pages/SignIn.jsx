import { useAuth } from '../context/AuthContext';

export default function SignIn() {
  const { signIn, error } = useAuth();

  return (
    <div className="relative z-10 grid min-h-full place-items-center p-6">
      <div className="w-full max-w-sm text-center">
        <div className="animate-pop-in mx-auto grid h-24 w-24 place-items-center rounded-[1.75rem] bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 text-5xl shadow-2xl">
          ⚡
        </div>

        <h1 className="mt-6 text-4xl font-black tracking-tight">Momentum</h1>
        <p className="mt-2 text-base font-semibold" style={{ color: 'var(--muted)' }}>
          Build habits. Break bad ones. Hit your goals — and get rewarded for it.
        </p>

        <div className="my-8 grid grid-cols-2 gap-3 text-left">
          <Feature emoji="🔥" title="Streaks" body="Daily check-ins and streak history" />
          <Feature emoji="🛡️" title="Quit tracking" body="Days clean, urges and triggers" />
          <Feature emoji="🎯" title="Goals" body="Auto % progress and pace" />
          <Feature emoji="🏆" title="Rewards" body="XP, badges and unlockable themes" />
        </div>

        <button className="btn btn-primary w-full !py-3.5 text-base" onClick={signIn}>
          <GoogleMark />
          Continue with Google
        </button>

        {error && (
          <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        <p className="mt-5 text-xs" style={{ color: 'var(--muted)' }}>
          Your data syncs privately to your own Google account. Nobody else can read it.
        </p>
      </div>
    </div>
  );
}

const Feature = ({ emoji, title, body }) => (
  <div className="card p-3">
    <div className="text-2xl">{emoji}</div>
    <p className="mt-1 text-sm font-extrabold">{title}</p>
    <p className="text-[11px] leading-snug" style={{ color: 'var(--muted)' }}>
      {body}
    </p>
  </div>
);

const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.5c0-1.6-.15-3.2-.43-4.7H24v9.1h12.9c-.56 3-2.24 5.5-4.77 7.2l7.5 5.8c4.4-4 6.95-10 6.95-17.4z" />
    <path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C1 16.4 0 20.1 0 24s1 7.6 2.6 10.8l7.8-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.7-3.7-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);
