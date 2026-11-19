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
  Code2,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { 
  getActiveContractTemplate, 
  saveContractTemplate, 
  getContractTemplateHistory, 
  ContractTemplate, 
  DEFAULT_CONTRACT_TEMPLATE,
  interpolateContractHtml,
  type ContractClauseItem
} from '@/lib/contract-template-store';
import { VisualTextEditor } from '@/components/common/VisualTextEditor';
import theme from '@/components/admin/AdminTheme.module.css';
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
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      const loaded = getActiveContractTemplate();
      setTemplate(loaded);
      setHistory(getContractTemplateHistory());

      if (loaded.version) {
        const match = loaded.version.match(/v?(\d+)\.(\d+)/);
        if (match) {
          const major = match[1];
          const minor = Number(match[2]) + 1;
          setEditorVersionInput(`v${major}.${minor}`);
        }
      }
    });
    return () => {
      active = false;
    };
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

  const handleAddClause = () => {
    const existing = template.customClauses || [];
    const newClause: ContractClauseItem = {
      id: `clause-${Date.now()}`,
      title: `Special Clause ${existing.length + 1}`,
      html: '<p>The borrower agrees to the specific covenants stipulated herein.</p>',
      order: existing.length + 1,
      isRequired: false,
    };
    setTemplate({
      ...template,
      customClauses: [...existing, newClause],
    });
  };

  const handleUpdateClause = (id: string, updates: Partial<ContractClauseItem>) => {
    const existing = template.customClauses || [];
    setTemplate({
      ...template,
      customClauses: existing.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    });
  };

  const handleDeleteClause = (id: string) => {
    const existing = template.customClauses || [];
    setTemplate({
      ...template,
      customClauses: existing.filter((c) => c.id !== id),
    });
  };

  const handleMoveClause = (index: number, direction: 'up' | 'down') => {
    const existing = [...(template.customClauses || [])];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= existing.length) return;
    const temp = existing[index];
    existing[index] = existing[targetIdx];
    existing[targetIdx] = temp;
    const reordered = existing.map((c, idx) => ({ ...c, order: idx + 1 }));
    setTemplate({
      ...template,
      customClauses: reordered,
    });
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
                  backgroundColor: '#B91C1C',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontWeight: '800',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(185, 28, 28, 0.25)'
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

              {/* DYNAMIC CUSTOM CLAUSES BUILDER */}
              <div className={styles.cardBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h3 className={styles.cardTitle} style={{ margin: 0 }}>
                      Custom Governance & Operational Clauses
                    </h3>
                    <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0 0' }}>
                      Add arbitrary legal sections, covenants, or policy stipulations with custom ordering.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddClause}
                    className={styles.addClauseBtn}
                  >
                    <Plus size={14} /> Add Custom Clause
                  </button>
                </div>

                {(!template.customClauses || template.customClauses.length === 0) ? (
                  <div className={styles.emptyClauseBox}>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                      No custom clauses added yet. Click &quot;Add Custom Clause&quot; above to append specialized covenants.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {template.customClauses.map((clause, idx) => (
                      <div key={clause.id} className={styles.clauseItemCard}>
                        <div className={styles.clauseItemHeader}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                            <span className={styles.clauseOrderBadge}>#{idx + 1}</span>
                            <input
                              type="text"
                              value={clause.title}
                              onChange={(e) => handleUpdateClause(clause.id, { title: e.target.value })}
                              className={styles.clauseTitleInput}
                              placeholder="Clause Title (e.g. Early Settlement Rebate Policy)"
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => handleMoveClause(idx, 'up')}
                              disabled={idx === 0}
                              className={styles.clauseIconBtn}
                              title="Move Up"
                              aria-label="Move Up"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveClause(idx, 'down')}
                              disabled={idx === (template.customClauses?.length || 0) - 1}
                              className={styles.clauseIconBtn}
                              title="Move Down"
                              aria-label="Move Down"
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteClause(clause.id)}
                              className={styles.clauseDeleteBtn}
                              title="Remove Clause"
                              aria-label="Remove Clause"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        <VisualTextEditor
                          label="Clause Body HTML"
                          description="Supports rich text and dynamic tokens like {{borrowerName}}, {{principal}}, {{installmentAmount}}."
                          initialHtml={clause.html}
                          onChange={(html) => handleUpdateClause(clause.id, { html })}
                          minHeight="90px"
                          showTagHelper={false}
                        />
                      </div>
                    ))}
                  </div>
                )}
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
                    backgroundColor: '#B91C1C',
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
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(185, 28, 28, 0.25)'
                  }}
                >
                  <Save size={16} /> Publish Changes
                </button>
              </div>

              {/* Dynamic Interpolation Placeholders Guide */}
              <div className={styles.dynamicTagsBox}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                  <Code2 size={16} color="#B91C1C" />
                  <h4 style={{ fontSize: '12px', fontWeight: '800', color: '#B91C1C', margin: 0, textTransform: 'uppercase' }}>
                    Dynamic Tags Available
                  </h4>
                </div>
                <p style={{ fontSize: '11px', color: '#64748B', margin: '0 0 10px 0' }}>
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

              {template.customClauses && template.customClauses.map((clause, idx) => (
                <div key={clause.id} style={{ marginTop: '14px' }}>
                  <h3 style={{ fontSize: '9pt', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', margin: '0 0 6px 0' }}>
                    {clause.title || `SPECIAL COVENANT #${idx + 1}`}
                  </h3>
                  <div 
                    dangerouslySetInnerHTML={{ 
                      __html: interpolateContractHtml(clause.html, previewVars) 
                    }} 
                  />
                </div>
              ))}
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

