'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { OfficerSidebar } from '@/components/officer/OfficerSidebar';
import { OfficerMobileNav } from '@/components/officer/OfficerMobileNav';
import { AppHeader } from '@/components/common/AppHeader';
import { 
  Users, 
  UserPlus, 
  Search, 
  X, 
  Eye, 
  FileCheck2, 
  ShieldCheck, 
  RefreshCw
} from 'lucide-react';
import type { CooperativeMember } from '@/lib/coop-member-store';
import styles from './members.module.css';

export default function OfficerMembersPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [members, setMembers] = useState<CooperativeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<CooperativeMember | null>(null);

  const fetchMembers = async (query = '') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/members${query ? `?search=${encodeURIComponent(query)}` : ''}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.members)) {
        setMembers(data.members);
      }
    } catch (e) {
      console.error('Failed to load members', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch('/api/members')
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.success && Array.isArray(data.members)) {
          setMembers(data.members);
        }
      })
      .catch((e) => {
        console.error('Failed to load members:', e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMembers(searchQuery);
  };

  const totalCapitalShare = members.reduce((sum, m) => sum + (m.capitalShare || 0), 0);
  const totalSavings = members.reduce((sum, m) => sum + (m.initialSavings || 0), 0);

  return (
    <div className={styles.pageContainer}>
      <OfficerSidebar isMobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />
      
      <div className={styles.mainContent}>
        <AppHeader 
          panelType="officer"
          pageTitle="Cooperative Membership Registry" 
          pageSubtitle="Tribute Credit Cooperative Member Directory & Share Capital Records"
          onOpenMobileSidebar={() => setMobileMenuOpen(true)}
        />

        <div className={styles.contentWrapper}>
          <div className={styles.headerRow}>
            <div className={styles.titleArea}>
              <h1>Registered Members</h1>
              <p>Authoritative cooperative membership records, initial fee tracking, and verified identity dossiers.</p>
            </div>
            <div className={styles.headerActions}>
              <button 
                type="button" 
                onClick={() => fetchMembers(searchQuery)} 
                className={styles.secondaryBtn}
                title="Refresh Member List"
              >
                <RefreshCw size={16} />
                <span>Refresh</span>
              </button>
              <Link href="/officer/members/new" className={styles.primaryBtn}>
                <UserPlus size={18} />
                <span>Register New Member</span>
              </Link>
            </div>
          </div>

          {/* Stats Bar */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Total Members</div>
              <div className={styles.statValue}>{members.length}</div>
              <div className={styles.statSubtext}>Verified Cooperative Members</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Total CBU / Capital Share</div>
              <div className={styles.statValue}>₱{totalCapitalShare.toLocaleString()}</div>
              <div className={styles.statSubtext}>₱2,000 equity share per member</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Total Opening Savings</div>
              <div className={styles.statValue}>₱{totalSavings.toLocaleString()}</div>
              <div className={styles.statSubtext}>₱500 initial savings deposit</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Registration Fees Collected</div>
              <div className={styles.statValue}>₱{(members.length * 500).toLocaleString()}</div>
              <div className={styles.statSubtext}>₱500 non-refundable entrance fee</div>
            </div>
          </div>

          {/* Search Filter */}
          <form onSubmit={handleSearch} className={styles.filterBar}>
            <div className={styles.searchBox}>
              <Search size={18} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search by member name, MCID (TCID-M-...), email, or city..."
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button type="submit" className={styles.primaryBtn}>
              Search
            </button>
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => { setSearchQuery(''); fetchMembers(''); }} 
                className={styles.secondaryBtn}
              >
                Clear
              </button>
            )}
          </form>

          {/* Table */}
          <div className={styles.tableContainer}>
            <div className={styles.tableWrapper}>
              <table className={styles.membersTable}>
                <thead>
                  <tr>
                    <th>Member Profile</th>
                    <th>Contact & Location</th>
                    <th>Identity Evidence</th>
                    <th>Opening Fees</th>
                    <th>Registration Date</th>
                    <th>Registrar</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className={styles.emptyState}>
                        Loading cooperative members...
                      </td>
                    </tr>
                  ) : members.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={styles.emptyState}>
                        <Users size={36} style={{ margin: '0 auto 0.75rem', color: '#94a3b8' }} />
                        <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>No cooperative members found</p>
                        <p style={{ margin: 0, fontSize: '0.85rem' }}>
                          {searchQuery ? 'Try adjusting your search criteria.' : 'Begin by registering your first cooperative member.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    members.map((member) => (
                      <tr key={member.memberNo}>
                        <td>
                          <div className={styles.memberCell}>
                            {member.photoUrl ? (
                              <img 
                                src={member.photoUrl} 
                                alt={member.fullName} 
                                className={styles.memberAvatar} 
                              />
                            ) : (
                              <div className={styles.memberInitials}>
                                {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                              </div>
                            )}
                            <div>
                              <div className={styles.memberName}>{member.fullName}</div>
                              <div className={styles.memberNo}>{member.memberNo}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.85rem' }}>{member.contactNumber}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{member.email}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{member.city}, {member.province}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span className={`${styles.badge} ${styles.badgeEvidence}`}>
                              <FileCheck2 size={12} /> E-Signature
                            </span>
                            <span className={`${styles.badge} ${styles.badgeEvidence}`}>
                              <ShieldCheck size={12} /> ID Selfie ({member.validIdType})
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#15803d' }}>
                            ₱{(member.totalPaid || 3000).toLocaleString()}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {member.paymentMethod.toUpperCase()} (Ref: {member.paymentReference})
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.85rem' }}>
                            {new Date(member.createdAt).toLocaleDateString()}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {new Date(member.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{member.registeredByName}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'capitalize' }}>
                            {member.registeredByRole?.replace('_', ' ')}
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => setSelectedMember(member)}
                            className={styles.actionBtn}
                          >
                            <Eye size={14} />
                            <span>Dossier</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <OfficerMobileNav onOpenSidebar={() => setMobileMenuOpen(true)} />

      {/* Member Details Modal */}
      {selectedMember && (
        <div className={styles.modalOverlay} onClick={() => setSelectedMember(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Cooperative Member Dossier</h2>
                <span className={styles.memberNo}>{selectedMember.memberNo}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedMember(null)}
                className={styles.closeBtn}
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Personal Information */}
              <div className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>Personal & Contact Details</div>
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <label>Full Legal Name</label>
                    <p>{selectedMember.fullName}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <label>Gender / Civil Status</label>
                    <p>{selectedMember.gender} • {selectedMember.civilStatus}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <label>Date of Birth</label>
                    <p>{selectedMember.dateOfBirth}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <label>Contact Number</label>
                    <p>{selectedMember.contactNumber}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <label>Email Address</label>
                    <p>{selectedMember.email}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <label>Occupation / Monthly Income</label>
                    <p>{selectedMember.occupation} (₱{selectedMember.monthlyIncome?.toLocaleString()})</p>
                  </div>
                  <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                    <label>Residential Address</label>
                    <p>{selectedMember.address}, Brgy. {selectedMember.barangay}, {selectedMember.city}, {selectedMember.province}</p>
                  </div>
                </div>
              </div>

              {/* Opening Financial Breakdown */}
              <div className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>Opening Capital & Fees Breakdown (Fixed ₱3,000)</div>
                <div className={styles.financialBreakdown}>
                  <div className={styles.financialRow}>
                    <span>1. Non-Refundable Membership Registration Fee:</span>
                    <strong>₱{(selectedMember.registrationFee || 500).toLocaleString()}.00</strong>
                  </div>
                  <div className={styles.financialRow}>
                    <span>2. Cooperative Capital Share (CBU Equity):</span>
                    <strong>₱{(selectedMember.capitalShare || 2000).toLocaleString()}.00</strong>
                  </div>
                  <div className={styles.financialRow}>
                    <span>3. Opening Savings Deposit Balance:</span>
                    <strong>₱{(selectedMember.initialSavings || 500).toLocaleString()}.00</strong>
                  </div>
                  <div className={styles.financialTotal}>
                    <span>Total Initial Paid:</span>
                    <span>₱{(selectedMember.totalPaid || 3000).toLocaleString()}.00</span>
                  </div>
                  <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
                    Payment Method: <strong style={{ color: '#0f172a' }}>{selectedMember.paymentMethod.toUpperCase()}</strong> | Reference: <strong style={{ color: '#0f172a' }}>{selectedMember.paymentReference}</strong>
                  </div>
                </div>
              </div>

              {/* 3 Mandatory Identity Evidence Items */}
              <div className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>Mandatory Identity Evidence (3 Required Items)</div>
                <div className={styles.evidenceGrid}>
                  {/* Evidence 1: Profile Photo */}
                  <div className={styles.evidenceCard}>
                    <div className={styles.evidenceCardTitle}>1. Member Profile Photo</div>
                    <img 
                      src={selectedMember.photoUrl} 
                      alt="Profile Photo" 
                      className={styles.evidenceImage} 
                    />
                    <div className={styles.evidenceMeta}>
                      Verified on: {new Date(selectedMember.photoTimestamp || selectedMember.createdAt).toLocaleString()}
                    </div>
                  </div>

                  {/* Evidence 2: ID Selfie */}
                  <div className={styles.evidenceCard}>
                    <div className={styles.evidenceCardTitle}>2. Selfie Holding Valid ID</div>
                    <img 
                      src={selectedMember.idSelfieUrl} 
                      alt="ID Selfie" 
                      className={styles.evidenceImage} 
                    />
                    <div className={styles.evidenceMeta}>
                      ID: {selectedMember.validIdType} - {selectedMember.validIdNumber}
                    </div>
                  </div>

                  {/* Evidence 3: E-Signature */}
                  <div className={styles.evidenceCard}>
                    <div className={styles.evidenceCardTitle}>3. Member Digital Signature</div>
                    <img 
                      src={selectedMember.signatureData} 
                      alt="Signature" 
                      className={styles.evidenceImage} 
                      style={{ backgroundColor: '#ffffff' }}
                    />
                    <div className={styles.evidenceMeta}>
                      Auth ID: <span style={{ fontFamily: 'monospace' }}>{selectedMember.signatureAuthId}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Audit Details */}
              <div className={styles.detailSection} style={{ marginBottom: 0 }}>
                <div className={styles.detailSectionTitle}>Registration Audit Trail</div>
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <label>Registered By</label>
                    <p>{selectedMember.registeredByName} ({selectedMember.registeredByRole})</p>
                  </div>
                  <div className={styles.detailItem}>
                    <label>Registered Timestamp</label>
                    <p>{new Date(selectedMember.createdAt).toLocaleString()}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <label>Status</label>
                    <p style={{ color: '#15803d' }}>Active Cooperative Member</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
