import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, AlertCircle, CheckCircle2, Upload, ExternalLink, Loader2 } from 'lucide-react';
import { fr } from '../i18n/fr';
import { CinOcrFields, lireCinDeuxFaces, prechargerOcrCin } from '../utils/ocrCin';

type CameraErrorKind = 'permission_denied' | 'preview_blocked';

async function detectCameraErrorKind(err: unknown): Promise<CameraErrorKind> {
  const errName =
    typeof err === 'object' && err !== null && 'name' in err
      ? String((err as { name?: unknown }).name)
      : '';
  const errMsg =
    err instanceof Error ? err.message.toLowerCase() : String(err || '').toLowerCase();

  const docAny = typeof document !== 'undefined' ? (document as unknown as {
    featurePolicy?: { allowsFeature?: (f: string) => boolean };
    permissionsPolicy?: { allowsFeature?: (f: string) => boolean };
  }) : null;

  const policyBlocked =
    docAny?.featurePolicy?.allowsFeature?.('camera') === false ||
    docAny?.permissionsPolicy?.allowsFeature?.('camera') === false ||
    errMsg.includes('permissions policy') ||
    errMsg.includes('feature policy') ||
    errName === 'SecurityError';

  if (policyBlocked) {
    return 'preview_blocked';
  }

  const inIframe = typeof window !== 'undefined' && window.self !== window.top;
  if (inIframe) {
    try {
      if (navigator.permissions && typeof navigator.permissions.query === 'function') {
        const perm = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (perm.state === 'denied') {
          return 'permission_denied';
        }
      }
    } catch {
      // permissions.query peut ne pas supporter 'camera' sur certains navigateurs
    }
    if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
      return 'preview_blocked';
    }
  }

  return 'permission_denied';
}

interface CameraCaptureProps {
  onCapture: (dataUrl: string) => void;
  onCaptureDual?: (
    rectoDataUrl: string,
    versoDataUrl: string,
    extractedFields?: CinOcrFields
  ) => void;
  dualStepLabels?: [string, string];
  autoOcrOnCapture?: boolean;
  onCaptureAutoOcr?: (dataUrl: string, side?: 'recto' | 'verso') => void;
  onClose: () => void;
  onErrorFallback?: () => void;
  title?: string;
}

