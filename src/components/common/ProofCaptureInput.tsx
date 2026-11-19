'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, Upload, Trash2, CheckCircle2, X } from 'lucide-react';
import styles from './ProofCaptureInput.module.css';

interface ProofCaptureInputProps {
  label: string;
  helperText: string;
  value: string;
  fileName?: string;
  accent: 'admin' | 'officer';
  onChange: (dataUrl: string, fileName?: string) => void;
  disabled?: boolean;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ProofCaptureInput: React.FC<ProofCaptureInputProps> = ({
  label,
  helperText,
  value,
  fileName,
  accent,
  onChange,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, WEBP).');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setErrorMsg('Image exceeds the 5 MB limit. Please upload a smaller photo or receipt.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result) {
        onChange(result, file.name);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read the selected image file.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleOpenCamera = async () => {
    setErrorMsg('');
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('Camera is unavailable in this browser. Please upload a photo or receipt instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setIsCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 60);
    } catch {
      setErrorMsg('Could not access camera. Check permissions or use the Upload Image button.');
    }
  };

  const handleCaptureFrame = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    onChange(dataUrl, `camera-proof-${stamp}.jpg`);
    stopCamera();
  };

  const handleRemove = () => {
    setErrorMsg('');
    onChange('', undefined);
  };

  return (
    <div
      className={`${styles.wrapper} ${accent === 'admin' ? styles.wrapperAdmin : styles.wrapperOfficer}`}
    >
      <div className={styles.headerRow}>
        <div>
          <div className={styles.label}>{label}</div>
          <p className={styles.helper}>{helperText}</p>
        </div>
        <span
          className={`${styles.statusBadge} ${value ? styles.statusCaptured : styles.statusRequired}`}
        >
          {value ? '✓ Proof Attached' : 'Required'}
        </span>
      </div>

      {errorMsg && (
        <div className={styles.errorBox} role="alert">
          {errorMsg}
        </div>
      )}

      {!value && !isCameraOpen && (
        <div className={styles.controlsRow}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            className={styles.uploadBtn}
          >
            <Upload size={14} /> Upload Photo / Receipt
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={handleOpenCamera}
            className={`${styles.cameraBtn} ${accent === 'admin' ? styles.cameraBtnAdmin : styles.cameraBtnOfficer}`}
          >
            <Camera size={14} /> Capture with Camera
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className={styles.hiddenInput}
            aria-label={label}
          />
        </div>
      )}

      {isCameraOpen && (
        <div className={styles.cameraContainer}>
          <video ref={videoRef} playsInline muted className={styles.videoFeed} />
          <div className={styles.controlsRow}>
            <button type="button" onClick={handleCaptureFrame} className={styles.captureBtn}>
              <CheckCircle2 size={14} /> Capture Photo
            </button>
            <button type="button" onClick={stopCamera} className={styles.cancelBtn}>
              <X size={14} /> Cancel Camera
            </button>
          </div>
        </div>
      )}

      {value && (
        <div className={styles.previewCard}>
          <img src={value} alt={label} className={styles.previewImg} />
          <div className={styles.previewFooter}>
            <span className={styles.fileName}>{fileName || 'Attached proof image'}</span>
            {!disabled && (
              <button
                type="button"
                onClick={handleRemove}
                className={styles.removeBtn}
                aria-label={`Remove ${label}`}
              >
                <Trash2 size={13} /> Remove Proof
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
