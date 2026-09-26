'use client';
import { useEffect, useRef, useState } from 'react';
import { CircleUserRound, RefreshCw, LogOut, X } from 'lucide-react';
import { authClient } from '@/lib/account/client';
import type { useAccount } from '@/lib/account/use-account';

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62Z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18Z"/>
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.17.29-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33Z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58Z"/>
    </svg>
  );
}

export function AccountPanel({ account }: { account: ReturnType<typeof useAccount> }) {
  const [open, setOpen] = useState(false),
    [email, setEmail] = useState(''),
    [code, setCode] = useState(''),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const connected = account.session && !account.session.user.is_anonymous;
  const label = account.session?.user.email ?? '';
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }
  const client = authClient();
  return (
    <>
      <button
        className="nav-account"
        onClick={() => setOpen(true)}
        aria-label={connected ? 'Account' : 'Sign in'}
      >
        <CircleUserRound size={18} />
        <span>{connected ? label.split('@')[0] : 'SIGN IN'}</span>
      </button>
      <dialog
        ref={dialog}
        className="account-panel"
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
      >
        <header>
          <h2>{connected ? 'ACCOUNT' : 'SAVE YOUR PROGRESS'}</h2>
          <button aria-label="Close account" onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        </header>

        {!account.configured ? (
          <p className="account-note">Account sign-in is not enabled yet.</p>
        ) : connected ? (
          <>
            <div className="account-identity">
              <span className="account-avatar">{label.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{label}</strong>
                <small>Signed in</small>
              </div>
            </div>
            <div className="account-actions">
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await account.refresh();
                    setMessage('Synced');
                  })
                }
              >
                <RefreshCw size={16} />
                <span>
                  <strong>Sync save</strong>
                </span>
              </button>
              <button
                className="account-signout"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const { error } = await client!.auth.signOut();
                    if (error) throw error;
                    setOpen(false);
                  })
                }
              >
                <LogOut size={16} />
                <span>
                  <strong>Sign out</strong>
                </span>
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              className="account-google"
              disabled={busy || account.loading}
              onClick={() =>
                void run(async () => {
                  await account.preserveGuest();
                  const { error } = await client!.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: location.origin + '/' },
                  });
                  if (error) throw error;
                })
              }
            >
              <GoogleMark />
              <span>Continue with Google</span>
            </button>
            <div className="account-divider">
              <span>or email</span>
            </div>
            <form
              className="account-email"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await account.preserveGuest();
                  if (sent) {
                    const { error } = await client!.auth.verifyOtp({
                      email,
                      token: code.trim(),
                      type: 'email',
                    });
                    if (error) throw error;
                    setOpen(false);
                    setSent(false);
                    setCode('');
                  } else {
                    const { error } = await client!.auth.signInWithOtp({
                      email,
                      options: { shouldCreateUser: true },
                    });
                    if (error) throw error;
                    setSent(true);
                    setMessage('Check your email for your code.');
                  }
                });
              }}
            >
              <label>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@email.com"
                  value={email}
                  disabled={sent || busy}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              {sent && (
                <label>
                  <input
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    required
                    minLength={6}
                    maxLength={10}
                    placeholder="Code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </label>
              )}
              <button className="account-submit" disabled={busy || account.loading}>
                {sent ? 'VERIFY & CONNECT' : 'SEND CODE'}
              </button>
              {sent && (
                <button
                  type="button"
                  className="account-linklike"
                  disabled={busy}
                  onClick={() => {
                    setSent(false);
                    setCode('');
                  }}
                >
                  CHANGE EMAIL / RESEND
                </button>
              )}
            </form>
          </>
        )}
        {(message || account.error) && <p role="status" className="account-status">{message || account.error}</p>}
        {busy && <p role="status" className="account-status">WORKING…</p>}
      </dialog>
    </>
  );
}
