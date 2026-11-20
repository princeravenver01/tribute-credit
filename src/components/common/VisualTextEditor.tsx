'use client';

import React, { useRef, useEffect } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  Heading2, 
  Heading3, 
  RemoveFormatting, 
  Tag 
} from 'lucide-react';

interface VisualTextEditorProps {
  label: string;
  initialHtml: string;
  onChange: (html: string) => void;
  minHeight?: string;
  placeholder?: string;
  description?: string;
  showTagHelper?: boolean;
}

export const VisualTextEditor: React.FC<VisualTextEditorProps> = ({
  label,
  initialHtml,
  onChange,
  minHeight = '140px',
  placeholder = 'Type contract text here...',
  description,
  showTagHelper = true
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);

  useEffect(() => {
    if (editorRef.current && !isInternalUpdate.current) {
      if (editorRef.current.innerHTML !== initialHtml) {
        editorRef.current.innerHTML = initialHtml || '';
      }
    }
    isInternalUpdate.current = false;
  }, [initialHtml]);

  const exec = (command: string, value: string | undefined = undefined) => {
    if (typeof document !== 'undefined') {
      document.execCommand(command, false, value);
      handleInput();
    }
  };

  const insertTag = (tag: string) => {
    if (typeof document !== 'undefined') {
      document.execCommand('insertText', false, tag);
      handleInput();
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      isInternalUpdate.current = true;
      const html = editorRef.current.innerHTML;
      onChange(html);
    }
  };

  const btnStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '5px',
    padding: '5px 8px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#334155',
    fontSize: '11px',
    fontWeight: '700',
    transition: 'all 0.15s ease'
  };

  const tagBtnStyle: React.CSSProperties = {
    backgroundColor: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: '4px',
    padding: '3px 7px',
    fontSize: '10.5px',
    fontFamily: 'monospace',
    color: '#0284c7',
    fontWeight: '700',
    cursor: 'pointer'
  };

  return (
    <div style={{
      backgroundColor: '#ffffff',
      borderRadius: '10px',
      border: '1.5px solid #cbd5e1',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
    }}>
      {/* Editor Header / Title */}
      <div style={{
        padding: '10px 14px',
        backgroundColor: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {label}
          </span>
          {description && (
            <span style={{ display: 'block', fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
              {description}
            </span>
          )}
        </div>
      </div>

      {/* Formatting Toolbar (Word / Docs Style) */}
      <div style={{
        backgroundColor: '#f1f5f9',
        borderBottom: '1px solid #e2e8f0',
        padding: '6px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexWrap: 'wrap'
      }}>
        <button
          type="button"
          onClick={() => exec('bold')}
          style={btnStyle}
          title="Bold (Ctrl+B)"
        >
          <Bold size={14} />
        </button>

        <button
          type="button"
          onClick={() => exec('italic')}
          style={btnStyle}
          title="Italic (Ctrl+I)"
        >
          <Italic size={14} />
        </button>

        <button
          type="button"
          onClick={() => exec('underline')}
          style={btnStyle}
          title="Underline (Ctrl+U)"
        >
          <Underline size={14} />
        </button>

        <div style={{ width: '1px', height: '20px', backgroundColor: '#cbd5e1', margin: '0 4px' }} />

        <button
          type="button"
          onClick={() => exec('insertUnorderedList')}
          style={btnStyle}
          title="Bullet Points"
        >
          <List size={14} /> <span style={{ marginLeft: '4px' }}>Bullets</span>
        </button>

        <button
          type="button"
          onClick={() => exec('insertOrderedList')}
          style={btnStyle}
          title="Numbered List"
        >
          <ListOrdered size={14} /> <span style={{ marginLeft: '4px' }}>Numbered</span>
        </button>

        <div style={{ width: '1px', height: '20px', backgroundColor: '#cbd5e1', margin: '0 4px' }} />

        <button
          type="button"
          onClick={() => exec('formatBlock', '<h3>')}
          style={btnStyle}
          title="Subheading"
        >
          <Heading3 size={14} /> Subheading
        </button>

        <button
          type="button"
          onClick={() => exec('removeFormat')}
          style={btnStyle}
          title="Clear Formatting"
        >
          <RemoveFormatting size={14} /> Clear
        </button>

        {showTagHelper && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700', marginRight: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Tag size={11} /> Insert Tag:
            </span>
            <button
              type="button"
              onClick={() => insertTag('{{totalScheduledCollections}}')}
              style={tagBtnStyle}
              title="Inserts scheduled total sum"
            >
              + Total Due
            </button>
            <button
              type="button"
              onClick={() => insertTag('{{installmentAmount}}')}
              style={tagBtnStyle}
              title="Inserts periodic installment"
            >
              + Installment
            </button>
            <button
              type="button"
              onClick={() => insertTag('{{repaymentFrequency}}')}
              style={tagBtnStyle}
              title="Inserts Daily / Weekly / Monthly"
            >
              + Frequency
            </button>
            <button
              type="button"
              onClick={() => insertTag('{{termMonths}}')}
              style={tagBtnStyle}
              title="Inserts loan term months"
            >
              + Months
            </button>
          </div>
        )}
      </div>

      {/* Editable Content Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        style={{
          minHeight,
          padding: '14px 16px',
          outline: 'none',
          fontSize: '13px',
          lineHeight: '1.6',
          color: '#0f172a',
          backgroundColor: '#ffffff'
        }}
        data-placeholder={placeholder}
      />
    </div>
  );
};

