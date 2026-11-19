'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { generateCollectionScheduleDates } from '@/lib/ph-holidays';
import {
  OfficialSignatureBlock,
  OfficialSignatureRecord,
  getLatestOfficialSignature,
  formatPhDateTime
} from '@/components/common/OfficialSignatureBlock';

export interface PassbookSignatureItem {
  signature: string;
  authId?: string;
  timestamp?: string;
}

export interface PassbookData {
  borrowerName: string;
  cidNumber: string;
  loanReference?: string;
  mcidNumber?: string;
  spouseName?: string;
  permanentAddress: string;
  membershipDate?: string;
  dateIssued?: string;
  issuedByName?: string;
  issuedByDesignation?: string;
  specimenSignature?: string;
  specimenSignatures?: (string | PassbookSignatureItem)[];
  aoSignatures?: (string | PassbookSignatureItem)[];
  adminSignatures?: (string | PassbookSignatureItem)[];
  adminActionAt?: string;
  aoOfficialSignature?: OfficialSignatureRecord;
  adminOfficialSignature?: OfficialSignatureRecord;
  memberFacePhoto?: string;
  holdingIdPhoto?: string;
  
  // Loan & CBU fields
  dateReleased?: string;
  loanType?: string;
  loanAmount?: number;
  termMonths?: number;
  paymentMode?: 'Daily' | 'Weekly' | 'Semi-Monthly' | 'Monthly' | string;
  disbursementType?: string; // 'Cash' | 'Online Transfer' | 'Bank Check'
  cycle?: number | string;
  aoSignatureName?: string;
  managerSignatureName?: string;

  cbuInitialDeposit?: number;
  cbuBalance?: number;

  // Loan Payment Record rows (Image 1)
  paymentRecords?: {
    installmentNo?: number;
    paymentSchedule: string;
    status: 'Paid' | 'Pending' | 'Overdue' | 'Settled' | 'Fully Paid';
    datePaid?: string;
    principalAmount: number;
    interest?: number;
    payment?: number;
    loanBalance?: number;
    aoSignature?: string;
    aoSignatureImage?: string;
  }[];

  // Cash Build Up Record rows (Image 3)
  cbuRecords?: {
    paymentSchedule: string;
    datePaid?: string;
    cbuIn: number;
    cbuOut: number;
    cbuBalance: number;
    aoSignature?: string;
    aoSignatureImage?: string;
  }[];

  // Staff history rows
  staffRecords?: {
    name: string;
    position: string;
    dateStarted: string;
    dateEnd: string;
    signatureText: string;
    checkByManager: string;
  }[];
}

interface PassbookBookletProps {
  data: PassbookData;
  activeView?: 'all' | 'inside' | 'ledger' | 'payments';
}

