'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/common/Sidebar';
import { AppHeader } from '@/components/common/AppHeader';
import { 
  FileEdit, 
  Save, 
  RotateCcw, 
  History, 
  CheckCircle, 
  ShieldCheck, 
  Info, 
  Eye, 
  Sparkles,
  Bold,
  Italic,
  Underline,
  List,
  Code2
} from 'lucide-react';
import { 
  getActiveContractTemplate, 
  saveContractTemplate, 
  getContractTemplateHistory, 
  ContractTemplate, 
  DEFAULT_CONTRACT_TEMPLATE,
  interpolateContractHtml
} from '@/lib/contract-template-store';
import { VisualTextEditor } from '@/components/common/VisualTextEditor';
import theme from '@/components/officer/OfficerTheme.module.css';
import styles from './editor.module.css';

export default function AdminContractEditorPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [template, setTemplate] = useState<ContractTemplate>(DEFAULT_CONTRACT_TEMPLATE);
  const [history, setHistory] = useState<ContractTemplate[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'history'>('editor');
  const [editorVersionInput, setEditorVersionInput] = useState('v1.1');
  const [previewVars, setPreviewVars] = useState({
    totalScheduledCollections: '₱ 11,800.00',
    installmentAmount: '₱ 907.69',
    repaymentFrequency: 'Weekly',
    termMonths: 3,
    principal: '₱ 10,000.00',
    borrowerName: 'Juan Dela Cruz',
    policyNo: 'LCAP-00129'
  });

  useEffect(() => {
    const loaded = getActiveContractTemplate();
    setTemplate(loaded);
    setHistory(getContractTemplateHistory());

    // Compute next suggested version
    if (loaded.version) {
      const match = loaded.version.match(/v?(\d+)\.(\d+)/);
      if (match) {
        const major = match[1];
        const minor = Number(match[2]) + 1;
        setEditorVersionInput(`v${major}.${minor}`);
      }
    }
  }, []);

  const handleSave = () => {
    const now = new Date();
    const updatedDateStr = now.toLocaleDateString('en-PH', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    }) + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newTemplate: ContractTemplate = {
      ...template,
      version: editorVersionInput || template.version,
      updatedAt: updatedDateStr,
      updatedBy: 'Admin Dennis Yuan (Super Admin)',
    };

    saveContractTemplate(newTemplate);
    setTemplate(newTemplate);
    setHistory(getContractTemplateHistory());
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);
  };

  const handleResetToDefault = () => {
    if (window.confirm('Reset all contract clauses and terms back to system default template?')) {
      setTemplate(DEFAULT_CONTRACT_TEMPLATE);
    }
  };

  const handleRestoreVersion = (h: ContractTemplate) => {
    if (window.confirm(`Restore contract terms to revision ${h.version} (Updated: ${h.updatedAt})?`)) {
      setTemplate(h);
      setActiveTab('editor');
    }
  };

  return (
    <div className={`${theme.themeRoot} ${theme.pageShell}`}>
      <Sidebar
        role="admin"
        userName="Super Admin"
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onOpenMobile={() => setMobileMenuOpen(true)}
      />

      <main className={`officer-main-content ${theme.mainContent}`} style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', paddingBottom: '90px' }}>
        <AppHeader
          panelType="admin"
          userName="Dennis Yuan"
          badgeLabel="Legal & Governance Console"
          pageTitle="Microfinance Contract & Legal Terms Editor"
          pageSubtitle="Manage master terms, promissory notes, penalty clauses & legal covenants. Changes apply only to future applicants."
          onOpenMobileSidebar={() => setMobileMenuOpen(prev => !prev)}
          actions={
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleSave}
                style={{
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontWeight: '800',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)'
                }}
              >
                <Save size={16} /> Publish New Version
              </button>
            </div>
          }
        />

        {saveSuccess && (
          <div style={{
            backgroundColor: '#dcfce7',
            border: '1.5px solid #86efac',
            color: '#15803d',
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px',
            fontWeight: '700'
          }}>
            <CheckCircle size={18} />
            <span>🎉 Contract Template successfully published ({template.version})! Newer applicants will automatically receive these updated terms. Existing executed contracts remain legally immutable.</span>
          </div>
        )}

        {/* Current Active Template Status Banner */}
        <div className={styles.statusBanner}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldCheck size={22} color="#86efac" />
              <h2 className={styles.statusBannerTitle}>
                Active Legal Master Template &bull; {template.version}
              </h2>
            </div>
            <p className={styles.statusBannerSubtitle}>
              Last Updated: <strong style={{ color: '#ffffff' }}>{template.updatedAt}</strong> &bull; Authorized by: <strong>{template.updatedBy}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={styles.statusBannerPill}>
              🔒 Guaranteed Contract Immutability Active
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className={styles.tabsBar}>
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`${styles.tabBtn} ${activeTab === 'editor' ? styles.tabBtnActive : ''}`}
          >
            <FileEdit size={16} /> Rich Clause Editor
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`${styles.tabBtn} ${activeTab === 'preview' ? styles.tabBtnActive : ''}`}
          >
            <Eye size={16} /> Live Borrower Contract Preview
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`${styles.tabBtn} ${activeTab === 'history' ? styles.tabBtnActive : ''}`}
          >
            <History size={16} /> Revision History ({history.length})
          </button>
        </div>

        {/* TAB 1: RICH CLAUSE EDITOR */}
        {activeTab === 'editor' && (
          <div className={styles.editorLayout}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Document Header Settings */}
              <div className={styles.cardBox}>
                <h3 className={styles.cardTitle} style={{ marginBottom: '14px' }}>
                  1. Contract Heading & Statutory Citations
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label className={styles.formLabel}>
                      Contract Main Title
                    </label>
                    <input
                      type="text"
                      value={template.title}
                      onChange={(e) => setTemplate({ ...template, title: e.target.value })}
                      className={styles.textInput}
                    />
                  </div>

                  <div>
                    <label className={styles.formLabel}>
                      Statutory Sub-Title / Legal Enabling Act
                    </label>
                    <input
                      type="text"
                      value={template.subTitle}
                      onChange={(e) => setTemplate({ ...template, subTitle: e.target.value })}
                      className={styles.textInput}
                      style={{ fontSize: '12.5px', color: '#334155' }}
                    />
                  </div>
                </div>
              </div>

              {/* Clause 1: Promissory Note */}
              <div className={styles.cardBox}>
                <div className={styles.cardBoxHeader}>
                  <h3 className={styles.cardTitle}>
                    Clause I: Promissory Note & Undertaking
                  </h3>
                  <span className={styles.subLabel}>Direct Visual Editor &bull; Bold / Italic / Bullets Enabled</span>
                </div>
                <input
                  type="text"
                  value={template.sections.promissoryTitle}
                  onChange={(e) => setTemplate({
                    ...template,
                    sections: { ...template.sections, promissoryTitle: e.target.value }
                  })}
                  className={styles.sectionTitleInput}
                  placeholder="Section title..."
                />
                <VisualTextEditor
                  label="Promissory Clause Content"
                  description="Use the toolbar buttons to Bold, Italicize, Underline, or add Bullet Points."
                  initialHtml={template.sections.promissoryHtml}
                  onChange={(html) => setTemplate({
                    ...template,
                    sections: { ...template.sections, promissoryHtml: html }
                  })}
                  minHeight="140px"
                />
              </div>

              {/* Clause 2: Default, Penalties & Collateral Assignment */}
              <div className={styles.cardBox}>
                <h3 className={styles.cardTitle} style={{ marginBottom: '10px' }}>
                  Clause II: Acceleration, Default & CBU Collateral Remedies
                </h3>
                <input
                  type="text"
                  value={template.sections.defaultTitle}
                  onChange={(e) => setTemplate({
                    ...template,
                    sections: { ...template.sections, defaultTitle: e.target.value }
                  })}
                  className={styles.sectionTitleInput}
                  placeholder="Section title..."
                />
                <VisualTextEditor
                  label="Default & Acceleration Remedies Content"
                  description="Format default conditions, penalty percentages, and CBU collateral provisions."
                  initialHtml={template.sections.defaultHtml}
                  onChange={(html) => setTemplate({
                    ...template,
                    sections: { ...template.sections, defaultHtml: html }
                  })}
                  minHeight="140px"
                />
              </div>

              {/* Clause 3: Data Privacy & E-Signature Legality */}
              <div className={styles.cardBox}>
                <h3 className={styles.cardTitle} style={{ marginBottom: '10px' }}>
                  Clause III: Data Privacy (R.A. 10173) & E-Commerce E-Signatures (R.A. 8792)
                </h3>
                <input
                  type="text"
                  value={template.sections.privacyTitle}
                  onChange={(e) => setTemplate({
                    ...template,
                    sections: { ...template.sections, privacyTitle: e.target.value }
                  })}
                  className={styles.sectionTitleInput}
                  placeholder="Section title..."
                />
                <VisualTextEditor
                  label="Statutory Covenants Content"
                  description="Specify privacy acts, data disclosure authorizations, and electronic signature validity."
                  initialHtml={template.sections.privacyHtml}
                  onChange={(html) => setTemplate({
                    ...template,
                    sections: { ...template.sections, privacyHtml: html }
                  })}
                  minHeight="140px"
                />
              </div>

              {/* Clause 4: Additional Member Affirmations */}
              <div className={styles.cardBox}>
                <h3 className={styles.cardTitle} style={{ marginBottom: '10px' }}>
                  Clause IV: Additional Disclosures & Intake Attestations
                </h3>
                <VisualTextEditor
                  label="Additional Covenants (Optional)"
                  description="Add custom clauses, bullet point terms, or member declarations."
                  initialHtml={template.sections.additionalClausesHtml || ''}
                  onChange={(html) => setTemplate({
                    ...template,
                    sections: { ...template.sections, additionalClausesHtml: html }
                  })}
                  minHeight="110px"
                  showTagHelper={false}
                />
              </div>
            </div>

            {/* Right Side: Version Control & Variable Helper */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Version Identifier Box */}
              <div className={styles.versionReleaseBox}>
                <span className={styles.versionTagLabel}>
                  New Release Version
                </span>
                <input
                  type="text"
                  value={editorVersionInput}
                  onChange={(e) => setEditorVersionInput(e.target.value)}
                  className={styles.versionInput}
                />
                <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 16px 0', lineHeight: '1.4' }}>
                  Publishing this revision will tag all newly submitted & executed loans with <strong>{editorVersionInput}</strong>. Past executed contracts will continue to display their original immutable terms.
                </p>

                <button
                  type="button"
                  onClick={handleSave}
                  style={{
                    width: '100%',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    padding: '11px',
                    borderRadius: '8px',
                    fontWeight: '800',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Save size={16} /> Publish Changes
                </button>
              </div>

              {/* Dynamic Interpolation Placeholders Guide */}
              <div className={styles.dynamicTagsBox}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                  <Code2 size={16} color="#15803d" />
                  <h4 style={{ fontSize: '12px', fontWeight: '800', color: '#15803d', margin: 0, textTransform: 'uppercase' }}>
                    Dynamic Tags Available
                  </h4>
                </div>
                <p style={{ fontSize: '11px', color: '#166534', margin: '0 0 10px 0' }}>
                  You can embed these dynamic placeholders in your HTML text. They are automatically filled with the borrower&apos;s actual numbers:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', fontFamily: 'monospace' }}>
                  <span className={styles.dynamicTagPill}>
                    {"{{totalScheduledCollections}}"}
                  </span>
                  <span className={styles.dynamicTagPill}>
                    {"{{installmentAmount}}"}
                  </span>
                  <span className={styles.dynamicTagPill}>
                    {"{{repaymentFrequency}}"}
                  </span>
                  <span className={styles.dynamicTagPill}>
                    {"{{termMonths}}"}
                  </span>
                  <span className={styles.dynamicTagPill}>
                    {"{{principal}}"}
                  </span>
                  <span className={styles.dynamicTagPill}>
                    {"{{borrowerName}}"}
                  </span>
                </div>
              </div>

              {/* Reset to Default */}
              <button
                type="button"
                onClick={handleResetToDefault}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#64748b',
                  border: '1px solid #dcece0',
                  padding: '10px',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <RotateCcw size={14} /> Reset to System Default
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE PREVIEW */}
        {activeTab === 'preview' && (
          <div className={styles.previewCanvas}>
            <div className={styles.previewTopBar}>
              <div>
                <h2 className={styles.previewHeaderTitle}>TRIBUTE CREDIT COOPERATIVE</h2>
                <p style={{ fontSize: '7.5pt', color: '#15803d', fontWeight: '800', margin: '2px 0 0 0' }}>CDA REG. REF: NCR-COOP-88219</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={styles.previewVersionBadge}>
                  VERSION {template.version} (PREVIEW)
                </span>
                <span style={{ display: 'block', fontSize: '7pt', color: '#64748b', marginTop: '3px' }}>
                  Updated: {template.updatedAt}
                </span>
              </div>
            </div>

            <div className={styles.previewBannerBox}>
              <h1 style={{ fontSize: '11pt', fontWeight: '800', margin: 0, textTransform: 'uppercase' }}>{template.title}</h1>
              <p style={{ fontSize: '7.5pt', color: '#bbf7d0', margin: '2px 0 0 0' }}>{template.subTitle}</p>
            </div>

            <div className={styles.previewBodyCard}>
              <h3 style={{ fontSize: '9pt', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', margin: '0 0 6px 0' }}>
                {template.sections.promissoryTitle}
              </h3>
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: interpolateContractHtml(template.sections.promissoryHtml, previewVars) 
                }} 
              />

              <h3 style={{ fontSize: '9pt', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', margin: '14px 0 6px 0' }}>
                {template.sections.defaultTitle}
              </h3>
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: interpolateContractHtml(template.sections.defaultHtml, previewVars) 
                }} 
              />

              <h3 style={{ fontSize: '9pt', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', margin: '14px 0 6px 0' }}>
                {template.sections.privacyTitle}
              </h3>
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: interpolateContractHtml(template.sections.privacyHtml, previewVars) 
                }} 
              />

              {template.sections.additionalClausesHtml && (
                <>
                  <h3 style={{ fontSize: '9pt', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', margin: '14px 0 6px 0' }}>
                    ADDITIONAL MEMBER COVENANTS
                  </h3>
                  <div 
                    dangerouslySetInnerHTML={{ 
                      __html: interpolateContractHtml(template.sections.additionalClausesHtml, previewVars) 
                    }} 
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: REVISION HISTORY */}
        {activeTab === 'history' && (
          <div className={styles.cardBox}>
            <h3 className={styles.cardTitle} style={{ marginBottom: '16px' }}>
              Archived Template Versions (Audit Log)
            </h3>
            {history.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '13px' }}>No previous revisions yet. This is the initial version.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {history.map((h, idx) => (
                  <div key={idx} className={styles.historyItem}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={styles.historyVersionPill}>
                          {h.version}
                        </span>
                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>{h.title}</strong>
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                        Updated: {h.updatedAt} by {h.updatedBy}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRestoreVersion(h)}
                      className={styles.historyRollbackBtn}
                    >
                      Rollback to this Version
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

