import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, AlertCircle, CheckCircle2, Upload } from 'lucide-react';
import { fr } from '../i18n/fr';

interface CameraCaptureProps {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
  onErrorFallback?: () => void;
  title?: string;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCapture,
  onClose,
  onErrorFallback,
  title,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isCadreValide, setIsCadreValide] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isReady) {
      const timer = setTimeout(() => {
        setIsCadreValide(true);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setIsCadreValide(false);
    }
  }, [isReady]);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    let active = true;

    async function initCamera() {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false,
          });
        } catch {
          // Repli sur caméra standard (ex: webcam ordi sans caméra arrière)
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (active) {
              videoRef.current?.play().catch(() => {});
              setIsReady(true);
            }
          };
        }
      } catch (err) {
        if (active) {
          stopStream();
          if (onErrorFallback) {
            onErrorFallback();
          } else {
            setError(fr.dossier.cameraError);
          }
        }
      }
    }

    if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      initCamera();
    } else {
      stopStream();
      if (onErrorFallback) {
        onErrorFallback();
      } else {
        setError(fr.dossier.cameraError);
      }
    }

    return () => {
      active = false;
      stopStream();
    };
  }, [onErrorFallback]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    let width = video.videoWidth || 1280;
    let height = video.videoHeight || 720;

    // Compression : largeur max 800 px, puis canvas.toDataURL('image/jpeg', 0.6)
    if (width > 800) {
      height = Math.round((height * 800) / width);
      width = 800;
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);

    setPreviewUrl(dataUrl);
  };

  const handleClose = () => {
    stopStream();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between text-white p-4">
      {/* En-tête sobre */}
      <div className="flex items-center justify-between z-10">
        <h2 className="text-sm font-semibold truncate max-w-[80%] text-slate-100">
          {title || fr.dossier.title}
        </h2>
        <button
          type="button"
          onClick={handleClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          aria-label={fr.dossier.close}
        >
          <X size={20} />
        </button>
      </div>

      {/* Cadre vidéo ou aperçu capturé */}
      <div className="relative flex-1 my-3 flex items-center justify-center overflow-hidden rounded-2xl bg-black">
        {error ? (
          <div className="text-center p-6 max-w-sm space-y-3 bg-slate-900/80 rounded-2xl border border-slate-800">
            <AlertCircle size={32} className="mx-auto text-amber-400" />
            <p className="text-xs text-slate-300 leading-relaxed">{error}</p>
            <div className="flex items-center justify-center gap-2 pt-2">
              {onErrorFallback && (
                <button
                  type="button"
                  onClick={() => {
                    stopStream();
                    onErrorFallback();
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <Upload size={14} />
                  <span>{fr.dossier.upload}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
              >
                {fr.dossier.close}
              </button>
            </div>
          </div>
        ) : previewUrl ? (
          <div className="w-full h-full flex items-center justify-center p-2">
            <img
              src={previewUrl}
              alt={fr.dossier.preview}
              className="w-full h-full object-contain rounded-xl"
            />
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover rounded-2xl"
            />

            {/* Cadre de guidage */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
              <div
                className={`w-full max-w-sm aspect-[4/3] border-2 border-dashed rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] relative transition-colors duration-300 ${
                  isCadreValide ? 'border-emerald-400/90' : 'border-amber-400/80'
                }`}
              >
                <div
                  className={`absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 rounded-tl-lg transition-colors ${
                    isCadreValide ? 'border-emerald-300' : 'border-amber-300'
                  }`}
                />
                <div
                  className={`absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 rounded-tr-lg transition-colors ${
                    isCadreValide ? 'border-emerald-300' : 'border-amber-300'
                  }`}
                />
                <div
                  className={`absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 rounded-bl-lg transition-colors ${
                    isCadreValide ? 'border-emerald-300' : 'border-amber-300'
                  }`}
                />
                <div
                  className={`absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 rounded-br-lg transition-colors ${
                    isCadreValide ? 'border-emerald-300' : 'border-amber-300'
                  }`}
                />
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-white/95 bg-black/70 px-3 py-1.5 rounded-full backdrop-blur-xs shadow-xs">
                {isCadreValide ? (
                  <>
                    <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                    <span>{fr.dossier.cadreValide}</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={13} className="text-amber-400 shrink-0" />
                    <span>{fr.dossier.cadreNonValideRaison}</span>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Barre de contrôle inférieure */}
      {!error && (
        <div className="px-6 pb-2 pt-1 z-10 w-full">
          {previewUrl ? (
            <div className="flex items-center justify-between gap-3 max-w-sm mx-auto">
              <button
                type="button"
                onClick={() => setPreviewUrl(null)}
                className="flex-1 min-h-[44px] px-4 py-2 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                {fr.dossier.retake}
              </button>
              <button
                type="button"
                onClick={() => {
                  stopStream();
                  onCapture(previewUrl);
                }}
                className="flex-1 min-h-[44px] px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-md"
              >
                {fr.dossier.validate}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 max-w-sm mx-auto">
              <div className="flex items-center justify-between w-full">
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-xs font-medium text-slate-300 hover:text-white px-3 py-2 cursor-pointer"
                >
                  {fr.dossier.cancel}
                </button>

                <button
                  type="button"
                  onClick={handleCapture}
                  disabled={!isReady || !isCadreValide}
                  className={`w-16 h-16 rounded-full border-4 flex items-center justify-center transition-all ${
                    isReady && isCadreValide
                      ? 'border-white bg-white/20 hover:bg-white/30 active:scale-95 cursor-pointer'
                      : 'border-slate-500 bg-slate-800/60 opacity-50 cursor-not-allowed'
                  }`}
                  aria-label={fr.dossier.capturePhoto}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md ${
                      isReady && isCadreValide
                        ? 'bg-white text-slate-900'
                        : 'bg-slate-600 text-slate-400'
                    }`}
                  >
                    <Camera size={22} />
                  </div>
                </button>

                <div className="w-12" />
              </div>

              {!isCadreValide && isReady && (
                <div className="text-[11px] text-amber-300 flex items-center gap-1.5 font-medium bg-black/75 px-3 py-1 rounded-full border border-amber-400/30">
                  <AlertCircle size={12} className="shrink-0 text-amber-400" />
                  <span>{fr.dossier.cadreNonValideRaison}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
