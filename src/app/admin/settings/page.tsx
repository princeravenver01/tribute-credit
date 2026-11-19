'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/common/Sidebar';
import { AppHeader } from '@/components/common/AppHeader';
import { 
  Settings, 
  Building2, 
  Sliders, 
  ShieldCheck, 
  Save, 
  CheckCircle, 
  KeyRound,
  BellRing
} from 'lucide-react';
import { getCoopSettings, saveCoopSettings, type CoopSettings, DEFAULT_COOP_SETTINGS } from '@/lib/settings-store';
import theme from '@/components/admin/AdminTheme.module.css';
import styles from './settings.module.css';

export default function AdminSettingsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settings, setSettings] = useState<CoopSettings>(DEFAULT_COOP_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSuccessMsg, setPwSuccessMsg] = useState<string | null>(null);
  const [pwErrorMsg, setPwErrorMsg] = useState<string | null>(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/settings');
        const data = await res.json();
        if (data.success && data.settings) {
          setSettings(data.settings);
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Failed to save settings');
        return;
      }
      setSettings(data.settings);
      setSuccessMsg('Operational and cooperative settings updated successfully.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSuccessMsg(null);
    setPwErrorMsg(null);
    setPwSubmitting(true);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_password',
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPwErrorMsg(data.error || 'Failed to change password');
        setPwSubmitting(false);
        return;
      }
      setPwSuccessMsg('Administrator password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwSuccessMsg(null), 4000);
    } catch (err: any) {
      setPwErrorMsg(err.message || 'An unexpected error occurred');
    } finally {
      setPwSubmitting(false);
    }
  };

  return (
    <div className={`${theme.adminThemeRoot} ${theme.adminPageShell}`}>
      <Sidebar
        role="admin"
        userName="Super Admin"
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onOpenMobile={() => setMobileMenuOpen(true)}
      />

      <main className={`officer-main-content ${theme.adminMainContent}`} style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', paddingBottom: '90px' }}>
        <AppHeader
          panelType="admin"
          userName="Dennis Yuan"
          badgeLabel="System Administration & Preferences"
          pageTitle="Cooperative Platform Settings"
          pageSubtitle="Manage institutional identity, official CDA credentials, system defaults, and security configurations."
          onOpenMobileSidebar={() => setMobileMenuOpen((prev) => !prev)}
        />

        <div className={styles.settingsWrap} style={{ marginTop: '20px' }}>
          {successMsg && <div className={styles.successBanner}>{successMsg}</div>}
          {errorMsg && <div className={styles.errorBanner}>{errorMsg}</div>}

          {/* SECTION 1: COOPERATIVE & BRANCH IDENTITY */}
          <form onSubmit={handleSaveSettings} className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <Building2 size={20} color="#B91C1C" />
              <div>
                <h3 className={styles.sectionTitle}>Cooperative Identity &amp; Statutory Registration</h3>
                <p className={styles.sectionSubtitle}>
                  Institutional details displayed across passbooks, promissory notes, and regulatory disclosures
                </p>
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Registered Cooperative Name</label>
                <input
                  type="text"
                  required
                  value={settings.coopName}
                  onChange={(e) => setSettings({ ...settings, coopName: e.target.value })}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>CDA Registration Number</label>
                <input
                  type="text"
                  required
                  value={settings.cdaRegistrationNo}
                  onChange={(e) => setSettings({ ...settings, cdaRegistrationNo: e.target.value })}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Branch Name</label>
                <input
                  type="text"
                  value={settings.branchName}
                  onChange={(e) => setSettings({ ...settings, branchName: e.target.value })}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Official Contact Phone</label>
                <input
                  type="text"
                  value={settings.contactNumber}
                  onChange={(e) => setSettings({ ...settings, contactNumber: e.target.value })}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                <label className={styles.formLabel}>Headquarters / Principal Office Address</label>
                <input
                  type="text"
                  value={settings.officeAddress}
                  onChange={(e) => setSettings({ ...settings, officeAddress: e.target.value })}
                  className={styles.formInput}
                />
              </div>
            </div>

            {/* SECTION 2: OPERATIONAL PREFERENCES */}
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #F1F5F9' }}>
              <div className={styles.sectionHeader}>
                <Sliders size={20} color="#B91C1C" />
                <div>
                  <h3 className={styles.sectionTitle}>Operational Preferences &amp; Numbering Defaults</h3>
                  <p className={styles.sectionSubtitle}>Prefix identifiers and default tenure settings for new loan applications</p>
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Loan Reference Prefix</label>
                  <input
                    type="text"
                    value={settings.loanIdPrefix}
                    onChange={(e) => setSettings({ ...settings, loanIdPrefix: e.target.value })}
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Member CID / MCID Prefix</label>
                  <input
                    type="text"
                    value={settings.mcidPrefix}
                    onChange={(e) => setSettings({ ...settings, mcidPrefix: e.target.value })}
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Default Loan Tenure (Months)</label>
                  <select
                    value={settings.defaultTermMonths}
                    onChange={(e) => setSettings({ ...settings, defaultTermMonths: Number(e.target.value) })}
                    className={styles.formInput}
                  >
                    <option value={2}>2 Months</option>
                    <option value={3}>3 Months</option>
                    <option value={4}>4 Months</option>
                    <option value={5}>5 Months</option>
                    <option value={6}>6 Months</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Default Repayment Frequency</label>
                  <select
                    value={settings.defaultRepaymentFrequency}
                    onChange={(e) => setSettings({ ...settings, defaultRepaymentFrequency: e.target.value as any })}
                    className={styles.formInput}
                  >
                    <option value="Weekly">Weekly Collection</option>
                    <option value="Monthly">Monthly Collection</option>
                    <option value="Daily">Daily Collection</option>
                    <option value="Semi-Monthly">Semi-Monthly Collection</option>
                  </select>
                </div>
              </div>
            </div>

            <button type="submit" className={styles.saveBtn}>
              <Save size={15} /> Save Operational Preferences
            </button>
          </form>

          {/* SECTION 3: ACCOUNT & SECURITY CREDENTIALS */}
          <form onSubmit={handlePasswordChange} className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <KeyRound size={20} color="#B91C1C" />
              <div>
                <h3 className={styles.sectionTitle}>Security Credentials &amp; Administrator Password</h3>
                <p className={styles.sectionSubtitle}>Safeguard executive access with authenticated password renewal</p>
              </div>
            </div>

            {pwSuccessMsg && <div className={styles.successBanner} style={{ marginBottom: '14px' }}>{pwSuccessMsg}</div>}
            {pwErrorMsg && <div className={styles.errorBanner} style={{ marginBottom: '14px' }}>{pwErrorMsg}</div>}

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>New Password (Min. 8 characters)</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={styles.formInput}
                />
              </div>
            </div>

            <button type="submit" disabled={pwSubmitting} className={styles.saveBtn}>
              <ShieldCheck size={15} /> {pwSubmitting ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
