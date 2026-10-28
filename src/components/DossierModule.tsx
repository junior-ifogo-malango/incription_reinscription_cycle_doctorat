import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Building2,
  FileCheck2,
  X,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { Candidat, Piece, Dossier, PieceType } from '../types';
import { APOGEE_FICTIF_DB } from '../data/mockData';
import { fr } from '../i18n/fr';
import { StatusBadge } from './StatusBadge';

interface DossierModuleProps {
  candidat: Candidat;
  pieces: Piece[];
  dossier: Dossier;
  onUpdatePieces: (newPieces: Piece[]) => void;
  onUpdateDossier: (newDossier: Dossier) => void;
}

export const DossierModule: React.FC<DossierModuleProps> = ({
  candidat,
  pieces,
  dossier,
  onUpdatePieces,
  onUpdateDossier,
}) => {
  // Apogée local states
  const [apogeeCne, setApogeeCne] = useState(candidat.cne || 'N138249871');
  const [apogeeConsent, setApogeeConsent] = useState(dossier.consentementApogee ?? true);
  const [apogeeMsg, setApogeeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Camera modal state
  const [cameraActivePiece, setCameraActivePiece] = useState<PieceType | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadTargetPiece, setUploadTargetPiece] = useState<PieceType | null>(null);

  const isRetenu = dossier.statutGlobal === 'retenu';

  // Calcul du nombre de pièces prêtes (prouvée ou déclarée)
  const piecesPretes = pieces.filter((p) => p.statut === 'prouvee' || p.statut === 'declaree').length;
  const progressPercent = Math.round((piecesPretes / 4) * 100);

  // Helper pour trouver une pièce
  const getPiece = (type: PieceType): Piece => {
    return (
      pieces.find((p) => p.type === type) || {
        id: `piece-${type}`,
        candidatId: candidat.id,
        type,
        statut: 'absente',
        source: 'televersement',
        dateMaj: new Date().toISOString().split('T')[0],
      }
    );
  };

  const updateSinglePiece = (type: PieceType, updates: Partial<Piece>) => {
    const existingIndex = pieces.findIndex((p) => p.type === type);
    let newPieces = [...pieces];
    if (existingIndex >= 0) {
      newPieces[existingIndex] = {
        ...newPieces[existingIndex],
        ...updates,
        dateMaj: new Date().toISOString().split('T')[0],
      };
    } else {
      newPieces.push({
        id: `piece-${type}-${Date.now()}`,
        candidatId: candidat.id,
        type,
        statut: 'absente',
        source: 'televersement',
        dateMaj: new Date().toISOString().split('T')[0],
        ...updates,
      });
    }
    onUpdatePieces(newPieces);
  };

  // 1. Déclarer sur l'honneur (toggle déclaration)
  const handleToggleDeclaration = (type: PieceType, currentStatut: string) => {
    if (currentStatut === 'prouvee') return; // Déjà prouvée
    const newStatut = currentStatut === 'declaree' ? 'absente' : 'declaree';
    updateSinglePiece(type, { statut: newStatut });
  };

  // 2. Apogée sync
  const handleVerifyApogee = () => {
    if (!apogeeConsent) {
      setApogeeMsg({ type: 'error', text: fr.dossierModule.apogee.consentRequired });
      return;
    }
    const cleanCne = apogeeCne.trim().toUpperCase();
    const entry = APOGEE_FICTIF_DB[cleanCne];

    if (entry) {
      updateSinglePiece('diplome', {
        statut: 'prouvee',
        source: 'apogee',
        fichier: `${entry.diplome} (${entry.mention})`,
      });
      const updatedDossier = {
        ...dossier,
        consentementApogee: true,
      };
      onUpdateDossier(updatedDossier);
      setApogeeMsg({
        type: 'success',
        text: fr.dossierModule.apogee.successMessage
          .replace('{diplome}', entry.diplome)
          .replace('{mention}', entry.mention)
          .replace('{annee}', String(entry.anneeObtention)),
      });
    } else {
      setApogeeMsg({
        type: 'error',
        text: fr.dossierModule.apogee.notFoundMessage,
      });
    }
  };

  // 3. Caméra
  const startCamera = async (type: PieceType) => {
    setCameraActivePiece(type);
    setCapturedPhotoUrl(null);
    setCameraError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia unsupported');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      // Caméra refusée ou indisponible : bascule automatique sur téléversement
      stopCamera();
      triggerUpload(type);
      setCameraError(fr.dossierModule.camera.errorUnavailable);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedPhotoUrl(dataUrl);
      }
    }
  };

  const retakePhoto = () => {
    setCapturedPhotoUrl(null);
  };

  const validateCapturedPhoto = () => {
    if (cameraActivePiece && capturedPhotoUrl) {
      updateSinglePiece(cameraActivePiece, {
        statut: 'prouvee',
        source: 'camera',
        fichier: `photo_${cameraActivePiece}_${Date.now()}.jpg`,
      });
    }
    stopCamera();
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setCameraActivePiece(null);
    setCapturedPhotoUrl(null);
  };

  // 4. Téléversement
  const triggerUpload = (type: PieceType) => {
    setUploadTargetPiece(type);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadTargetPiece) {
      updateSinglePiece(uploadTargetPiece, {
        statut: 'prouvee',
        source: 'televersement',
        fichier: file.name,
      });
      setUploadTargetPiece(null);
    }
  };

  // 5. Cas particulier
  const handleCasParticulierToggle = (checked: boolean) => {
    onUpdateDossier({
      ...dossier,
      casParticulier: checked,
      motif: checked ? (dossier.motif || 'attestation') : '',
    });
  };

  const handleMotifChange = (motif: string) => {
    onUpdateDossier({
      ...dossier,
      motif,
    });
  };

  const handleMotifAutreChange = (val: string) => {
    onUpdateDossier({
      ...dossier,
      motifAutre: val,
    });
  };

  // 6. Guichet
  const handleToggleGuichet = () => {
    onUpdateDossier({
      ...dossier,
      traiterAuGuichet: !dossier.traiterAuGuichet,
    });
  };

  const diplomePiece = getPiece('diplome');
  const isApogeeCertified = diplomePiece.statut === 'prouvee' && diplomePiece.source === 'apogee';

  return (
    <div className="space-y-4">
      {/* Input de fichier caché pour le téléversement */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Barre de progression & Compteur pièces prêtes */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">
              {fr.dossierModule.progressTitle}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {fr.dossierModule.progressFormat
                .replace('{count}', String(piecesPretes))
                .replace('{total}', '4')}
            </span>
          </div>
          {piecesPretes === 4 && (
            <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 size={14} />
              {fr.dossierModule.allReadyBadge}
            </span>
          )}
        </div>

        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div
            className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Notification si le candidat est "Retenu" par l'enseignant */}
      {isRetenu && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-2.5 text-amber-900 text-xs">
          <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{fr.dossierModule.retainedNotice}</p>
          </div>
        </div>
      )}

      {/* Message Caméra indisponible / erreur */}
      {cameraError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between text-rose-800 text-xs">
          <span>{cameraError}</span>
          <button
            type="button"
            onClick={() => setCameraError(null)}
            className="text-rose-600 font-bold ml-2 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* LISTE DES 4 PIÈCES JUSTIFICATIVES */}
      <div className="space-y-3">
        {(['cin', 'diplome', 'releves', 'cv'] as PieceType[]).map((type) => {
          const piece = getPiece(type);
          const needsProof = isRetenu && piece.statut !== 'prouvee';
          const isDiplome = type === 'diplome';

          return (
            <div
              key={type}
              className={`bg-white border rounded-xl p-3.5 space-y-3 shadow-xs transition-colors ${
                needsProof ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'
              }`}
            >
              {/* En-tête pièce */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-900">
                    {fr.dossierModule.pieceTypes[type]}
                  </h3>
                  {piece.fichier && (
                    <p className="text-[11px] text-slate-500 truncate max-w-[240px] sm:max-w-md">
                      {piece.fichier}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <StatusBadge type="piece" statut={piece.statut} size="sm" />
                  {needsProof && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                      {fr.dossierModule.pieceRequiredAlert}
                    </span>
                  )}
                </div>
              </div>

              {/* SECTION SPÉCIALE DIPLÔME VIA APOGÉE */}
              {isDiplome && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                    <Building2 size={14} className="text-blue-700" />
                    <span>{fr.dossierModule.apogee.title}</span>
                  </div>

                  {isApogeeCertified ? (
                    <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md p-2">
                      <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                      <span className="text-[11px] font-medium">
                        {fr.dossierModule.apogee.alreadyCertified}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={apogeeCne}
                            onChange={(e) => setApogeeCne(e.target.value)}
                            placeholder={fr.dossierModule.apogee.cneLabel}
                            className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                          />
                          <button
                            type="button"
                            onClick={handleVerifyApogee}
                            className="bg-blue-700 text-white font-medium px-3 py-1.5 rounded-lg text-xs hover:bg-blue-800 transition-colors cursor-pointer shrink-0"
                          >
                            {fr.dossierModule.apogee.btnVerify}
                          </button>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-slate-600">
                          <input
                            type="checkbox"
                            checked={apogeeConsent}
                            onChange={(e) => setApogeeConsent(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                          />
                          <span>{fr.dossierModule.apogee.consentLabel}</span>
                        </label>
                      </div>

                      {apogeeMsg && (
                        <p
                          className={`text-[11px] font-medium rounded p-1.5 ${
                            apogeeMsg.type === 'success'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {apogeeMsg.text}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* DÉCLARATION SUR L'HONNEUR (si non prouvée) */}
              {piece.statut !== 'prouvee' && (
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700 pt-1">
                  <input
                    type="checkbox"
                    checked={piece.statut === 'declaree'}
                    onChange={() => handleToggleDeclaration(type, piece.statut)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <span>{fr.dossierModule.declareCheckbox}</span>
                </label>
              )}

              {/* BOUTONS D'AJOUT DE PREUVE (Photo ou Téléversement) */}
              {(!isDiplome || !isApogeeCertified) && (
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => startCamera(type)}
                    className="flex-1 min-h-[38px] bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 px-3 transition-colors cursor-pointer"
                  >
                    <Camera size={15} />
                    <span>{fr.dossierModule.actions.takePhoto}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => triggerUpload(type)}
                    className="flex-1 min-h-[38px] bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 px-3 transition-colors cursor-pointer"
                  >
                    <Upload size={15} />
                    <span>{fr.dossierModule.actions.uploadFile}</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* CAS PARTICULIER */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-900 cursor-pointer select-none">
            {fr.dossierModule.casParticulier.title}
          </label>
          <input
            type="checkbox"
            checked={dossier.casParticulier}
            onChange={(e) => handleCasParticulierToggle(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
          />
        </div>

        {dossier.casParticulier && (
          <div className="space-y-2.5 pt-2 border-t border-slate-100 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {fr.dossierModule.casParticulier.motiveLabel}
              </label>
              <select
                value={dossier.motif || 'attestation'}
                onChange={(e) => handleMotifChange(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="attestation">{fr.dossierModule.casParticulier.motives.attestation}</option>
                <option value="etranger">{fr.dossierModule.casParticulier.motives.etranger}</option>
                <option value="ingenieur">{fr.dossierModule.casParticulier.motives.ingenieur}</option>
                <option value="autre">{fr.dossierModule.casParticulier.motives.autre}</option>
              </select>
            </div>

            {dossier.motif === 'autre' && (
              <div>
                <input
                  type="text"
                  value={dossier.motifAutre || ''}
                  onChange={(e) => handleMotifAutreChange(e.target.value)}
                  placeholder={fr.dossierModule.casParticulier.autrePlaceholder}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECOURS : SAISIE ASSISTÉE AU GUICHET */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-slate-900">{fr.dossierModule.guichet.title}</h4>
            <p className="text-[11px] text-slate-500">{fr.dossierModule.guichet.notice}</p>
          </div>
          {dossier.traiterAuGuichet && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
              {fr.dossierModule.guichet.markedBadge}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleToggleGuichet}
          className={`w-full min-h-[40px] rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
            dossier.traiterAuGuichet
              ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Building2 size={15} />
          <span>
            {dossier.traiterAuGuichet
              ? fr.dossierModule.guichet.btnCancelGuichet
              : fr.dossierModule.guichet.btnMarkGuichet}
          </span>
        </button>
      </div>

      {/* MODALE CAMÉRA AVEC CADRE DE GUIDAGE */}
      {cameraActivePiece && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3">
          <div className="bg-slate-900 text-white rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold">{fr.dossierModule.camera.title}</span>
              <button
                type="button"
                onClick={stopCamera}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Zone Vidéo ou Aperçu */}
            <div className="relative bg-black flex-1 flex items-center justify-center min-h-[280px] overflow-hidden">
              {capturedPhotoUrl ? (
                <img
                  src={capturedPhotoUrl}
                  alt={fr.dossierModule.camera.previewTitle}
                  className="w-full h-auto max-h-[60vh] object-contain"
                />
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Cadre de guidage superposé */}
                  <div className="absolute inset-6 border-2 border-dashed border-white/80 rounded-lg pointer-events-none flex flex-col justify-between p-2 shadow-sm">
                    <span className="text-[10px] bg-black/60 px-2 py-0.5 rounded text-white self-center">
                      {fr.dossierModule.camera.guideText}
                    </span>
                    <div className="w-full flex justify-between text-[10px] text-white/70">
                      <span>USMBA</span>
                      <span>{cameraActivePiece.toUpperCase()}</span>
                    </div>
                  </div>
                </>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Actions Caméra */}
            <div className="p-3 bg-slate-950 flex items-center justify-between gap-2">
              {capturedPhotoUrl ? (
                <>
                  <button
                    type="button"
                    onClick={retakePhoto}
                    className="flex-1 min-h-[42px] bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw size={15} />
                    <span>{fr.dossierModule.actions.retakePhoto}</span>
                  </button>
                  <button
                    type="button"
                    onClick={validateCapturedPhoto}
                    className="flex-1 min-h-[42px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 size={15} />
                    <span>{fr.dossierModule.actions.validatePhoto}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Camera size={16} />
                  <span>{fr.dossierModule.camera.capture}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
