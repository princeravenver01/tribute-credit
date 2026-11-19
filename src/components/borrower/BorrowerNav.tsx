'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  CreditCard, 
  Coins, 
  Settings, 
  LogOut, 
  ChevronDown 
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore
    }
    router.push('/borrower/login');
  };

  // Close menu on click outside or escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  // Close menu on route changes
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

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
          {/* Legible Brand Lockup with Official Logo & Restrained Descriptor */}
          <Link href="/borrower/dashboard" className={styles.brandGroup} title="Tribute Credit Member Portal">
            <div className={styles.logoWrap}>
              <Image
                src="/tribute-credit-logo.png"
                alt="Tribute Credit Cooperative"
                width={124}
                height={38}
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
            <div className={styles.brandDescriptor}>
              <span className={styles.portalLabel}>Member Portal</span>
              {coopSettings?.branchName && (
                <span className={styles.branchLabel}>{coopSettings.branchName}</span>
              )}
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

          {/* Consolidated Profile Menu Trigger */}
          <div className={styles.userSection} ref={menuRef}>
            <button
              type="button"
              className={styles.profileTrigger}
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              aria-label="Member Account Menu"
            >
              <div className={styles.avatar}>
                {initials}
              </div>
              <ChevronDown
                size={14}
                className={`${styles.triggerArrow} ${menuOpen ? styles.triggerArrowOpen : ''}`}
              />
            </button>

            {/* Accessible Popover Dropdown */}
            {menuOpen && (
              <div className={styles.profileMenu} role="menu" aria-label="Member Options">
                <div className={styles.menuHeader}>
                  <p className={styles.menuUserName}>{user?.name || 'Valued Member'}</p>
                  <span className={styles.menuMcidBadge}>MCID: {user?.memberNo || 'TCID-MEM'}</span>
                </div>

                <div className={styles.menuBody}>
                  <Link
                    href="/borrower/settings"
                    className={styles.menuItemLink}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Settings size={15} />
                    <span>Account Settings</span>
                  </Link>

                  <div className={styles.menuDivider} />

                  <button
                    type="button"
                    onClick={handleLogout}
                    className={`${styles.menuItemBtn} ${styles.menuItemLogout}`}
                    role="menuitem"
                  >
                    <LogOut size={15} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
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