type DualScanPhase = 'scanning_recto' | 'recto_validated' | 'scanning_verso';

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCapture,
  onCaptureDual,
  dualStepLabels,
  autoOcrOnCapture,
  onCaptureAutoOcr,
  onClose,
  onErrorFallback,
  title,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [errorKind, setErrorKind] = useState<CameraErrorKind | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isCadreValide, setIsCadreValide] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dualStep, setDualStep] = useState<0 | 1>(0);
  const [scanPhase, setScanPhase] = useState<DualScanPhase>('scanning_recto');
  const [rectoCapture, setRectoCapture] = useState<string | null>(null);
  const dualStepRef = useRef<0 | 1>(0);
  const rectoCaptureRef = useRef<string | null>(null);
  const rectoFieldsRef = useRef<CinOcrFields>({});
  const onCaptureDualRef = useRef(onCaptureDual);
  onCaptureDualRef.current = onCaptureDual;
  const isDualMode = Boolean(onCaptureDual);

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
          const kind = await detectCameraErrorKind(err);
          if (active) {
            setErrorKind(kind);
          }
        }
      }
    }

    if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      initCamera();
    } else {
      stopStream();
      const inIframe = typeof window !== 'undefined' && window.self !== window.top;
      setErrorKind(inIframe ? 'preview_blocked' : 'permission_denied');
    }

    return () => {
      active = false;
      stopStream();
    };
  }, []);

  const captureVideoFrame = (jpegQuality = 0.6): string | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    const canvas = document.createElement('canvas');
    let width = video.videoWidth || 1280;
    let height = video.videoHeight || 720;

    // Compression : largeur max 800 px
    if (width > 800) {
      height = Math.round((height * 800) / width);
      width = 800;
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', jpegQuality);
  };

  // Boucle de scan OCR automatique sans bouton Capturer en mode CIN double-face
  useEffect(() => {
    if (!isDualMode || !isReady || errorKind) return;
    let cancelled = false;

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      });

    async function scanLoop() {
      await prechargerOcrCin();
      // Laisse la mise au point initiale se stabiliser brièvement
      await sleep(700);

      while (!cancelled) {
        const frameDataUrl = captureVideoFrame(0.75);
        if (!frameDataUrl) {
          await sleep(400);
          continue;
        }

        if (dualStepRef.current === 0) {
          const res = await lireCinDeuxFaces(frameDataUrl, undefined, {
            autoOcrOnCameraCapture: true,
            cameraSide: 'recto',
          });
          if (cancelled) return;

          const recognizedCount = [
            res.fields.nom,
            res.fields.prenom,
            res.fields.cin,
            res.fields.dateNaissance,
          ].filter(Boolean).length;

          if (res.success && recognizedCount >= 2) {
            rectoCaptureRef.current = frameDataUrl;
            rectoFieldsRef.current = res.fields;
            setRectoCapture(frameDataUrl);
            setScanPhase('recto_validated');
            // Laisse 1,4 s à l'étudiant pour lire la consigne et retourner la carte
            await sleep(1400);
            if (cancelled) return;
            dualStepRef.current = 1;
            setDualStep(1);
            setScanPhase('scanning_verso');
            await sleep(400);
            continue;
          }
        } else {
          const res = await lireCinDeuxFaces(undefined, frameDataUrl, {
            autoOcrOnCameraCapture: true,
            cameraSide: 'verso',
          });
          if (cancelled) return;

          const versoCount = [
            res.fields.nom,
            res.fields.prenom,
            res.fields.cin,
            res.fields.dateNaissance,
          ].filter(Boolean).length;

          if (res.success && versoCount >= 2) {
            const mergedFields: CinOcrFields = {
              nom: res.fields.nom || rectoFieldsRef.current.nom,
              prenom: res.fields.prenom || rectoFieldsRef.current.prenom,
              cin: res.fields.cin || rectoFieldsRef.current.cin,
              dateNaissance: res.fields.dateNaissance || rectoFieldsRef.current.dateNaissance,
            };
            stopStream();
            onCaptureDualRef.current?.(
              rectoCaptureRef.current || frameDataUrl,
              frameDataUrl,
              mergedFields
            );
            return;
          }
        }

        await sleep(650);
      }
    }

    void scanLoop();
    return () => {
      cancelled = true;
    };
  }, [isDualMode, isReady, errorKind]);

  const handleCapture = () => {
    const dataUrl = captureVideoFrame(0.6);
    if (!dataUrl) return;

    if (isDualMode && onCaptureDual) {
      if (dualStep === 0) {
        setRectoCapture(dataUrl);
        setDualStep(1);
        if (autoOcrOnCapture && onCaptureAutoOcr) {
          onCaptureAutoOcr(dataUrl, 'recto');
        }
      } else {
        stopStream();
        if (autoOcrOnCapture && onCaptureAutoOcr) {
          onCaptureAutoOcr(dataUrl, 'verso');
        }
        onCaptureDual(rectoCapture || dataUrl, dataUrl);
      }
      return;
    }

    if (autoOcrOnCapture) {
      stopStream();
      onCaptureAutoOcr?.(dataUrl);
      onCapture(dataUrl);
      return;
    }

    setPreviewUrl(dataUrl);
  };

  const handleClose = () => {
    stopStream();
    onClose();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopStream();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const stepLabel = isDualMode
    ? dualStepLabels
      ? dualStepLabels[dualStep]
      : dualStep === 0
      ? fr.dossier.cinScanRectoStep
      : fr.dossier.cinScanVersoStep
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between text-white p-4">
      {/* En-tête sobre */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2 min-w-0 max-w-[85%]">
          <h2 className="text-sm font-semibold truncate text-slate-100">
            {title || fr.dossier.title}
          </h2>
          {stepLabel && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white shrink-0">
              {stepLabel}
            </span>
          )}
        </div>
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
        {errorKind ? (
          <div className="text-center p-6 max-w-sm space-y-3 bg-slate-900/90 rounded-2xl border border-slate-800">
            <AlertCircle size={32} className="mx-auto text-amber-400" />
            <p className="text-xs text-slate-200 leading-relaxed font-medium">
              {errorKind === 'preview_blocked'
                ? fr.dossier.cameraBloqueeApercu
                : fr.dossier.cameraRefusee}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {errorKind === 'preview_blocked' && (
                <button
                  type="button"
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <ExternalLink size={14} />
                  <span>{fr.dossier.ouvrirNouvelOnglet}</span>
                </button>
              )}
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
                {fr.dossier.cancel}
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
                  isDualMode
                    ? scanPhase === 'recto_validated'
                      ? 'border-emerald-400'
                      : 'border-amber-300/90'
                    : isCadreValide
                    ? 'border-emerald-400/90'
                    : 'border-amber-400/80'
                }`}
              >
                <div
                  className={`absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 rounded-tl-lg transition-colors ${
                    isDualMode
                      ? scanPhase === 'recto_validated'
                        ? 'border-emerald-300'
                        : 'border-amber-300'
                      : isCadreValide
                      ? 'border-emerald-300'
                      : 'border-amber-300'
                  }`}
                />
                <div
                  className={`absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 rounded-tr-lg transition-colors ${
                    isDualMode
                      ? scanPhase === 'recto_validated'
                        ? 'border-emerald-300'
                        : 'border-amber-300'
                      : isCadreValide
                      ? 'border-emerald-300'
                      : 'border-amber-300'
                  }`}
                />
                <div
                  className={`absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 rounded-bl-lg transition-colors ${
                    isDualMode
                      ? scanPhase === 'recto_validated'
                        ? 'border-emerald-300'
                        : 'border-amber-300'
                      : isCadreValide
                      ? 'border-emerald-300'
                      : 'border-amber-300'
                  }`}
                />
                <div
                  className={`absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 rounded-br-lg transition-colors ${
                    isDualMode
                      ? scanPhase === 'recto_validated'
                        ? 'border-emerald-300'
                        : 'border-amber-300'
                      : isCadreValide
                      ? 'border-emerald-300'
                      : 'border-amber-300'
                  }`}
                />
              </div>
              <div
                className={`mt-4 flex items-center gap-2 text-xs font-medium px-3.5 py-2 rounded-full backdrop-blur-xs shadow-sm text-center ${
                  isDualMode && scanPhase === 'recto_validated'
                    ? 'bg-emerald-600/95 text-white'
                    : 'bg-black/75 text-white/95'
                }`}
              >
                {isDualMode ? (
                  scanPhase === 'recto_validated' ? (
                    <>
                      <CheckCircle2 size={15} className="text-white shrink-0" />
                      <span>{fr.dossier.scanOcrRectoValideTournez}</span>
                    </>
                  ) : (
                    <>
                      <Loader2 size={14} className="animate-spin text-emerald-400 shrink-0" />
                      <span>
                        {scanPhase === 'scanning_verso'
                          ? fr.dossier.scanOcrRechercheVerso
                          : fr.dossier.scanOcrRechercheRecto}
                      </span>
                    </>
                  )
                ) : isCadreValide ? (
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
      {!errorKind && (
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
            <div className="flex items-center justify-center gap-3 max-w-sm mx-auto">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 min-h-[44px] px-4 py-2 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                {fr.dossier.cancel}
              </button>

              {!isDualMode && (
                <button
                  type="button"
                  onClick={handleCapture}
                  disabled={!isReady}
                  className={`flex-1 min-h-[44px] px-4 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all ${
                    isReady
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 cursor-pointer shadow-md'
                      : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  }`}
                  aria-label={fr.dossier.btnCapturer}
                >
                  <Camera size={16} />
                  <span>{fr.dossier.btnCapturer}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
