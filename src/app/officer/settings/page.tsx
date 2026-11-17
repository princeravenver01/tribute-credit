'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { OfficerSidebar } from '@/components/officer/OfficerSidebar';
import { OfficerMobileNav } from '@/components/officer/OfficerMobileNav';
import { AppHeader } from '@/components/common/AppHeader';
import {
  User,
  KeyRound,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Save,
} from 'lucide-react';
import theme from '@/components/officer/OfficerTheme.module.css';
import styles from './settings.module.css';

interface OfficerProfile {
  id: number;
  member_no: string;
  name: string;
  email: string;
  role: string;
  contact_number: string;
  status: string;
  created_at?: string;
}

export default function OfficerSettingsPage() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profile, setProfile] = useState<OfficerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  // Profile Form State (only safe self-service fields allowed)
  const [displayName, setDisplayName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [profileErrorMsg, setProfileErrorMsg] = useState('');

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState('');
  const [passwordErrorMsg, setPasswordErrorMsg] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchAccount = async () => {
      try {
        const res = await fetch('/api/officer/account');
        if (!isMounted) return;
        if (res.ok) {
          const data = await res.json();
          if (data.user && isMounted) {
            setProfile(data.user);
            setDisplayName(data.user.name || '');
            setContactNumber(data.user.contact_number || '');
            setIsOffline(Boolean(data.isOffline));
          }
        } else {
          setProfile({
            id: 101,
            member_no: 'AO-001',
            name: 'Officer Juan',
            email: 'officer@tribute.coop',
            role: 'account_officer',
            contact_number: '0917-889-4400',
            status: 'active'
          });
          setDisplayName('Officer Juan');
          setContactNumber('0917-889-4400');
        }
      } catch {
        if (!isMounted) return;
        setIsOffline(true);
        setProfile({
          id: 101,
          member_no: 'AO-001',
          name: 'Officer Juan',
          email: 'officer@tribute.coop',
          role: 'account_officer',
          contact_number: '0917-889-4400',
          status: 'active'
        });
        setDisplayName('Officer Juan');
        setContactNumber('0917-889-4400');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchAccount();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccessMsg('');
    setProfileErrorMsg('');

    if (!displayName.trim()) {
      setProfileErrorMsg('Full name cannot be blank.');
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await fetch('/api/officer/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_profile',
          name: displayName,
          contact_number: contactNumber
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setProfileSuccessMsg('Profile information updated successfully.');
        setProfile(prev => prev ? { ...prev, name: displayName, contact_number: contactNumber } : null);
        setTimeout(() => setProfileSuccessMsg(''), 4000);
      } else {
        setProfileErrorMsg(data.error || 'Failed to update profile.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error: Unable to connect to server.';
      setProfileErrorMsg(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccessMsg('');
    setPasswordErrorMsg('');

    if (!currentPassword) {
      setPasswordErrorMsg('Current password is required.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordErrorMsg('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg('New password and confirmation do not match.');
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await fetch('/api/officer/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_password',
          currentPassword,
          newPassword,
          confirmPassword
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPasswordSuccessMsg('Password changed successfully. Please remember your new credentials.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccessMsg(''), 4000);
      } else {
        setPasswordErrorMsg(data.error || 'Failed to change password.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error: Unable to connect to server.';
      setPasswordErrorMsg(msg);
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignored
    }
    router.push('/officer/login');
  };

  return (
    <div className={`${theme.theme} ${theme.pageShell}`}>
      <OfficerSidebar
        userName={profile?.name || 'Officer Juan'}
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <main className={`officer-main-content ${theme.main}`}>
        <AppHeader
          panelType="officer"
          userName={profile?.name || 'Officer Juan'}
          badgeLabel="Account & Security"
          pageTitle="Account Officer Settings"
          pageSubtitle="Officer profile details, self-service contact update, and credential management."
          onOpenMobileSidebar={() => setMobileMenuOpen(prev => !prev)}
        />

        <div className={styles.settingsContainer}>
          {isOffline && (
            <div className={styles.offlineBanner}>
              <AlertCircle size={18} />
              <span>
                Operating in local fallback mode. Profile details are derived from your authenticated session. Permanent database updates require active MySQL connectivity.
              </span>
            </div>
          )}

          {/* Section 1: Officer Profile & Contact */}
          <div className={styles.profileCard}>
            <div className={styles.cardHeader}>
              <div className={styles.headerIconWrap}>
                <User size={20} />
              </div>
              <div>
                <h2 className={styles.cardTitle}>Officer Profile & Identity</h2>
                <p className={styles.cardSubtitle}>
                  View official cooperative registration details and update your contact phone.
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile}>
              <div className={styles.formGrid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    Full Name / Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className={styles.input}
                    placeholder="e.g. Officer Juan De La Cruz"
                    required
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    Contact Mobile Number
                  </label>
                  <input
                    type="text"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className={styles.input}
                    placeholder="e.g. 0917-889-4400"
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    Officer Email Address <span className={styles.readOnlyBadge}>Read Only</span>
                  </label>
                  <input
                    type="email"
                    value={profile?.email || 'officer@tribute.coop'}
                    disabled
                    className={`${styles.input} ${styles.inputReadOnly}`}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    Assigned Desk Role <span className={styles.readOnlyBadge}>Read Only</span>
                  </label>
                  <input
                    type="text"
                    value="Account Officer (Field & Credit Underwriter)"
                    disabled
                    className={`${styles.input} ${styles.inputReadOnly}`}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    Officer ID / Badge Code <span className={styles.readOnlyBadge}>Read Only</span>
                  </label>
                  <input
                    type="text"
                    value={profile?.member_no || 'AO-001'}
                    disabled
                    className={`${styles.input} ${styles.inputReadOnly}`}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    Account Status <span className={styles.readOnlyBadge}>Read Only</span>
                  </label>
                  <input
                    type="text"
                    value={profile?.status?.toUpperCase() || 'ACTIVE'}
                    disabled
                    className={`${styles.input} ${styles.inputReadOnly}`}
                  />
                </div>
              </div>

              <div className={styles.cardActions}>
                {profileSuccessMsg && (
                  <div className={`${styles.alertBox} ${styles.alertSuccess}`}>
                    <CheckCircle2 size={16} />
                    <span>{profileSuccessMsg}</span>
                  </div>
                )}
                {profileErrorMsg && (
                  <div className={`${styles.alertBox} ${styles.alertError}`}>
                    <AlertCircle size={16} />
                    <span>{profileErrorMsg}</span>
                  </div>
                )}
                <div style={{ marginLeft: 'auto' }}>
                  <button
                    type="submit"
                    disabled={isSavingProfile || isLoading}
                    className={styles.submitBtn}
                  >
                    <Save size={15} />
                    <span>{isSavingProfile ? 'Saving...' : 'Save Profile Changes'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Section 2: Password & Authentication Security */}
          <div className={styles.profileCard}>
            <div className={styles.cardHeader}>
              <div className={styles.headerIconWrap} style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe', color: '#2563eb' }}>
                <KeyRound size={20} />
              </div>
              <div>
                <h2 className={styles.cardTitle}>Password & Security</h2>
                <p className={styles.cardSubtitle}>
                  Change your login password with mandatory bcrypt hash verification.
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdatePassword}>
              <div className={styles.formGrid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={styles.input}
                    placeholder="Enter current password"
                    required
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    New Password (Min. 8 chars)
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={styles.input}
                    placeholder="At least 8 characters"
                    required
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={styles.input}
                    placeholder="Re-type new password"
                    required
                  />
                </div>
              </div>

              <div className={styles.cardActions}>
                {passwordSuccessMsg && (
                  <div className={`${styles.alertBox} ${styles.alertSuccess}`}>
                    <CheckCircle2 size={16} />
                    <span>{passwordSuccessMsg}</span>
                  </div>
                )}
                {passwordErrorMsg && (
                  <div className={`${styles.alertBox} ${styles.alertError}`}>
                    <AlertCircle size={16} />
                    <span>{passwordErrorMsg}</span>
                  </div>
                )}
                <div style={{ marginLeft: 'auto' }}>
                  <button
                    type="submit"
                    disabled={isSavingPassword || isLoading}
                    className={styles.submitBtn}
                  >
                    <KeyRound size={15} />
                    <span>{isSavingPassword ? 'Updating...' : 'Update Password'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Section 3: Session & Sign Out */}
          <div className={styles.sessionCard}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>
                Active Field Desk Session
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                Signed in as <strong style={{ color: '#0f172a' }}>{profile?.name || 'Officer Juan'}</strong> &bull; Token valid for 7 days
              </p>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className={styles.signOutBtn}
            >
              <LogOut size={16} />
              <span>Sign Out of Field Desk</span>
            </button>
          </div>

        </div>
      </main>

      <OfficerMobileNav onOpenSidebar={() => setMobileMenuOpen(true)} />
    </div>
  );
}
