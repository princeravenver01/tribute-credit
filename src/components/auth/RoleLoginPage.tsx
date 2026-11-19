'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { PORTAL_CONFIGS, type PortalKey } from '@/config/portal-auth';
import styles from './RoleLoginPage.module.css';

interface RoleLoginPageProps {
  portalKey: PortalKey;
}

function getErrorMessage(code?: string): string {
  if (code === 'WRONG_PORTAL') return 'This account cannot access this portal.';
  if (code === 'SERVICE_UNAVAILABLE' || code === 'RATE_LIMITED') {
    return 'We could not sign you in right now. Please try again.';
  }
  return 'The email or password is incorrect.';
}

export default function RoleLoginPage({ portalKey }: RoleLoginPageProps) {
  const router = useRouter();
  const portal = PORTAL_CONFIGS[portalKey];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as { code?: string };
      if (!response.ok) {
        setError(getErrorMessage(data.code));
        return;
      }
      router.replace(portal.dashboardPath);
      router.refresh();
    } catch {
      setError('We could not sign you in right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page} data-variant={portal.variant}>
      <section className={styles.loginSurface} aria-labelledby={`${portal.key}-login-title`}>
        <aside className={styles.identityPanel} aria-label={`${portal.portalLabel} introduction`}>
          <div className={styles.identityTop}>
            <Image className={styles.logo} src="/tribute-credit-logo.png" alt="Tribute Credit Cooperative" width={184} height={58} priority />
            <span className={styles.portalLabel}>{portal.portalLabel}</span>
          </div>
          <div className={styles.identityMessage}>
            <span className={styles.eyebrow}>Tribute Credit Cooperative</span>
            <h2>{portal.identityHeading}</h2>
            <p>{portal.identityCopy}</p>
          </div>
          <div className={styles.securityNote}>
            <ShieldCheck aria-hidden="true" size={18} />
            <span>Secure cooperative account access</span>
          </div>
        </aside>

        <div className={styles.formPanel}>
          <div className={styles.mobileBrand}>
            <Image src="/tribute-credit-logo.png" alt="Tribute Credit Cooperative" width={156} height={49} priority />
            <span>{portal.portalLabel}</span>
          </div>

          <div className={styles.formHeader}>
            <span className={styles.formPortalLabel}>{portal.portalLabel}</span>
            <h1 id={`${portal.key}-login-title`}>{portal.title}</h1>
            <p>{portal.supportingText}</p>
            {portal.accessNotice && (
              <div className={styles.accessNotice}>
                <ShieldCheck aria-hidden="true" size={15} />
                <span>{portal.accessNotice}</span>
              </div>
            )}
          </div>

          <div className={styles.statusRegion} aria-live="polite" aria-atomic="true">
            {error && <div className={styles.errorAlert}>{error}</div>}
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.fieldGroup}>
              <label htmlFor={`${portal.key}-email`}>Email address</label>
              <div className={styles.inputWrap}>
                <Mail aria-hidden="true" className={styles.inputIcon} size={19} />
                <input id={`${portal.key}-email`} name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required disabled={loading} />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor={`${portal.key}-password`}>Password</label>
              <div className={styles.inputWrap}>
                <LockKeyhole aria-hidden="true" className={styles.inputIcon} size={19} />
                <input id={`${portal.key}-password`} name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required disabled={loading} />
                <button className={styles.passwordToggle} type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)} disabled={loading}>
                  {showPassword ? <EyeOff aria-hidden="true" size={19} /> : <Eye aria-hidden="true" size={19} />}
                </button>
              </div>
            </div>

            <button className={styles.submitButton} type="submit" disabled={loading}>
              <span>{loading ? 'Signing in…' : portal.actionLabel}</span>
              {!loading && <ArrowRight aria-hidden="true" size={19} />}
              {loading && <span className={styles.spinner} aria-hidden="true" />}
            </button>
          </form>

          <p className={styles.supportLine}>Need help accessing your account? Contact Tribute Credit Cooperative support.</p>
          <p className={styles.legalLine}>Protected financial information · Authorized access only</p>
        </div>
      </section>
    </main>
  );
}
