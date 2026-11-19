'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  CreditCard, 
  Coins, 
  Settings, 
  LogOut 
} from 'lucide-react';
import styles from './BorrowerNav.module.css';

interface BorrowerNavProps {
  user?: {
    name?: string;
    email?: string;
    memberNo?: string;
  } | null;
  coopSettings?: {
    coopName?: string;
    branchName?: string;
  } | null;
}

export const BORROWER_NAV_ITEMS = [
  { label: 'Dashboard', href: '/borrower/dashboard', icon: LayoutDashboard },
  { label: 'Loans', href: '/borrower/loans', icon: CreditCard },
  { label: 'Savings', href: '/borrower/savings', icon: Coins },
  { label: 'Account Settings', href: '/borrower/settings', icon: Settings },
] as const;

export function BorrowerNav({ user, coopSettings }: BorrowerNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore
    }
    router.push('/borrower/login');
  };

  // Initials for avatar
  const initials = (user?.name || 'M')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'M';

  return (
    <>
      <header className={styles.navShell}>
        <div className={styles.navContainer}>
          {/* Official Logo & Cooperative Title */}
          <Link href="/borrower/dashboard" className={styles.brandGroup} title="Tribute Credit Member Portal">
            <div className={styles.logoWrap}>
              <Image
                src="/tribute-credit-logo.png"
                alt="Tribute Credit Cooperative"
                width={36}
                height={36}
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
            <div className={styles.brandText}>
              <div className={styles.brandTitleRow}>
                <span className={styles.brandTitle}>
                  {coopSettings?.coopName || 'Tribute Credit Cooperative'}
                </span>
                <span className={styles.portalBadge}>Member Portal</span>
              </div>
              <span className={styles.brandSubtitle}>
                {coopSettings?.branchName ? `${coopSettings.branchName} • ` : ''}Authorized Access
              </span>
            </div>
          </Link>

          {/* Desktop 4 navigation links */}
          <nav className={styles.desktopNav} aria-label="Borrower Desktop Navigation">
            {BORROWER_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/borrower/dashboard' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Authenticated Borrower Profile, Settings & Sign Out */}
          <div className={styles.userSection}>
            <Link href="/borrower/settings" className={styles.userProfileLink} title="View Account Profile">
              <div className={styles.avatar}>
                {initials}
              </div>
              <div className={styles.userInfo}>
                <span className={styles.userName}>{user?.name || 'Valued Member'}</span>
                <span className={styles.userMeta}>MCID: {user?.memberNo || 'TCID-MEM'}</span>
              </div>
            </Link>

            <Link
              href="/borrower/settings"
              className={styles.settingsLinkBtn}
              title="Account Security & Settings"
            >
              <Settings size={16} />
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className={styles.logoutBtn}
              title="Sign Out of Portal"
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className={styles.mobileBottomNav} aria-label="Borrower Mobile Navigation">
        <div className={styles.mobileNavInner}>
          {BORROWER_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/borrower/dashboard' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.mobileNavItem} ${isActive ? styles.mobileNavItemActive : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
