'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { BorrowerNav } from '@/components/borrower/BorrowerNav';
import styles from './settings.module.css';

interface BorrowerSettingsPortalData {
  user?: {
    id: number | string;
    name: string;
    email: string;
    role: string;
    memberNo: string;
  };
  coopSettings?: {
    coopName?: string;
    branchName?: string;
  };
}

export default function BorrowerSettingsPage() {
  const router = useRouter();
  const [data, setData] = useState<BorrowerSettingsPortalData | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/borrower/portal')
      .then(async (res) => {
        if (res.status === 401) {
          router.push('/borrower/login');
          return;
        }
        const json = await res.json();
        if (json.success) setData(json);
      })
      .catch(() => {});
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters in length.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/borrower/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_password',
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to update password');
      }

      setSuccess('Your password has been securely updated. Please use your new password next time you sign in.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.shell}>
      <BorrowerNav user={data?.user} coopSettings={data?.coopSettings} />

      <main className={styles.mainContent}>
        <div className={styles.headerSection}>
          <div className={styles.titleArea}>
            <h1>Account Settings &amp; Security</h1>
            <p>Manage your login credentials and authentication security.</p>
          </div>
        </div>

        <div className={styles.securityCard}>
          <div className={styles.securityCardHeader}>
            <div className={styles.iconWrap}>
              <Lock size={20} />
            </div>
            <div>
              <h2 className={styles.cardTitle}>Change Login Password</h2>
              <p className={styles.cardSubtitle}>
                Update your password to protect your member portal and loan account.
              </p>
            </div>
          </div>

          {success && (
            <div className={styles.alertSuccess}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} />
                <span>{success}</span>
              </div>
            </div>
          )}

          {error && (
            <div className={styles.alertError}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Current Password</label>
              <input
                type="password"
                className={styles.formInput}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>New Password</label>
              <input
                type="password"
                className={styles.formInput}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new strong password"
                required
                minLength={8}
              />
              <span className={styles.helperText}>Must be at least 8 characters long.</span>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Confirm New Password</label>
              <input
                type="password"
                className={styles.formInput}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                minLength={8}
              />
            </div>

            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? 'Updating Password...' : 'Save New Password'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
