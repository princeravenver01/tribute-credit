'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Menu } from 'lucide-react';
import { SyncStatusBar } from './SyncStatusBar';
import styles from './AppHeader.module.css';

interface AppHeaderProps {
  panelType: 'admin' | 'officer';
  userName?: string;
  badgeLabel?: string;
  pageTitle?: string;
  pageSubtitle?: string;
  onOpenMobileSidebar?: () => void;
  actions?: React.ReactNode;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  panelType,
  userName = panelType === 'admin' ? 'Administrator' : 'Officer Juan',
  badgeLabel = panelType === 'admin' ? 'Super Admin Portal' : 'Field Underwriting Desk',
  pageTitle,
  pageSubtitle,
  onOpenMobileSidebar,
  actions
}) => {
  const isSuperAdmin = panelType === 'admin';

  return (
    <header className={`no-print ${styles.headerBase} ${isSuperAdmin ? styles.headerAdmin : styles.headerAO}`}>
      {/* Primary Formal Navigation Row */}
      <div className={styles.topRow}>
        {/* Left: Brand Identity & Portal Context */}
        <div className={styles.brandGroup}>
          {onOpenMobileSidebar && (
            <button
              type="button"
              onClick={onOpenMobileSidebar}
              className={isSuperAdmin ? styles.menuToggleBtnAdmin : styles.menuToggleBtnAO}
              aria-label="Open navigation menu"
            >
              <Menu size={18} />
            </button>
          )}

          <Link
            href={isSuperAdmin ? '/admin/dashboard' : '/officer/dashboard'}
            className={styles.brandLink}
          >
            {/* Logo Container */}
            <div className={styles.logoBox}>
              <img
                src="/tribute-credit-logo.png"
                alt="Tribute Credit Cooperative"
                className={styles.logoImg}
              />
            </div>

            {/* Typography Hierarchy */}
            <div className={styles.brandTextCol}>
              <div className={styles.brandTitleWrap}>
                <span className={styles.coopName}>
                  Tribute Credit Cooperative
                </span>

                {/* Subdued Role Badge */}
                <div className={isSuperAdmin ? styles.roleBadgeAdmin : styles.roleBadgeAO}>
                  <span className={isSuperAdmin ? styles.roleDotAdmin : styles.roleDotAO} />
                  {badgeLabel}
                </div>
              </div>

              <div className={styles.brandMetaRow}>
                <span className={styles.regCode}>
                  CDA REG: NCR-COOP-88219
                </span>
                <span style={{ color: '#CBD5E1' }}>&bull;</span>
                <span className={isSuperAdmin ? styles.verifiedTagAdmin : styles.verifiedTagAO}>
                  <ShieldCheck size={11} /> Financial Services &amp; Credit Operations
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* Right: Operational Controls & Compact Profile */}
        <div className={styles.rightGroup}>
          <SyncStatusBar />

          {actions && (
            <div className={styles.actionsSlot}>
              {actions}
            </div>
          )}

          {/* Clean Vertical Divider */}
          <div className={styles.divider} />

          {/* Compact Profile Cluster */}
          <div className={styles.profileCluster}>
            <div className={isSuperAdmin ? styles.userAvatarAdmin : styles.userAvatarAO}>
              {userName.charAt(0)}
            </div>

            <div style={{ lineHeight: 1.2 }}>
              <div className={styles.userName}>
                {userName}
              </div>
              <div className={isSuperAdmin ? styles.userRoleAdmin : styles.userRoleAO}>
                {isSuperAdmin ? 'Dual-Control Approver' : 'Certified Account Officer'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Slim, Quiet Page Context Strip */}
      {(pageTitle || pageSubtitle) && (
        <div className={isSuperAdmin ? styles.subStripAdmin : styles.subStripAO}>
          <div>
            {pageTitle && (
              <h1 className={isSuperAdmin ? styles.pageTitleAdmin : styles.pageTitleAO}>
                {pageTitle}
              </h1>
            )}
            {pageSubtitle && (
              <p className={styles.pageSubtitle}>
                {pageSubtitle}
              </p>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
