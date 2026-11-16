'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, Mail, ArrowRight, AlertCircle, Building2 } from 'lucide-react';
import styles from './login.module.css';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@tribute.coop');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, requiredRole: 'admin' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Admin authentication failed');
      }

      router.push('/admin/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.pageCanvas}>
      <div className={styles.loginCard}>
        {/* Header */}
        <div className={styles.headerBlock}>
          <div className={styles.iconBadge}>
            <ShieldCheck size={34} />
          </div>
          <div>
            <span className={styles.restrictedPill}>
              <span className={styles.restrictedDot} />
              Restricted Access &bull; Super Admin
            </span>
          </div>
          <h1 className={styles.title}>
            Executive Admin Portal
          </h1>
          <p className={styles.subtitle}>
            System configuration, ledger governance &amp; cooperative control.
          </p>
        </div>

        {error && (
          <div className={styles.errorAlert}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div>
            <label className={styles.label}>
              Administrator Email
            </label>
            <div className={styles.inputWrap}>
              <Mail size={18} className={styles.inputIcon} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@tribute.coop"
                className={styles.input}
              />
            </div>
          </div>

          <div>
            <label className={styles.label}>
              Security Password
            </label>
            <div className={styles.inputWrap}>
              <Lock size={18} className={styles.inputIcon} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••••••"
                className={styles.input}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={styles.submitBtn}
          >
            {loading ? 'Authenticating...' : 'Sign In to Admin Console'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div className={styles.footerLinks}>
          Not an administrator? Switch to{' '}
          <Link href="/officer/login" className={styles.portalLink}>
            Officer Portal
          </Link>{' '}
          or{' '}
          <Link href="/borrower/login" className={styles.portalLink}>
            Member Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
