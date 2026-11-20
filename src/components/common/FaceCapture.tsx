'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface FaceCaptureProps {
  onCapture: (base64Data: string) => void;
  title?: string;
  description?: string;
  buttonText?: string;
  badgeText?: string;
  previewRounded?: boolean;
}

export const FaceCapture: React.FC<FaceCaptureProps> = ({
  onCapture,
  title = 'Live Camera Biometric Capture',
  description = 'Live camera only. No image uploads permitted for contract execution.',
  buttonText = 'Open Camera',
  badgeText = 'Photo Captured & Verified',
  previewRounded = true,
}) => {
  const [photo, setPhoto] = useState<string>('');
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [isStartingCamera, setIsStartingCamera] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop camera stream safely
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  // Clean up stream if component unmounts
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  // Start device live camera (strictly getUserMedia)
  const handleStartCamera = async () => {
    setCameraError('');
    setIsStartingCamera(true);

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not supported on this browser or device.');
      setIsStartingCamera(false);
      return;
    }

    try {
      // Prefer front/user-facing camera
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setIsCameraOpen(true);
      setIsStartingCamera(false);

      // Connect stream to video element once mounted
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((err) => {
            console.error('Video play error:', err);
          });
        }
      }, 100);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setIsStartingCamera(false);
      setIsCameraOpen(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera found on this device. A physical camera is required.');
      } else {
        setCameraError('Unable to open live camera: ' + (err.message || 'Unknown error'));
      }
    }
  };

  // Capture frame from active video stream onto canvas
  const handleSnapPhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

      setPhoto(dataUrl);
      onCapture(dataUrl);
      stopCameraStream();
    }
  };

  const handleRetake = () => {
    setPhoto('');
    onCapture('');
    stopCameraStream();
    handleStartCamera();
  };

  return (
    <div style={{
      border: '2px dashed #94a3b8',
      borderRadius: '16px',
      padding: '20px',
      backgroundColor: '#f8fafc',
      textAlign: 'center',
      position: 'relative'
    }}>
      {/* Captured Photo State */}
      {photo ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: previewRounded ? '140px' : '220px',
            height: previewRounded ? '140px' : '150px',
            borderRadius: previewRounded ? '50%' : '12px',
            overflow: 'hidden',
            border: '3px solid #10b981',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
            backgroundColor: '#ffffff'
          }}>
            <img src={photo} alt="Live Captured Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#166534', fontSize: '13px', fontWeight: '700' }}>
            <CheckCircle2 size={16} />
            <span>{badgeText}</span>
          </div>
          <button
            type="button"
            onClick={handleRetake}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={13} /> Retake with Camera
          </button>
        </div>
      ) : isCameraOpen ? (
        /* Live Camera Viewfinder State */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: previewRounded ? '220px' : '100%',
            maxWidth: '360px',
            height: previewRounded ? '220px' : '220px',
            borderRadius: previewRounded ? '50%' : '12px',
            overflow: 'hidden',
            border: '3px solid #0284c7',
            backgroundColor: '#000000',
            position: 'relative',
            boxShadow: '0 4px 16px rgba(2, 132, 199, 0.3)'
          }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)' // mirror for natural selfie feel
              }}
            />
            <div style={{
              position: 'absolute',
              top: '8px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(239, 68, 68, 0.85)',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '10px',
              fontWeight: '800',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ffffff', display: 'inline-block' }} />
              LIVE CAMERA
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleSnapPhoto}
              style={{
                backgroundColor: '#16a34a',
                color: '#ffffff',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(22, 163, 74, 0.35)'
              }}
            >
              <Camera size={16} /> Snap Photo
            </button>

            <button
              type="button"
              onClick={stopCameraStream}
              style={{
                backgroundColor: '#f1f5f9',
                color: '#475569',
                border: '1px solid #cbd5e1',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <XCircle size={14} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        /* Standby / Initial State */
        <div style={{ padding: '20px 10px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#e0f2fe',
            color: '#0284c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px auto'
          }}>
            <Camera size={28} />
          </div>
          <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>{title}</h4>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', maxWidth: '320px', margin: '4px auto 14px auto' }}>
            {description}
          </p>

          <div style={{
            display: 'inline-block',
            backgroundColor: '#fef3c7',
            color: '#92400e',
            padding: '3px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '700',
            marginBottom: '16px'
          }}>
            🔒 Live Camera Only &bull; No Uploads Allowed
          </div>

          {cameraError && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              maxWidth: '380px',
              margin: '0 auto 16px auto',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textAlign: 'left'
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{cameraError}</span>
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={handleStartCamera}
              disabled={isStartingCamera}
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '11px 24px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '800',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
              }}
            >
              <Camera size={16} /> {isStartingCamera ? 'Initializing Camera...' : buttonText}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
