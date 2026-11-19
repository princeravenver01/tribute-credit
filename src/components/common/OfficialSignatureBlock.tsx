import React from 'react';

export interface OfficialSignatureRecord {
  signature?: string;
  authId?: string;
  timestamp?: string;
  signerName?: string;
  roleTitle?: string;
}

export function formatPhDateTime(dateOrStr?: string | Date): string {
  if (!dateOrStr) return '';
  const d = typeof dateOrStr === 'string' ? new Date(dateOrStr) : dateOrStr;
  if (isNaN(d.getTime())) return String(dateOrStr);
  return d.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

export function getLatestOfficialSignature(
  sigs?: (string | { signature?: string; authId?: string; timestamp?: string })[],
  fallbackName?: string,
  fallbackRole?: string,
  explicitTime?: string
): OfficialSignatureRecord | undefined {
  if (!sigs || !Array.isArray(sigs) || sigs.length === 0) {
    if (fallbackName || explicitTime) {
      return {
        signerName: fallbackName,
        roleTitle: fallbackRole,
        timestamp: explicitTime ? formatPhDateTime(explicitTime) : undefined
      };
    }
    return undefined;
  }

  // Iterate backwards to find latest non-empty signature
  for (let i = sigs.length - 1; i >= 0; i--) {
    const s = sigs[i];
    if (typeof s === 'string' && s.trim()) {
      return {
        signature: s,
        signerName: fallbackName,
        roleTitle: fallbackRole,
        timestamp: explicitTime ? formatPhDateTime(explicitTime) : undefined
      };
    } else if (typeof s === 'object' && s && s.signature && s.signature.trim()) {
      return {
        signature: s.signature,
        authId: s.authId,
        timestamp: formatPhDateTime(explicitTime || s.timestamp),
        signerName: fallbackName,
        roleTitle: fallbackRole
      };
    }
  }

  // If objects with authId/timestamp exist but no image
  for (let i = sigs.length - 1; i >= 0; i--) {
    const s = sigs[i];
    if (typeof s === 'object' && s && (s.authId || s.timestamp)) {
      return {
        authId: s.authId,
        timestamp: formatPhDateTime(explicitTime || s.timestamp),
        signerName: fallbackName,
        roleTitle: fallbackRole
      };
    }
  }

  return {
    signerName: fallbackName,
    roleTitle: fallbackRole,
    timestamp: explicitTime ? formatPhDateTime(explicitTime) : undefined
  };
}

interface OfficialSignatureBlockProps {
  signature?: string;
  authId?: string;
  timestamp?: string;
  signerName?: string;
  roleTitle?: string;
  variant?: 'table' | 'card' | 'footer' | 'coop-approval' | 'collector';
  accentColor?: string;
}

export const OfficialSignatureBlock: React.FC<OfficialSignatureBlockProps> = ({
  signature,
  authId,
  timestamp,
  signerName,
  roleTitle,
  variant = 'card',
  accentColor = '#0f172a'
}) => {
  const isPending = !signature;
  const hasAuth = Boolean(authId && authId.trim());

  if (variant === 'table') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2px 4px',
        textAlign: 'center',
        minHeight: '44px'
      }}>
        {signature ? (
          <img
            src={signature}
            alt={roleTitle ? `${roleTitle} Signature` : 'Official Signature'}
            style={{ maxHeight: '26px', maxWidth: '100px', objectFit: 'contain', display: 'block' }}
          />
        ) : (
          <span style={{ fontSize: '6.5pt', color: '#94a3b8', fontStyle: 'italic', fontWeight: '600' }}>
            Pending Signature
          </span>
        )}
        <div style={{
          fontSize: '6pt',
          fontFamily: hasAuth ? 'monospace' : 'inherit',
          fontWeight: '700',
          color: hasAuth ? '#0284c7' : '#94a3b8',
          marginTop: '1px',
          lineHeight: '1.1'
        }}>
          {hasAuth ? authId : 'Auth ID unavailable'}
        </div>
        {timestamp ? (
          <div style={{ fontSize: '5.5pt', color: '#64748b', marginTop: '1px' }}>
            {timestamp}
          </div>
        ) : null}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div style={{
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        backgroundColor: '#ffffff',
        padding: '6px 8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '74px',
        textAlign: 'center'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '6.5pt', fontWeight: '800' }}>
          <span style={{ color: '#475569', textTransform: 'uppercase' }}>
            {roleTitle || 'Official Verification'}
          </span>
          <span style={{
            fontFamily: hasAuth ? 'monospace' : 'inherit',
            color: hasAuth ? '#0284c7' : '#94a3b8',
            fontSize: '6pt',
            fontWeight: '700'
          }}>
            {hasAuth ? authId : 'Auth ID unavailable'}
          </span>
        </div>

        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '34px',
          margin: '2px 0'
        }}>
          {signature ? (
            <img
              src={signature}
              alt={roleTitle || 'Official Signature'}
              style={{ maxHeight: '32px', maxWidth: '95%', objectFit: 'contain' }}
            />
          ) : (
            <span style={{ fontSize: '7pt', color: '#94a3b8', fontStyle: 'italic' }}>
              Pending signature
            </span>
          )}
        </div>

        <div style={{
          borderTop: '1px dashed #e2e8f0',
          paddingTop: '2px',
          fontSize: '5.5pt',
          color: '#64748b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{signerName || ''}</span>
          <span>{timestamp || 'Pending timestamp'}</span>
        </div>
      </div>
    );
  }

  if (variant === 'footer') {
    return (
      <div style={{ textAlign: 'center', minWidth: '170px' }}>
        <div style={{
          borderBottom: '1.5px solid #0f172a',
          minHeight: '34px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: '2px'
        }}>
          {signature ? (
            <img
              src={signature}
              alt={roleTitle || 'Authorized Signature'}
              style={{ maxHeight: '28px', maxWidth: '140px', objectFit: 'contain' }}
            />
          ) : (
            <span style={{ fontSize: '7.5pt', color: '#94a3b8', fontStyle: 'italic' }}>
              Pending signature
            </span>
          )}
          <span style={{
            fontSize: '6.5pt',
            fontFamily: hasAuth ? 'monospace' : 'inherit',
            fontWeight: '700',
            color: hasAuth ? '#0284c7' : '#94a3b8',
            marginTop: '1px'
          }}>
            {hasAuth ? authId : 'Auth ID unavailable'}
          </span>
        </div>
        <span style={{
          fontSize: '6.5pt',
          fontWeight: '800',
          textTransform: 'uppercase',
          color: '#475569',
          display: 'block',
          marginTop: '3px'
        }}>
          {roleTitle || 'Authorized Official'}
        </span>
        {timestamp ? (
          <span style={{ fontSize: '5.5pt', color: '#64748b', display: 'block', marginTop: '1px' }}>
            {timestamp}
          </span>
        ) : null}
      </div>
    );
  }

  if (variant === 'coop-approval') {
    return (
      <div style={{
        border: '1.5px solid #cbd5e1',
        borderRadius: '6px',
        padding: '6px 8px',
        textAlign: 'center',
        backgroundColor: '#ffffff',
        minHeight: '74px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '6.5pt', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>
            COOP APPROVAL
          </span>
          <span style={{
            fontFamily: hasAuth ? 'monospace' : 'inherit',
            fontSize: '5.5pt',
            fontWeight: '700',
            color: hasAuth ? '#0284c7' : '#94a3b8'
          }}>
            {hasAuth ? authId : 'Auth ID unavailable'}
          </span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '32px' }}>
          {signature ? (
            <img
              src={signature}
              alt="Coop Approval Signature"
              style={{ maxHeight: '30px', maxWidth: '95%', objectFit: 'contain' }}
            />
          ) : (
            <span style={{ fontSize: '7pt', color: '#94a3b8', fontStyle: 'italic' }}>
              Pending Admin Approval
            </span>
          )}
        </div>
        <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '2px', marginTop: '2px' }}>
          <span style={{ fontSize: '6pt', color: '#64748b', display: 'block' }}>
            {signerName || 'Authorized Credit Approver'}
          </span>
          {timestamp ? (
            <span style={{ fontSize: '5.5pt', color: '#64748b', display: 'block' }}>
              {timestamp}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  // Default: collector / AO sign-off
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        borderBottom: '1.5px solid #0f172a',
        minHeight: '34px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: '2px'
      }}>
        {signature ? (
          <img
            src={signature}
            alt="Account Officer Signature"
            style={{ maxHeight: '28px', maxWidth: '140px', objectFit: 'contain' }}
          />
        ) : (
          <span style={{ fontSize: '7.5pt', color: '#94a3b8', fontStyle: 'italic' }}>
            Pending signature
          </span>
        )}
        <span style={{
          fontSize: '6.5pt',
          fontFamily: hasAuth ? 'monospace' : 'inherit',
          fontWeight: '700',
          color: hasAuth ? '#0284c7' : '#94a3b8',
          marginTop: '1px'
        }}>
          {hasAuth ? authId : 'Auth ID unavailable'}
        </span>
      </div>
      <p style={{ fontSize: '7.5pt', fontWeight: '800', marginTop: '3px', textTransform: 'uppercase' }}>
        {roleTitle || 'Account Officer / Certified Collector'}
      </p>
      {timestamp ? (
        <span style={{ fontSize: '5.5pt', color: '#64748b', display: 'block' }}>
          {timestamp}
        </span>
      ) : null}
    </div>
  );
};
