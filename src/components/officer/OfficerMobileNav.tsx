'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import styles from './OfficerChrome.module.css';
import { OFFICER_NAV_ITEMS } from './officer-nav-items';

interface OfficerMobileNavProps {
  onOpenSidebar: () => void;
}

export const OfficerMobileNav: React.FC<OfficerMobileNavProps> = ({ onOpenSidebar }) => {
  const pathname = usePathname();

  const items = OFFICER_NAV_ITEMS;

  return (
    <nav
      className={`officer-bottom-nav safe-area-bottom ${styles.bottomNav}`}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== '/officer/dashboard' && item.href !== '/officer/borrowers' && pathname.startsWith(item.href + '/'));
        const isPrimaryAction = item.href === '/officer/borrowers/new';

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.mobileNavItem} ${isPrimaryAction ? styles.mobileNavItemPrimary : ''} ${isActive ? styles.mobileNavItemActive : ''}`}
          >
            <Icon size={20} color={isPrimaryAction ? '#ffffff' : isActive ? '#15803d' : '#526b5c'} />
            <span className={`${styles.mobileNavLabel} ${isActive || isPrimaryAction ? styles.mobileNavLabelActive : ''}`}>{item.name}</span>
          </Link>
        );
      })}

      {/* Menu / Drawer Toggle */}
      <button
        type="button"
        onClick={onOpenSidebar}
        className={styles.mobileMenuBtn}
      >
        <Menu size={20} color="#526b5c" />
        <span className={styles.mobileNavLabel}>More</span>
      </button>
    </nav>
  );
};