export const PassbookBooklet: React.FC<PassbookBookletProps> = ({ data }) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const loanRef = data.loanReference || 'TC-LN-A-00001';

  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(loanRef, {
      width: 160,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then((url) => {
        if (isMounted) setQrCodeUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate QR code for loan ref:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [loanRef]);

  const staffRows = data.staffRecords && data.staffRecords.length > 0 ? data.staffRecords : [
    {
      name: data.issuedByName || 'OFFICER JUAN DE LA CRUZ',
      position: 'ACCOUNT OFFICER (AO-001)',
      dateStarted: data.dateIssued || new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
      dateEnd: 'PRESENT',
      signatureText: 'J. De La Cruz',
      checkByManager: 'M. Santos (BM)'
    }
  ];

  const loanAmount = data.loanAmount || 20000;
  const cbuInitial = data.cbuInitialDeposit || Math.max(500, loanAmount * 0.05);
  const releaseDate = data.dateReleased || data.dateIssued || new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  const dateIssued = data.dateIssued || new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  const membershipDate = data.membershipDate || data.dateIssued || new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });

  // Generate full term schedule for Loan Payment Record if not completely provided
  const termMonths = data.termMonths || 3;
  const mode = (data.paymentMode || 'Weekly').toLowerCase();
  let totalInstallments = 12; // default weekly for 3 months
  let intervalDays = 7;
  if (mode.includes('daily')) {
    totalInstallments = termMonths * 26;
    intervalDays = 1;
  } else if (mode.includes('semi')) {
    totalInstallments = termMonths * 2;
    intervalDays = 15;
  } else if (mode.includes('monthly')) {
    totalInstallments = termMonths;
    intervalDays = 30;
  } else {
    totalInstallments = Math.round(termMonths * 4.33) || 12;
    intervalDays = 7;
  }

  // Pre-calculate full term payments schedule using official PH holiday & collection calendar
  const monthlyRate = 0.06;
  const totalInterest = Math.round(loanAmount * monthlyRate * termMonths);
  const contractualBalance = loanAmount + totalInterest;
  const installmentPayment = Math.round(contractualBalance / totalInstallments);
  const interestPerInstallment = Math.round(totalInterest / totalInstallments);

  // Compute realistic base approval / disbursement date
  const parsedReleaseDate = data.dateReleased ? new Date(data.dateReleased) : new Date();
  const validReleaseDate = isNaN(parsedReleaseDate.getTime()) ? new Date() : parsedReleaseDate;
  const computedHolidaySchedule = generateCollectionScheduleDates(
    validReleaseDate,
    termMonths,
    data.paymentMode || 'Weekly',
    totalInstallments
  );

  const fullPaymentSchedule = (data.paymentRecords && data.paymentRecords.length >= totalInstallments)
    ? data.paymentRecords
    : Array.from({ length: totalInstallments }).map((_, i) => {
        const holidayEntry = computedHolidaySchedule[i];
        const schedStr = holidayEntry
          ? holidayEntry.dateStr
          : new Date(validReleaseDate.getTime() + (i + 1) * intervalDays * 86400000).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
        
        // Match existing passed records if available for this index
        if (data.paymentRecords && data.paymentRecords[i]) {
          const rec = data.paymentRecords[i];
          return {
            ...rec,
            installmentNo: rec.installmentNo ?? (i + 1),
            paymentSchedule: rec.paymentSchedule || schedStr,
            principalAmount: rec.principalAmount ?? loanAmount,
            interest: rec.interest !== undefined ? rec.interest : interestPerInstallment,
          };
        }

        return {
          installmentNo: i + 1,
          paymentSchedule: schedStr,
          status: 'Pending' as const,
          principalAmount: loanAmount,
          interest: interestPerInstallment,
          aoSignature: undefined as string | undefined,
          aoSignatureImage: undefined as string | undefined,
        };
      });

  // Resolve authoritative official signatures deterministically
  const officialAoSig: OfficialSignatureRecord = data.aoOfficialSignature || getLatestOfficialSignature(
    data.aoSignatures,
    data.issuedByName || 'OFFICER JUAN DE LA CRUZ',
    data.issuedByDesignation || 'Account Officer (AO-001)'
  ) || {
    signerName: data.issuedByName || 'OFFICER JUAN DE LA CRUZ',
    roleTitle: data.issuedByDesignation || 'Account Officer (AO-001)'
  };

  const officialAdminSig: OfficialSignatureRecord = data.adminOfficialSignature || getLatestOfficialSignature(
    data.adminSignatures,
    'Branch General Manager / Credit Approver',
    'Branch General Manager',
    data.adminActionAt
  ) || {
    signerName: 'Branch General Manager / Credit Approver',
    roleTitle: 'Branch General Manager'
  };

  // Calculate CBU balance & records: Paid one time during loan release (5% lifetime, min ₱500)
  const cbuSchedule = (data.cbuRecords && data.cbuRecords.length > 0)
    ? data.cbuRecords
    : [
        {
          paymentSchedule: `Release Date: ${releaseDate}`,
          datePaid: releaseDate,
          cbuIn: cbuInitial,
          cbuOut: 0,
          cbuBalance: cbuInitial,
          aoSignature: officialAoSig.authId || (officialAoSig.signature ? 'AO-VERIFIED' : undefined),
          aoSignatureImage: officialAoSig.signature
        }
      ];

  const fontModernHeading: React.CSSProperties = {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    letterSpacing: '-0.02em',
    fontWeight: 800,
  };

  return (
    <div className="passbook-booklet-container official-unified-passbook" style={{
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#0f172a',
      backgroundColor: '#ffffff',
      width: '100%',
      maxWidth: '1080px',
      margin: '0 auto',
      boxSizing: 'border-box',
      padding: '24px 28px',
      borderRadius: '16px',
      boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.08)',
      border: '1px solid #e2e8f0'
    }}>

      {/* =========================================================================
          EXECUTIVE UNIFIED HEADER - TRIBUTE CREDIT COOPERATIVE
         ========================================================================= */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '2.5px solid #0f172a',
        paddingBottom: '16px',
        marginBottom: '24px',
        gap: '24px'
      }}>
        {/* Left: Brand Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <img
            src="/tribute-credit-logo.png"
            alt="Tribute Credit Cooperative"
            style={{ height: '66px', width: 'auto', objectFit: 'contain' }}
          />
          <div style={{ borderLeft: '1.5px solid #cbd5e1', paddingLeft: '18px' }}>
            <div style={{
              fontSize: '13pt',
              fontWeight: '900',
              color: '#0f172a',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              lineHeight: '1.15'
            }}>
              TRIBUTE CREDIT COOPERATIVE
            </div>
            <div style={{
              fontSize: '8pt',
              fontWeight: '800',
              color: '#047857',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginTop: '3px'
            }}>
              OFFICIAL MEMBER PASSBOOK & COMPREHENSIVE CREDIT LEDGER
            </div>
            <div style={{
              fontSize: '7.5pt',
              color: '#64748b',
              fontWeight: '500',
              marginTop: '3px'
            }}>
              CDA Reg. No. NCR-COOP-88219 &bull; TIN: 412-987-654-000 &bull; Commonwealth Ave., Quezon City
            </div>
          </div>
        </div>

        {/* Right: Statement Classification, CID Badges & Loan Ref QR Code */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {qrCodeUrl && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: '#ffffff',
              padding: '3px',
              border: '1.5px solid #0f172a',
              borderRadius: '6px',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)'
            }} title={`Scan QR for Loan Reference: ${loanRef}`}>
              <img
                src={qrCodeUrl}
                alt={`QR Code ${loanRef}`}
                style={{ width: '56px', height: '56px', display: 'block', imageRendering: 'pixelated' }}
              />
              <span style={{ fontSize: '5pt', fontFamily: 'monospace', fontWeight: '800', color: '#0f172a', marginTop: '1px' }}>
                SCAN LOAN REF
              </span>
            </div>
          )}
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              padding: '5px 12px',
              borderRadius: '6px',
              fontSize: '8pt',
              fontWeight: '900',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
              boxSizing: 'border-box'
            }}>
              <span style={{ whiteSpace: 'nowrap' }}>OFFICIAL PASSBOOK LEDGER</span>
              <span style={{ color: '#38bdf8' }}>&bull;</span>
              <span style={{ color: '#38bdf8', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{data.loanReference || 'TC-LN-A-00001'}</span>
            </div>
            <div style={{ fontSize: '8.5pt', fontWeight: '800', color: '#047857', fontFamily: 'monospace', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
              MCID: <span style={{ color: '#0f172a' }}>{data.mcidNumber || data.cidNumber}</span>
            </div>
            <div style={{ fontSize: '7pt', color: '#64748b', fontWeight: '600', marginTop: '1px', whiteSpace: 'nowrap' }}>
              Issued on: <strong style={{ color: '#0f172a' }}>{dateIssued}</strong> &bull; Bank-Standard Microfinance Format
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 1: CLIENT INFORMATION & SERVICING STAFF RECORD (Centerfold 2-Col)
         ========================================================================= */}
      <div style={{
        marginBottom: '28px',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        padding: '20px'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.05fr 1.35fr',
          gap: '24px',
          alignItems: 'stretch'
        }}>
          {/* Left Column: Client Profile & Specimen Signatures */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderRight: '1px solid #cbd5e1',
            paddingRight: '22px'
          }}>
            <div>
              {/* Photos & Member Header */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '14px' }}>
                {/* 2X2 Biometric Face Photo */}
                <div style={{
                  width: '80px',
                  height: '84px',
                  borderRadius: '8px',
                  border: '1.5px solid #0f172a',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  position: 'relative'
                }}>
                  {data.memberFacePhoto ? (
                    <img
                      src={data.memberFacePhoto}
                      alt="Member 2x2"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', color: '#64748b' }}>
                      <span style={{ fontSize: '10pt', fontWeight: '900', display: 'block' }}>2X2</span>
                      <span style={{ fontSize: '6pt', letterSpacing: '0.05em', fontWeight: '700' }}>PHOTO</span>
                    </div>
                  )}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    color: '#ffffff',
                    fontSize: '4.5pt',
                    fontWeight: '800',
                    textAlign: 'center',
                    padding: '1px 0',
                    letterSpacing: '0.05em'
                  }}>
                    BIOMETRIC
                  </div>
                </div>

                {/* Photo Holding ID (if present) */}
                {data.holdingIdPhoto && (
                  <div style={{
                    width: '80px',
                    height: '84px',
                    borderRadius: '8px',
                    border: '1.5px solid #0284c7',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    position: 'relative'
                  }}>
                    <img
                      src={data.holdingIdPhoto}
                      alt="Holding ID"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      backgroundColor: 'rgba(2, 132, 199, 0.9)',
                      color: '#ffffff',
                      fontSize: '4.5pt',
                      fontWeight: '800',
                      textAlign: 'center',
                      padding: '1px 0',
                      letterSpacing: '0.05em'
                    }}>
                      HOLDING ID
                    </div>
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '6.5pt', textTransform: 'uppercase', color: '#64748b', fontWeight: '800', letterSpacing: '0.08em' }}>
                    OFFICIAL MEMBER-BORROWER
                  </div>
                  <div style={{
                    ...fontModernHeading,
                    fontSize: '11pt',
                    color: '#0f172a',
                    margin: '1px 0 2px 0',
                    textTransform: 'uppercase',
                    lineHeight: '1.2',
                    wordBreak: 'break-word'
                  }}>
                    {data.borrowerName}
                  </div>
                  <div style={{ fontSize: '7.5pt', color: '#047857', fontWeight: '700' }}>
                    Cooperative ID: <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{data.cidNumber}</strong>
                  </div>
                </div>
              </div>

              {/* Profile Fields Table */}
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '8pt',
                marginTop: '6px'
              }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '6px 0', color: '#64748b', fontWeight: '700', width: '130px' }}>Name of Husband/Spouse:</td>
                    <td style={{ padding: '6px 0', color: '#0f172a', fontWeight: '600' }}>{data.spouseName || 'N/A'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '6px 0', color: '#64748b', fontWeight: '700', verticalAlign: 'top' }}>Permanent Address:</td>
                    <td style={{ padding: '6px 0', color: '#0f172a', fontWeight: '600', lineHeight: '1.3' }}>{data.permanentAddress}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '6px 0', color: '#64748b', fontWeight: '700' }}>Date of Membership:</td>
                    <td style={{ padding: '6px 0', color: '#0f172a', fontWeight: '600' }}>{membershipDate}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '6px 0', color: '#64748b', fontWeight: '700' }}>Date Issued:</td>
                    <td style={{ padding: '6px 0', color: '#0f172a', fontWeight: '600' }}>{dateIssued}</td>
                  </tr>
                </tbody>
              </table>

              {/* Issuance Sign-off / Two Compact Verified Authorization Cards: AO Verification and Admin Approval */}
              <div style={{
                marginTop: '14px',
                borderTop: '1px solid #cbd5e1',
                paddingTop: '8px'
              }}>
                <div style={{ fontSize: '6.5pt', color: '#64748b', textTransform: 'uppercase', fontWeight: '800', marginBottom: '6px' }}>
                  ISSUANCE & VERIFIED AUTHORIZATION:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <OfficialSignatureBlock
                    signature={officialAoSig.signature}
                    authId={officialAoSig.authId}
                    timestamp={officialAoSig.timestamp || (officialAoSig.signature ? dateIssued : undefined)}
                    signerName={officialAoSig.signerName || data.issuedByName || 'Certified Account Officer'}
                    roleTitle="AO Verification"
                    variant="card"
                  />
                  <OfficialSignatureBlock
                    signature={officialAdminSig.signature}
                    authId={officialAdminSig.authId}
                    timestamp={officialAdminSig.timestamp || (data.adminActionAt ? formatPhDateTime(data.adminActionAt) : undefined)}
                    signerName={officialAdminSig.signerName || 'Branch Approver'}
                    roleTitle="Admin Approval"
                    variant="card"
                  />
                </div>
              </div>
            </div>

            {/* Specimen Signatures */}
            <div style={{ marginTop: '16px' }}>
              <div style={{
                fontSize: '7pt',
                fontWeight: '800',
                textTransform: 'uppercase',
                color: '#0f172a',
                letterSpacing: '0.06em',
                marginBottom: '6px'
              }}>
                MEMBER&apos;S SPECIMEN SIGNATURES
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[1, 2, 3].map((num) => {
                  const item = data.specimenSignatures && data.specimenSignatures[num - 1];
                  const sigUrl = typeof item === 'string' ? item : item?.signature || (num === 1 ? data.specimenSignature : undefined);
                  const authCode = typeof item === 'object' ? item?.authId : undefined;
                  const timeStr = typeof item === 'object' ? item?.timestamp : undefined;

                  return (
                    <div key={num} style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      minHeight: '52px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      padding: '4px 6px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '6pt', fontWeight: '800', color: '#94a3b8' }}>
                        <span>#{num}</span>
                        {authCode && (
                          <span style={{ color: '#0284c7', fontFamily: 'monospace', fontSize: '5.5pt' }} title={`Auth ID: ${authCode} (${timeStr || ''})`}>
                            {authCode.length > 14 ? authCode.slice(-10) : authCode}
                          </span>
                        )}
                      </div>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '28px' }}>
                        {sigUrl ? (
                          <img
                            src={sigUrl}
                            alt={`Specimen ${num}`}
                            style={{ maxHeight: '28px', maxWidth: '92%', objectFit: 'contain' }}
                          />
                        ) : (
                          <span style={{ fontSize: '6.5pt', color: '#cbd5e1', fontStyle: 'italic' }}>Signature #{num}</span>
                        )}
                      </div>
                      {timeStr && (
                        <div style={{ fontSize: '5pt', color: '#64748b', textAlign: 'center', marginTop: '1px' }}>
                          {timeStr}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Staff Information Sheet */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{
              backgroundColor: '#0f172a',
              color: '#ffffff',
              padding: '8px 12px',
              borderRadius: '8px 8px 0 0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ ...fontModernHeading, fontSize: '8.5pt', letterSpacing: '0.04em' }}>
                STAFF INFORMATION SHEET
              </span>
              <span style={{ fontSize: '6.5pt', color: '#cbd5e1', fontWeight: '600' }}>
                SERVICING FIELD OFFICERS & MANAGEMENT
              </span>
            </div>

            <div style={{ flex: 1, border: '1px solid #0f172a', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '7pt',
                textAlign: 'left'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #0f172a', color: '#0f172a' }}>
                    <th style={{ padding: '6px 8px', fontWeight: '800', borderRight: '1px solid #cbd5e1', width: '23%' }}>NAME OF STAFF</th>
                    <th style={{ padding: '6px 8px', fontWeight: '800', borderRight: '1px solid #cbd5e1', width: '18%' }}>POSITION</th>
                    <th style={{ padding: '6px 6px', fontWeight: '800', borderRight: '1px solid #cbd5e1', width: '13%', textAlign: 'center' }}>DATE STARTED</th>
                    <th style={{ padding: '6px 6px', fontWeight: '800', borderRight: '1px solid #cbd5e1', width: '13%', textAlign: 'center' }}>DATE END</th>
                    <th style={{ padding: '6px 8px', fontWeight: '800', borderRight: '1px solid #cbd5e1', width: '17%', textAlign: 'center' }}>STAFF SIGNATURE</th>
                    <th style={{ padding: '6px 8px', fontWeight: '800', width: '16%', textAlign: 'center' }}>CHECK BY : Manager</th>
                  </tr>
                </thead>
                <tbody>
                  {staffRows.map((row, idx) => {
                    const aoSigItem = data.aoSignatures && data.aoSignatures[0];
                    const aoSigImg = typeof aoSigItem === 'string' ? aoSigItem : aoSigItem?.signature;
                    const aoAuthId = typeof aoSigItem === 'object' ? aoSigItem?.authId : undefined;

                    return (
                      <tr key={idx} style={{
                        borderBottom: '1px solid #cbd5e1',
                        height: '32px',
                        backgroundColor: '#ffffff'
                      }}>
                        <td style={{ padding: '4px 8px', fontWeight: '700', color: '#0f172a', borderRight: '1px solid #cbd5e1' }}>
                          {row.name}
                        </td>
                        <td style={{ padding: '4px 8px', color: '#334155', borderRight: '1px solid #cbd5e1' }}>
                          {row.position}
                        </td>
                        <td style={{ padding: '4px 6px', textAlign: 'center', color: '#334155', borderRight: '1px solid #cbd5e1' }}>
                          {row.dateStarted}
                        </td>
                        <td style={{ padding: '4px 6px', textAlign: 'center', color: '#334155', borderRight: '1px solid #cbd5e1' }}>
                          {row.dateEnd}
                        </td>
                        <td style={{ padding: '4px 8px', textAlign: 'center', color: '#0f172a', fontWeight: '700', borderRight: '1px solid #cbd5e1' }}>
                          {aoSigImg ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                              <img src={aoSigImg} alt="Staff Sig" style={{ maxHeight: '24px', maxWidth: '90%', objectFit: 'contain' }} />
                              {aoAuthId && (
                                <span style={{ fontSize: '5pt', fontFamily: 'monospace', color: '#0284c7' }}>
                                  {aoAuthId.length > 14 ? aoAuthId.slice(-10) : aoAuthId}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontStyle: 'italic' }}>{row.signatureText}</span>
                          )}
                        </td>
                        <td style={{ padding: '4px 8px', textAlign: 'center', fontStyle: 'italic', color: '#0f172a', fontWeight: '700' }}>
                          {row.checkByManager}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: LOAN INFORMATION RECORD (EXACT SPEC FORMAT - IMAGE 2)
         ========================================================================= */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <h3 style={{
            fontSize: '11pt',
            fontWeight: '900',
            color: '#0f172a',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            Loan Information Record
          </h3>
          <span style={{ fontSize: '7.5pt', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
            Facility Approval & Disbursement Summary
          </span>
        </div>

        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '1.5px solid #000000',
          fontSize: '8pt',
          textAlign: 'center',
          backgroundColor: '#ffffff'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid #000000' }}>
              <th style={{ padding: '8px 4px', borderRight: '1px solid #000000', fontWeight: '800', width: '9%' }}>Loan Ref<br/>QR Code</th>
              <th style={{ padding: '8px 6px', borderRight: '1px solid #000000', fontWeight: '800', width: '12%' }}>Date<br/>Released</th>
              <th style={{ padding: '8px 6px', borderRight: '1px solid #000000', fontWeight: '800', width: '12%' }}>Loan<br/>Type</th>
              <th style={{ padding: '8px 6px', borderRight: '1px solid #000000', fontWeight: '800', width: '14%' }}>Loan<br/>Amount</th>
              <th style={{ padding: '8px 6px', borderRight: '1px solid #000000', fontWeight: '800', width: '13%' }}>Disbursement<br/>Type</th>
              <th style={{ padding: '8px 6px', borderRight: '1px solid #000000', fontWeight: '800', width: '7%' }}>Cycle</th>
              <th style={{ padding: '8px 6px', borderRight: '1px solid #000000', fontWeight: '800', width: '17%' }}>AO Signature</th>
              <th style={{ padding: '8px 6px', fontWeight: '800', width: '16%' }}>Manager<br/>Signature</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #000000', height: '42px', backgroundColor: '#ffffff' }}>
              <td style={{ padding: '4px 2px', borderRight: '1px solid #000000', verticalAlign: 'middle', textAlign: 'center' }}>
                {qrCodeUrl ? (
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                    <img
                      src={qrCodeUrl}
                      alt={loanRef}
                      style={{ width: '38px', height: '38px', display: 'block', imageRendering: 'pixelated' }}
                    />
                    <span style={{ fontSize: '4.5pt', fontFamily: 'monospace', fontWeight: '700', color: '#0f172a', marginTop: '1px' }}>
                      {loanRef}
                    </span>
                  </div>
                ) : (
                  <span style={{ fontSize: '6pt', fontFamily: 'monospace' }}>{loanRef}</span>
                )}
              </td>
              <td style={{ padding: '6px 4px', borderRight: '1px solid #000000' }}>{releaseDate}</td>
              <td style={{ padding: '6px 4px', borderRight: '1px solid #000000', fontWeight: '600' }}>{data.loanType || 'Regular'}</td>
              <td style={{ padding: '6px 4px', borderRight: '1px solid #000000', fontWeight: '900', color: '#0f172a' }}>
                ₱ {loanAmount.toLocaleString('en-PH')}
              </td>
              <td style={{ padding: '6px 4px', borderRight: '1px solid #000000' }}>
                {data.disbursementType || 'Cash'}
              </td>
              <td style={{ padding: '6px 4px', borderRight: '1px solid #000000', fontWeight: '700' }}>
                {data.cycle ? `${data.cycle}${data.cycle === 1 ? 'st' : data.cycle === 2 ? 'nd' : data.cycle === 3 ? 'rd' : 'th'}` : '1st'}
              </td>
              <td style={{ padding: '4px 4px', borderRight: '1px solid #000000', verticalAlign: 'middle' }}>
                <OfficialSignatureBlock
                  signature={officialAoSig.signature}
                  authId={officialAoSig.authId}
                  timestamp={officialAoSig.timestamp || (officialAoSig.signature ? releaseDate : undefined)}
                  signerName={officialAoSig.signerName || data.issuedByName || 'Account Officer'}
                  roleTitle="Account Officer"
                  variant="table"
                />
              </td>
              <td style={{ padding: '4px 4px', verticalAlign: 'middle' }}>
                <OfficialSignatureBlock
                  signature={officialAdminSig.signature}
                  authId={officialAdminSig.authId}
                  timestamp={officialAdminSig.timestamp || (data.adminActionAt ? formatPhDateTime(data.adminActionAt) : undefined)}
                  signerName={officialAdminSig.signerName || 'Branch Manager'}
                  roleTitle="Branch Approver"
                  variant="table"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* =========================================================================
          SECTION 3: CASH BUILD UP RECORD (EXACT SPEC FORMAT - IMAGE 3)
         ========================================================================= */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <h3 style={{
            fontSize: '11pt',
            fontWeight: '900',
            color: '#0f172a',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            Cash Build Up Record
          </h3>
          <span style={{ fontSize: '7.5pt', color: '#047857', fontWeight: '800', textTransform: 'uppercase' }}>
            5% Lifetime Capital Deposit &bull; Minimum ₱500 Floor &bull; Paid Upon Loan Release
          </span>
        </div>

        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '1.5px solid #000000',
          fontSize: '8pt',
          textAlign: 'center',
          backgroundColor: '#ffffff'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #000000' }}>
              <th rowSpan={2} style={{ padding: '6px', borderRight: '1px solid #000000', fontWeight: '800', width: '18%' }}>
                Payment<br/>Schedule
              </th>
              <th rowSpan={2} style={{ padding: '6px', borderRight: '1px solid #000000', fontWeight: '800', width: '16%' }}>
                Date Paid
              </th>
              <th colSpan={2} style={{ padding: '4px', borderRight: '1px solid #000000', borderBottom: '1px solid #000000', fontWeight: '800' }}>
                C.B.U
              </th>
              <th rowSpan={2} style={{ padding: '6px', borderRight: '1px solid #000000', fontWeight: '800', width: '16%' }}>
                C.B.U. Balance
              </th>
              <th rowSpan={2} style={{ padding: '6px', fontWeight: '800', width: '26%' }}>
                AO Signature<br/><span style={{ fontSize: '6pt', fontWeight: '600', color: '#64748b' }}>Every Visit Field Verification</span>
              </th>
            </tr>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid #000000' }}>
              <th style={{ padding: '4px', borderRight: '1px solid #000000', fontWeight: '800', width: '12%' }}>IN</th>
              <th style={{ padding: '4px', borderRight: '1px solid #000000', fontWeight: '800', width: '12%' }}>OUT</th>
            </tr>
          </thead>
          <tbody>
            {cbuSchedule.map((cbuRow, cIdx) => (
              <tr key={cIdx} style={{ borderBottom: '1px solid #000000', height: '32px' }}>
                <td style={{ padding: '6px 4px', borderRight: '1px solid #000000', fontWeight: '600' }}>{cbuRow.paymentSchedule}</td>
                <td style={{ padding: '6px 4px', borderRight: '1px solid #000000' }}>{cbuRow.datePaid || ''}</td>
                <td style={{ padding: '6px 4px', borderRight: '1px solid #000000', fontWeight: '800', color: '#047857' }}>
                  ₱ {cbuRow.cbuIn > 0 ? cbuRow.cbuIn.toLocaleString('en-PH') : '0'}
                </td>
                <td style={{ padding: '6px 4px', borderRight: '1px solid #000000' }}>
                  {cbuRow.cbuOut > 0 ? `₱ ${cbuRow.cbuOut.toLocaleString('en-PH')}` : '0'}
                </td>
                <td style={{ padding: '6px 4px', borderRight: '1px solid #000000', fontWeight: '800', color: '#0f172a' }}>
                  ₱ {cbuRow.cbuBalance.toLocaleString('en-PH')}
                </td>
                <td style={{ padding: '4px 6px', textAlign: 'center', verticalAlign: 'middle' }}>
                  {cbuRow.aoSignatureImage ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <img
                        src={cbuRow.aoSignatureImage}
                        alt="AO Signature"
                        style={{ maxHeight: '24px', maxWidth: '85px', objectFit: 'contain' }}
                      />
                      <span style={{ fontFamily: 'monospace', fontSize: '6pt', color: '#0284c7', fontWeight: '700' }}>
                        {cbuRow.aoSignature}
                      </span>
                    </div>
                  ) : cbuRow.aoSignature ? (
                    <span style={{ fontFamily: 'monospace', fontSize: '7.5pt' }}>{cbuRow.aoSignature}</span>
                  ) : (
                    <div style={{
                      height: '24px',
                      borderBottom: '1px dashed #94a3b8',
                      margin: '2px 8px',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center'
                    }}>
                      <span style={{ fontSize: '5.5pt', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        AO Visit Sign
                      </span>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* =========================================================================
          SECTION 4: LOAN PAYMENT RECORD - DIGITAL REPAYMENT AMORTIZATION & STATUS
          (Official Passbook Record with Status and Digital AO Verification)
         ========================================================================= */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <div>
            <h3 style={{
              fontSize: '11pt',
              fontWeight: '900',
              color: '#0f172a',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              Loan Payment Record
            </h3>
            <span style={{ fontSize: '7.5pt', color: '#64748b', fontWeight: '600' }}>
              Microfinance Facility Digital Repayment & Ledger Record &bull; Full {termMonths}-Month ({totalInstallments} Installments)
            </span>
          </div>

          <div style={{
            display: 'flex',
            gap: '14px',
            fontSize: '7.5pt',
            fontWeight: '700'
          }}>
            <span style={{ color: '#0f172a' }}>
              Contractual Total: <strong>₱ {contractualBalance.toLocaleString('en-PH')}</strong>
            </span>
            <span style={{ color: '#0284c7' }}>
              Per Installment: <strong>₱ {installmentPayment.toLocaleString('en-PH')}</strong>
            </span>
          </div>
        </div>

        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '1.5px solid #000000',
          fontSize: '7.5pt',
          textAlign: 'center',
          backgroundColor: '#ffffff'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid #000000' }}>
              <th style={{ padding: '8px 4px', borderRight: '1px solid #000000', fontWeight: '800', width: '15%' }}>Payment<br/>Schedule</th>
              <th style={{ padding: '8px 4px', borderRight: '1px solid #000000', fontWeight: '800', width: '10%' }}>Status</th>
              <th style={{ padding: '8px 4px', borderRight: '1px solid #000000', fontWeight: '800', width: '12%' }}>Date<br/>Paid</th>
              <th style={{ padding: '8px 4px', borderRight: '1px solid #000000', fontWeight: '800', width: '13%' }}>Principal<br/>Amount</th>
              <th style={{ padding: '8px 4px', borderRight: '1px solid #000000', fontWeight: '800', width: '11%' }}>Interest</th>
              <th style={{ padding: '8px 4px', borderRight: '1px solid #000000', fontWeight: '800', width: '12%' }}>Payment</th>
              <th style={{ padding: '8px 4px', borderRight: '1px solid #000000', fontWeight: '800', width: '13%' }}>Loan<br/>Balance</th>
              <th style={{ padding: '8px 4px', fontWeight: '800', width: '14%' }}>AO Verification<br/><span style={{ fontSize: '6pt', fontWeight: '600', color: '#64748b' }}>Digital Sig / Auth ID</span></th>
            </tr>
          </thead>
          <tbody>
            {fullPaymentSchedule.map((pRow, pIdx) => {
              // Check if this installment or any prior installment has fully cleared the loan
              const priorReachedZero = fullPaymentSchedule.slice(0, pIdx).some(prev => prev.status === 'Paid' && (prev.loanBalance === 0 || (prev.payment && prev.payment >= contractualBalance)));
              const isSettled = pRow.status === 'Settled' || pRow.status === 'Fully Paid' || (priorReachedZero && pRow.status !== 'Paid');

              const isPaid = pRow.status === 'Paid';
              const isOverdue = pRow.status === 'Overdue';
              const statusBg = isSettled ? '#f1f5f9' : isPaid ? '#dcfce7' : isOverdue ? '#fee2e2' : '#f1f5f9';
              const statusColor = isSettled ? '#64748b' : isPaid ? '#15803d' : isOverdue ? '#b91c1c' : '#475569';
              const displayStatus = isSettled ? 'SETTLED' : (pRow.status || 'Upcoming');

              return (
                <tr key={pIdx} style={{
                  borderBottom: '1px solid #000000',
                  height: '32px',
                  backgroundColor: isSettled ? '#f8fafc' : (pIdx % 2 === 0 ? '#ffffff' : '#fafafa')
                }}>
                  <td style={{ padding: '5px 4px', borderRight: '1px solid #000000', fontWeight: '600', color: isSettled ? '#64748b' : 'inherit' }}>
                    {pRow.paymentSchedule}
                  </td>
                  <td style={{ padding: '5px 4px', borderRight: '1px solid #000000' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '6.5pt',
                      fontWeight: '800',
                      textTransform: 'uppercase',
                      backgroundColor: statusBg,
                      color: statusColor
                    }}>
                      {displayStatus}
                    </span>
                  </td>
                  <td style={{ padding: '5px 4px', borderRight: '1px solid #000000', color: isSettled ? '#94a3b8' : 'inherit' }}>
                    {isSettled && !pRow.datePaid ? '—' : (pRow.datePaid || '—')}
                  </td>
                  <td style={{ padding: '5px 4px', borderRight: '1px solid #000000', fontWeight: '700', color: isSettled ? '#94a3b8' : 'inherit' }}>
                    {pRow.principalAmount ? `₱ ${pRow.principalAmount.toLocaleString('en-PH')}` : ''}
                  </td>
                  <td style={{ padding: '5px 4px', borderRight: '1px solid #000000', color: isSettled ? '#94a3b8' : 'inherit' }}>
                    {pRow.interest ? `₱ ${pRow.interest.toLocaleString('en-PH')}` : ''}
                  </td>
                  <td style={{ padding: '5px 4px', borderRight: '1px solid #000000', fontWeight: '700', color: isSettled ? '#94a3b8' : (pRow.payment ? '#0f172a' : 'inherit') }}>
                    {isSettled && !pRow.payment ? '—' : (pRow.payment ? `₱ ${pRow.payment.toLocaleString('en-PH')}` : '—')}
                  </td>
                  <td style={{ padding: '5px 4px', borderRight: '1px solid #000000', fontWeight: '700', color: isSettled ? '#64748b' : 'inherit' }}>
                    {isSettled ? '₱ 0.00' : (pRow.loanBalance !== undefined ? `₱ ${pRow.loanBalance.toLocaleString('en-PH')}` : '')}
                  </td>
                  <td style={{ padding: '4px 6px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {pRow.aoSignatureImage ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <img
                          src={pRow.aoSignatureImage}
                          alt="AO Signature"
                          style={{ maxHeight: '22px', maxWidth: '80px', objectFit: 'contain' }}
                        />
                        <span style={{ fontFamily: 'monospace', fontSize: '5.5pt', color: '#0284c7', fontWeight: '700' }}>
                          {pRow.aoSignature}
                        </span>
                      </div>
                    ) : pRow.aoSignature ? (
                      <span style={{ fontFamily: 'monospace', fontSize: '6.5pt', color: '#0284c7', fontWeight: '700' }}>{pRow.aoSignature}</span>
                    ) : isSettled ? (
                      <span style={{ fontSize: '6.5pt', color: '#16a34a', fontWeight: '800' }}>✓ Loan Settled</span>
                    ) : (
                      <span style={{ fontSize: '6pt', color: '#94a3b8', fontStyle: 'italic' }}>Pending Collection</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Official Sign-off Certification Footer */}
      <div style={{
        marginTop: '28px',
        paddingTop: '16px',
        borderTop: '2px dashed #cbd5e1',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        fontSize: '7.5pt'
      }}>
        <div style={{ maxWidth: '420px', color: '#64748b' }}>
          <p style={{ margin: '0 0 3px 0', fontWeight: '700', color: '#0f172a' }}>
            OFFICIAL MEMBER DECLARATION & COOPERATIVE UNDERTAKING
          </p>
          <p style={{ margin: 0, lineHeight: '1.3' }}>
            This passbook serves as an official and legally binding microfinance repayment and capital build-up ledger. All recorded transactions are synchronized with the Tribute Credit Cooperative Field Automation Server.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '32px' }}>
          <OfficialSignatureBlock
            signature={officialAoSig.signature}
            authId={officialAoSig.authId}
            timestamp={officialAoSig.timestamp || (officialAoSig.signature ? dateIssued : undefined)}
            signerName={officialAoSig.signerName || data.issuedByName || 'Certified Field Officer'}
            roleTitle="Certified Field Officer"
            variant="footer"
          />

          <OfficialSignatureBlock
            signature={officialAdminSig.signature}
            authId={officialAdminSig.authId}
            timestamp={officialAdminSig.timestamp || (data.adminActionAt ? formatPhDateTime(data.adminActionAt) : undefined)}
            signerName={officialAdminSig.signerName || 'Branch Approver'}
            roleTitle="Branch General Manager / Credit Approver"
            variant="footer"
          />
        </div>
      </div>

    </div>
  );
};

{/* =========================================================================
    STANDALONE PRINTABLE / VIEWABLE COMPONENT: LOAN PAYMENT LEDGER
    (Given to the Borrower to keep; NO status column; physical AO signature boxes)
   ========================================================================= */}
export const LoanPaymentLedger: React.FC<PassbookBookletProps> = ({ data }) => {
  const [ledgerQrUrl, setLedgerQrUrl] = useState<string>('');
  const loanRef = data.loanReference || 'TC-LN-A-00001';

  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(loanRef, {
      width: 160,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then((url) => {
        if (isMounted) setLedgerQrUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate QR for ledger:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [loanRef]);

  const loanAmount = data.loanAmount || 20000;
  const cbuInitial = data.cbuInitialDeposit || Math.max(500, loanAmount * 0.05);
  const dateIssued = data.dateIssued || new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  const termMonths = data.termMonths || 3;
  const mode = (data.paymentMode || 'Weekly').toLowerCase();

  let totalInstallments = 12;
  let intervalDays = 7;
  if (mode.includes('daily')) {
    totalInstallments = termMonths * 26;
    intervalDays = 1;
  } else if (mode.includes('semi')) {
    totalInstallments = termMonths * 2;
    intervalDays = 15;
  } else if (mode.includes('monthly')) {
    totalInstallments = termMonths;
    intervalDays = 30;
  } else {
    totalInstallments = Math.round(termMonths * 4.33) || 12;
    intervalDays = 7;
  }

  const monthlyRate = 0.06;
  const totalInterest = Math.round(loanAmount * monthlyRate * termMonths);
  const contractualBalance = loanAmount + totalInterest;
  const installmentPayment = Math.round(contractualBalance / totalInstallments);
  const interestPerInstallment = Math.round(totalInterest / totalInstallments);

  const parsedReleaseDate = data.dateReleased ? new Date(data.dateReleased) : new Date();
  const validReleaseDate = isNaN(parsedReleaseDate.getTime()) ? new Date() : parsedReleaseDate;
  const computedHolidaySchedule = generateCollectionScheduleDates(
    validReleaseDate,
    termMonths,
    data.paymentMode || 'Weekly',
    totalInstallments
  );

  const fullPaymentSchedule = (data.paymentRecords && data.paymentRecords.length >= totalInstallments)
    ? data.paymentRecords
    : Array.from({ length: totalInstallments }).map((_, i) => {
        const holidayEntry = computedHolidaySchedule[i];
        const schedStr = holidayEntry
          ? holidayEntry.dateStr
          : new Date(validReleaseDate.getTime() + (i + 1) * intervalDays * 86400000).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });

        return {
          installmentNo: i + 1,
          paymentSchedule: schedStr,
          status: 'Pending' as const,
          datePaid: '',
          principalAmount: loanAmount,
          interest: interestPerInstallment,
          payment: installmentPayment,
          loanBalance: Math.max(0, contractualBalance - installmentPayment * (i + 1)),
          aoSignature: undefined as string | undefined,
          aoSignatureImage: undefined as string | undefined
        };
      });

  return (
    <div className="loan-payment-ledger-container official-unified-ledger" style={{
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#0f172a',
      backgroundColor: '#ffffff',
      width: '100%',
      maxWidth: '1080px',
      margin: '0 auto',
      boxSizing: 'border-box',
      padding: '24px 28px',
      borderRadius: '16px',
      boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.08)',
      border: '1.5px solid #0f172a'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '2.5px solid #0f172a',
        paddingBottom: '14px',
        marginBottom: '18px',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img
            src="/tribute-credit-logo.png"
            alt="Tribute Credit Cooperative"
            style={{ height: '62px', width: 'auto', objectFit: 'contain' }}
          />
          <div style={{ borderLeft: '1.5px solid #cbd5e1', paddingLeft: '16px' }}>
            <div style={{ fontSize: '13pt', fontWeight: '900', color: '#0f172a', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              TRIBUTE CREDIT COOPERATIVE
            </div>
            <div style={{ fontSize: '8.5pt', fontWeight: '800', color: '#0284c7', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '2px' }}>
              OFFICIAL LOAN PAYMENT LEDGER &bull; BORROWER FIELD COPY
            </div>
            <div style={{ fontSize: '7pt', color: '#64748b', marginTop: '2px' }}>
              Field Officer Wet-Signature Collection Ledger &bull; Given to Borrower for Home/Store Safe Keeping
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {ledgerQrUrl && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: '#ffffff',
              padding: '3px',
              border: '1.5px solid #0284c7',
              borderRadius: '6px'
            }} title={`Scan QR for Loan Reference: ${loanRef}`}>
              <img
                src={ledgerQrUrl}
                alt={`QR Code ${loanRef}`}
                style={{ width: '48px', height: '48px', display: 'block', imageRendering: 'pixelated' }}
              />
              <span style={{ fontSize: '5pt', fontFamily: 'monospace', fontWeight: '800', color: '#0284c7', marginTop: '1px' }}>
                SCAN LOAN REF
              </span>
            </div>
          )}
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              padding: '4px 10px',
              borderRadius: '5px',
              fontSize: '8pt',
              fontWeight: '900',
              letterSpacing: '0.05em',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
              boxSizing: 'border-box'
            }}>
              <span style={{ whiteSpace: 'nowrap' }}>LOAN REF:</span>
              <span style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{data.loanReference || 'TC-LN-A-00001'}</span>
            </div>
            <div style={{ fontSize: '8.5pt', fontWeight: '800', color: '#0f172a', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
              MCID: <span style={{ color: '#047857' }}>{data.mcidNumber || data.cidNumber}</span>
            </div>
            <div style={{ fontSize: '7pt', color: '#64748b', whiteSpace: 'nowrap' }}>
              Issued: <strong>{dateIssued}</strong> &bull; Mode: <strong>{data.paymentMode || 'Weekly'}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Borrower & Facility Key Data Band */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px',
        backgroundColor: '#f8fafc',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        padding: '10px 14px',
        marginBottom: '16px',
        fontSize: '8pt'
      }}>
        <div>
          <span style={{ color: '#64748b', fontSize: '6.5pt', textTransform: 'uppercase', fontWeight: '800', display: 'block' }}>Borrower Full Name</span>
          <strong style={{ color: '#0f172a', fontSize: '9pt', textTransform: 'uppercase' }}>{data.borrowerName}</strong>
        </div>
        <div>
          <span style={{ color: '#64748b', fontSize: '6.5pt', textTransform: 'uppercase', fontWeight: '800', display: 'block' }}>Permanent Address</span>
          <span style={{ color: '#334155', fontWeight: '600' }}>{data.permanentAddress}</span>
        </div>
        <div>
          <span style={{ color: '#64748b', fontSize: '6.5pt', textTransform: 'uppercase', fontWeight: '800', display: 'block' }}>Principal & Term</span>
          <strong style={{ color: '#0f172a' }}>₱ {loanAmount.toLocaleString('en-PH')}</strong> ({termMonths} mos &bull; {totalInstallments} inst)
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ color: '#64748b', fontSize: '6.5pt', textTransform: 'uppercase', fontWeight: '800', display: 'block' }}>Installment Due</span>
          <strong style={{ color: '#15803d', fontSize: '10pt' }}>₱ {installmentPayment.toLocaleString('en-PH')}</strong>
          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block' }}>Total: ₱ {contractualBalance.toLocaleString('en-PH')}</span>
        </div>
      </div>

      {/* 7-Column Field Visit Table (NO STATUS COLUMN - AO wet-signs each visit) */}
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        border: '1.5px solid #000000',
        fontSize: '8pt',
        textAlign: 'center',
        backgroundColor: '#ffffff'
      }}>
        <thead>
          <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #000000' }}>
            <th style={{ padding: '8px 4px', borderRight: '1px solid #000000', fontWeight: '800', width: '15%' }}>Payment<br/>Schedule</th>
            <th style={{ padding: '8px 4px', borderRight: '1px solid #000000', fontWeight: '800', width: '13%' }}>Date<br/>Paid</th>
            <th style={{ padding: '8px 4px', borderRight: '1px solid #000000', fontWeight: '800', width: '14%' }}>Principal<br/>Amount</th>
            <th style={{ padding: '8px 4px', borderRight: '1px solid #000000', fontWeight: '800', width: '12%' }}>Interest</th>
            <th style={{ padding: '8px 4px', borderRight: '1px solid #000000', fontWeight: '800', width: '13%' }}>Payment</th>
            <th style={{ padding: '8px 4px', borderRight: '1px solid #000000', fontWeight: '800', width: '14%' }}>Loan<br/>Balance</th>
            <th style={{ padding: '8px 4px', fontWeight: '800', width: '19%' }}>AO Signature<br/><span style={{ fontSize: '6pt', fontWeight: '600', color: '#64748b' }}>Every Visit Field Verification</span></th>
          </tr>
        </thead>
        <tbody>
          {fullPaymentSchedule.map((pRow, pIdx) => {
            const priorReachedZero = fullPaymentSchedule.slice(0, pIdx).some(prev => prev.status === 'Paid' && (prev.loanBalance === 0 || (prev.payment && prev.payment >= contractualBalance)));
            const isSettled = pRow.status === 'Settled' || pRow.status === 'Fully Paid' || (priorReachedZero && pRow.status !== 'Paid');

            return (
              <tr key={pIdx} style={{
                borderBottom: '1px solid #000000',
                height: '34px',
                backgroundColor: isSettled ? '#f8fafc' : (pIdx % 2 === 0 ? '#ffffff' : '#fafafa')
              }}>
                <td style={{ padding: '6px 4px', borderRight: '1px solid #000000', fontWeight: '600', color: isSettled ? '#64748b' : 'inherit' }}>
                  {pRow.paymentSchedule}
                </td>
                <td style={{ padding: '6px 4px', borderRight: '1px solid #000000', color: isSettled ? '#94a3b8' : 'inherit' }}>
                  {isSettled && !pRow.datePaid ? '—' : (pRow.datePaid || '')}
                </td>
                <td style={{ padding: '6px 4px', borderRight: '1px solid #000000', fontWeight: '700', color: isSettled ? '#94a3b8' : 'inherit' }}>
                  {pRow.principalAmount ? `₱ ${pRow.principalAmount.toLocaleString('en-PH')}` : ''}
                </td>
                <td style={{ padding: '6px 4px', borderRight: '1px solid #000000', color: isSettled ? '#94a3b8' : 'inherit' }}>
                  {pRow.interest ? `₱ ${pRow.interest.toLocaleString('en-PH')}` : ''}
                </td>
                <td style={{ padding: '6px 4px', borderRight: '1px solid #000000', fontWeight: '700', color: isSettled ? '#94a3b8' : '#0f172a' }}>
                  {isSettled && !pRow.payment ? '—' : (pRow.payment ? `₱ ${pRow.payment.toLocaleString('en-PH')}` : '')}
                </td>
                <td style={{ padding: '6px 4px', borderRight: '1px solid #000000', fontWeight: '700', color: isSettled ? '#64748b' : 'inherit' }}>
                  {isSettled ? '₱ 0.00' : (pRow.loanBalance ? `₱ ${pRow.loanBalance.toLocaleString('en-PH')}` : '')}
                </td>
                <td style={{ padding: '4px 6px', textAlign: 'center', verticalAlign: 'middle' }}>
                  {pRow.aoSignatureImage ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <img
                        src={pRow.aoSignatureImage}
                        alt="AO Signature"
                        style={{ maxHeight: '22px', maxWidth: '80px', objectFit: 'contain' }}
                      />
                      <span style={{ fontFamily: 'monospace', fontSize: '6pt', color: '#0284c7', fontWeight: '700' }}>
                        {pRow.aoSignature}
                      </span>
                    </div>
                  ) : pRow.aoSignature ? (
                    <span style={{ fontFamily: 'monospace', fontSize: '7pt' }}>{pRow.aoSignature}</span>
                  ) : isSettled ? (
                    <span style={{ fontSize: '7pt', color: '#16a34a', fontWeight: '800' }}>✓ Full Settlement</span>
                  ) : (
                    <div style={{
                      height: '24px',
                      borderBottom: '1px dashed #94a3b8',
                      margin: '2px 8px',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center'
                    }}>
                      <span style={{ fontSize: '5.5pt', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        AO Visit Sign
                      </span>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Footer Notes */}
      <div style={{
        marginTop: '20px',
        paddingTop: '12px',
        borderTop: '1.5px dashed #cbd5e1',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '7pt',
        color: '#64748b'
      }}>
        <span>Notice: Keep this official ledger in a dry and safe place. Present this to your Account Officer during each visit. Payment is deemed acknowledged upon AO wet signature.</span>
        <span style={{ fontWeight: '800', color: '#0f172a' }}>TRIBUTE CREDIT FIELD OPERATIONS</span>
      </div>
    </div>
  );
};
