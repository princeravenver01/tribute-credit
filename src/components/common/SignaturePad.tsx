'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { PenTool, Eraser, Maximize2, Minimize2, Check } from 'lucide-react';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  height?: number;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  onSave,
  height = 180,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [savedDataUrl, setSavedDataUrl] = useState<string>('');

  const initCanvas = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
  };

  useEffect(() => {
    initCanvas(canvasRef.current);
  }, []);

  useEffect(() => {
    if (isFullScreen && modalCanvasRef.current) {
      initCanvas(modalCanvasRef.current);
      // If there's already an existing signature, draw it onto the full-screen canvas
      if (savedDataUrl) {
        const img = new Image();
        img.onload = () => {
          const ctx = modalCanvasRef.current?.getContext('2d');
          ctx?.drawImage(img, 0, 0);
        };
        img.src = savedDataUrl;
      }
    }
  }, [isFullScreen, savedDataUrl]);

  // Drawing event handlers
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, targetCanvas: HTMLCanvasElement) => {
    const rect = targetCanvas.getBoundingClientRect();
    const scaleX = targetCanvas.width / rect.width;
    const scaleY = targetCanvas.height / rect.height;

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);

    const { x, y } = getCoordinates(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement | null) => {
    if (!isDrawing || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (canvas: HTMLCanvasElement | null) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      setSavedDataUrl(dataUrl);
      onSave(dataUrl);

      // If in full screen, also sync preview to inline canvas
      if (isFullScreen && canvasRef.current) {
        const inlineCtx = canvasRef.current.getContext('2d');
        const img = new Image();
        img.onload = () => {
          inlineCtx?.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
          inlineCtx?.drawImage(img, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
        };
        img.src = dataUrl;
      }
    }
  };

  const clearCanvas = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setSavedDataUrl('');
    onSave('');

    if (canvasRef.current) {
      const inlineCtx = canvasRef.current.getContext('2d');
      inlineCtx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{
          border: '2px dashed #94a3b8',
          borderRadius: '12px',
          backgroundColor: '#ffffff',
          position: 'relative',
          touchAction: 'none',
          overflow: 'hidden'
        }}>
          <canvas
            ref={canvasRef}
            width={600}
            height={height}
            onMouseDown={(e) => startDrawing(e, canvasRef.current)}
            onMouseMove={(e) => draw(e, canvasRef.current)}
            onMouseUp={() => stopDrawing(canvasRef.current)}
            onMouseLeave={() => stopDrawing(canvasRef.current)}
            onTouchStart={(e) => startDrawing(e, canvasRef.current)}
            onTouchMove={(e) => draw(e, canvasRef.current)}
            onTouchEnd={() => stopDrawing(canvasRef.current)}
            style={{ width: '100%', height: `${height}px`, display: 'block', cursor: 'crosshair' }}
          />

          {!hasDrawn && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              color: '#94a3b8',
              fontSize: '13px',
              gap: '6px'
            }}>
              <PenTool size={16} />
              <span>Sign with stylus or finger here</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            {hasDrawn ? '✓ Digital signature captured' : 'Applicant signature required'}
          </span>

          <div style={{ display: 'flex', gap: '8px' }}>
            {/* Open Full Screen button */}
            <button
              type="button"
              onClick={() => setIsFullScreen(true)}
              style={{
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer'
              }}
              title="Open full screen signature pad for tablets"
            >
              <Maximize2 size={13} /> Full Screen
            </button>

            {/* Clear button */}
            <button
              type="button"
              onClick={() => clearCanvas(canvasRef.current)}
              style={{
                background: 'none',
                border: '1px solid #cbd5e1',
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
            >
              <Eraser size={13} /> Clear
            </button>
          </div>
        </div>
      </div>

      {/* FULL SCREEN MODAL SIGNATURE PAD (TABLET OPTIMIZED) */}
      {isFullScreen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            color: '#ffffff'
          }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '800' }}>Full Screen Digital Signature</h3>
              <p style={{ fontSize: '12px', color: '#94a3b8' }}>Please have the applicant sign with tablet stylus or finger.</p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => clearCanvas(modalCanvasRef.current)}
                style={{
                  backgroundColor: '#334155',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <Eraser size={14} /> Clear
              </button>

              <button
                type="button"
                onClick={() => setIsFullScreen(false)}
                style={{
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)'
                }}
              >
                <Check size={16} /> Save & Done
              </button>
            </div>
          </div>

          <div style={{
            flex: 1,
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '2px solid #38bdf8',
            position: 'relative',
            touchAction: 'none'
          }}>
            <canvas
              ref={modalCanvasRef}
              width={1200}
              height={700}
              onMouseDown={(e) => startDrawing(e, modalCanvasRef.current)}
              onMouseMove={(e) => draw(e, modalCanvasRef.current)}
              onMouseUp={() => stopDrawing(modalCanvasRef.current)}
              onMouseLeave={() => stopDrawing(modalCanvasRef.current)}
              onTouchStart={(e) => startDrawing(e, modalCanvasRef.current)}
              onTouchMove={(e) => draw(e, modalCanvasRef.current)}
              onTouchEnd={() => stopDrawing(modalCanvasRef.current)}
              style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
            />
            <div style={{
              position: 'absolute',
              bottom: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              color: '#94a3b8',
              fontSize: '13px',
              pointerEvents: 'none'
            }}>
              — Stylus / Touch Signature Area —
            </div>
          </div>
        </div>
      )}
    </>
  );
};
