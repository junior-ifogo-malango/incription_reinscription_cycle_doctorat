import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Eye,
  X,
  ExternalLink,
  FileText,
  GraduationCap,
  BookOpen,
  Send,
} from 'lucide-react';
import { Candidat, Sujet, Piece, AnomalieCandidature, Notification, dossierComplet } from '../types';
import { INITIAL_SUJETS, MOCK_CANDIDATS } from '../data/mockData';
import { fr } from '../i18n/fr';
import { lireJournal, logEvent } from '../utils/journal';

export interface DossierDirecteurProps {
  candidatId: string;
  onRetour: () => void;
  enseignantId?: string;
}

function findCandidate(id: string): Candidat | null {
  if (!id) return null;
  try {
    const rawOverrides = localStorage.getItem('usmba_candidats_overrides');
    if (rawOverrides) {
      const overrides: Record<string, Candidat> = JSON.parse(rawOverrides);
      if (overrides[id]) return overrides[id];
    }
  } catch {}
  try {
    const rawCur = localStorage.getItem('usmba_doctorat_candidat');
    if (rawCur) {
      const cur: Candidat = JSON.parse(rawCur);
      if (cur.id === id) return cur;
    }
  } catch {}
  try {
    const rawAccounts = localStorage.getItem('usmba_registered_accounts');
    if (rawAccounts) {
      const accounts: Candidat[] = JSON.parse(rawAccounts);
      const found = accounts.find((a) => a.id === id);
      if (found) return found;
    }
  } catch {}
  const mock = MOCK_CANDIDATS.find((c) => c.id === id);
  if (mock) return mock;
  return null;
}

function persistCandidate(cand: Candidat): void {
  try {
    const rawOverrides = localStorage.getItem('usmba_candidats_overrides');
    const overrides: Record<string, Candidat> = rawOverrides ? JSON.parse(rawOverrides) : {};
    overrides[cand.id] = cand;
    localStorage.setItem('usmba_candidats_overrides', JSON.stringify(overrides));

    const rawCur = localStorage.getItem('usmba_doctorat_candidat');
    if (rawCur) {
      const cur: Candidat = JSON.parse(rawCur);
      if (cur.id === cand.id) {
        localStorage.setItem('usmba_doctorat_candidat', JSON.stringify(cand));
      }
    }

    const rawAccounts = localStorage.getItem('usmba_registered_accounts');
    if (rawAccounts) {
      const accounts: Candidat[] = JSON.parse(rawAccounts);
      const idx = accounts.findIndex((a) => a.id === cand.id);
      if (idx !== -1) {
        accounts[idx] = cand;
        localStorage.setItem('usmba_registered_accounts', JSON.stringify(accounts));
      }
    }
    window.dispatchEvent(new CustomEvent('usmba_candidat_updated', { detail: cand }));
  } catch {}
}

function openPdfInNewTab(dataUrl: string): void {
  try {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const blob = new Blob([u8arr], { type: mime });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch {
    // Échec sans plantage
  }
}

function isPdfData(data?: string): boolean {
  if (!data || typeof data !== 'string') return false;
  return data.startsWith('data:application/pdf') || data.toLowerCase().endsWith('.pdf');
}

function isImageData(data?: string): boolean {
  if (!data || typeof data !== 'string') return false;
  return (
    data.startsWith('data:image') ||
    data.includes('.svg') ||
    data.match(/\.(png|jpe?g|webp|gif)$/i) !== null
  );
}

export const DossierDirecteur: React.FC<DossierDirecteurProps> = ({
  candidatId,
  onRetour,
  enseignantId = 'ens-1',
}) => {
  const [candidat, setCandidat] = useState<Candidat | null>(() => findCandidate(candidatId));
  const [feedback, setFeedback] = useState<string | null>(null);

  // Aperçu pièce plein écran
  const [viewingPiece, setViewingPiece] = useState<{ titre: string; fichier: string } | null>(null);
  const [pieceIllisible, setPieceIllisible] = useState<boolean>(false);

  // Modale "Demander de compléter"
  const [showDemandeModal, setShowDemandeModal] = useState<boolean>(false);
  const [demandePiece, setDemandePiece] = useState<'CURSUS' | 'CIN' | 'CV'>('CIN');
  const [demandeMotif, setDemandeMotif] = useState<string>('');
  const [demandeError, setDemandeError] = useState<string | null>(null);

  // Synchronisation des données
  useEffect(() => {
    const cand = findCandidate(candidatId);
    setCandidat(cand);
  }, [candidatId]);

  // Tous les sujets
  const allSujets: Sujet[] = useMemo(() => {
    try {
      const raw = localStorage.getItem('usmba_doctorat_sujets');
      if (raw) return JSON.parse(raw);
    } catch {}
    return INITIAL_SUJETS;
  }, []);

  // Enseignant actif pour l'attribution et les logs
  const activeTeacher = useMemo(() => {
    try {
      const raw = localStorage.getItem('usmba_active_account');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.id || parsed.enseignantId) {
          return {
            id: parsed.enseignantId || parsed.id,
            nom: parsed.nom || 'Pr. Karim El Amrani',
          };
        }
      }
    } catch {}
    return { id: enseignantId, nom: 'Pr. Karim El Amrani' };
  }, [enseignantId]);

  // Vérification de complétude
  const check = useMemo(() => dossierComplet(candidat), [candidat]);

  // Sujet de ce directeur concerné par la candidature
  const directorSujet = useMemo(() => {
    if (!candidat?.candidatures) return null;
    return allSujets.find(
      (s) => (s.enseignantId === activeTeacher.id || s.enseignantId === enseignantId) && candidat.candidatures.includes(s.id)
    ) || allSujets.find((s) => candidat.candidatures.includes(s.id)) || null;
  }, [candidat, allSujets, activeTeacher, enseignantId]);

  // Sujets choisis ordonnés : celui de ce directeur en premier
  const sujetsOrdonnes: Sujet[] = useMemo(() => {
    if (!candidat?.candidatures || candidat.candidatures.length === 0) return [];
    const candidaturesSujets = candidat.candidatures
      .map((id) => allSujets.find((s) => s.id === id))
      .filter((s): s is Sujet => Boolean(s));

    return candidaturesSujets.sort((a, b) => {
      const aIsMine = a.enseignantId === activeTeacher.id || a.enseignantId === enseignantId;
      const bIsMine = b.enseignantId === activeTeacher.id || b.enseignantId === enseignantId;
      if (aIsMine && !bIsMine) return -1;
      if (!aIsMine && bIsMine) return 1;
      return 0;
    });
  }, [candidat, allSujets, activeTeacher, enseignantId]);

  // Récupération des pièces du candidat
  const pieces = useMemo(() => {
    return Array.isArray(candidat?.pieces) ? candidat!.pieces : [];
  }, [candidat]);

  const cinPiece = useMemo(() => {
    return pieces.find((p) => p && p.type && p.type.toUpperCase() === 'CIN');
  }, [pieces]);

  const cvPiece = useMemo(() => {
    return pieces.find((p) => p && p.type && p.type.toUpperCase() === 'CV');
  }, [pieces]);

  const diplomePiece = useMemo(() => {
    return pieces.find((p) => p && p.type && p.type.toUpperCase() === 'DIPLOME');
  }, [pieces]);

  const relevesPiece = useMemo(() => {
    return pieces.find((p) => p && p.type && p.type.toUpperCase() === 'RELEVES');
  }, [pieces]);

  // Statuts des 3 lignes de contrôle
  const cursusApogeeOk = Boolean(
    candidat?.cursus ||
    (diplomePiece && diplomePiece.source === 'apogee' && diplomePiece.statut === 'prouvee') ||
    (candidat?.dossier?.casParticulier && Boolean(candidat.dossier?.motif))
  );

  const cinOk = Boolean(cinPiece && (cinPiece.statut === 'prouvee' || cinPiece.fichier));
  const cvOk = Boolean(cvPiece && (cvPiece.statut === 'prouvee' || cvPiece.fichier));

  // 5 dernières actions du journal concernant ce candidat
  const historique = useMemo(() => {
    if (!candidat) return [];
    const all = lireJournal();
    const candId = (candidat.id || '').toLowerCase();
    const candNom = (candidat.nom || '').toLowerCase();

    const matches = all.filter((e) => {
      const c = (e.cible || '').toLowerCase();
      const d = (e.detail || '').toLowerCase();
      const nom = (e.acteurNom || '').toLowerCase();
      const id = (e.acteurId || '').toLowerCase();
      return (
        (candId && (c.includes(candId) || d.includes(candId) || id === candId)) ||
        (candNom && (c.includes(candNom) || d.includes(candNom) || nom === candNom))
      );
    });

    return matches.slice(0, 5);
  }, [candidat]);

  // Action : Valider la candidature
  const handleValider = () => {
    if (!candidat || !check.complet || !directorSujet) return;

    const updatedStatuts = {
      ...(candidat.candidaturesStatuts || {}),
      [directorSujet.id]: 'retenue' as const,
    };

    const updatedCand: Candidat = {
      ...candidat,
      candidaturesStatuts: updatedStatuts,
    };

    persistCandidate(updatedCand);
    setCandidat(updatedCand);

    try {
      const rawSim = localStorage.getItem('usmba_simulated_statuts');
      const parsed = rawSim ? JSON.parse(rawSim) : {};
      parsed[`${candidat.id}-${directorSujet.id}`] = 'retenue';
      localStorage.setItem('usmba_simulated_statuts', JSON.stringify(parsed));
    } catch {}

    logEvent(
      { id: activeTeacher.id, nom: activeTeacher.nom, role: 'enseignant' },
      fr.journalActions.candidatureValidee,
      `${candidat.nom} (${directorSujet.titre})`
    );

    setFeedback(fr.dossierDirecteur.candidatureValideeToast);
    setTimeout(() => setFeedback(null), 4000);
  };

  // Action : Demander de compléter le dossier
  const handleDemanderCompleterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidat) return;

    if (demandeMotif.trim().length < 5) {
      setDemandeError(fr.sujetsModule.modalAnomalieMotifError);
      return;
    }

    const nowIso = new Date().toISOString();
    const anomalieObj: AnomalieCandidature = {
      piece: demandePiece,
      nature: 'absente',
      motif: demandeMotif.trim(),
      le: nowIso,
    };

    const updatedPieces = pieces.map((p) => {
      if (demandePiece === 'CIN' && p.type.toUpperCase() === 'CIN') {
        return { ...p, statut: 'absente' as const };
      }
      if (demandePiece === 'CV' && p.type.toUpperCase() === 'CV') {
        return { ...p, statut: 'absente' as const };
      }
      if (demandePiece === 'CURSUS' && p.type.toUpperCase() === 'DIPLOME') {
        return { ...p, statut: 'absente' as const };
      }
      return p;
    });

    const targetSujetId = directorSujet ? directorSujet.id : (candidat.candidatures?.[0] || 'suj-01');

    const updatedCand: Candidat = {
      ...candidat,
      pieces: updatedPieces,
      ...(demandePiece === 'CURSUS' ? { cursus: undefined } : {}),
      candidaturesStatuts: {
        ...(candidat.candidaturesStatuts || {}),
        [targetSujetId]: 'a_corriger',
      },
      candidaturesAnomalies: {
        ...(candidat.candidaturesAnomalies || {}),
        [targetSujetId]: anomalieObj,
      },
      anomalie: anomalieObj,
    };

    persistCandidate(updatedCand);
    setCandidat(updatedCand);

    try {
      const rawSim = localStorage.getItem('usmba_simulated_statuts');
      const parsed = rawSim ? JSON.parse(rawSim) : {};
      parsed[`${candidat.id}-${targetSujetId}`] = 'a_corriger';
      localStorage.setItem('usmba_simulated_statuts', JSON.stringify(parsed));
    } catch {}

    try {
      const rawNotifs = localStorage.getItem('usmba_notifications');
      const notifs: Notification[] = rawNotifs ? JSON.parse(rawNotifs) : [];
      notifs.unshift({
        id: `notif-demande-${Date.now()}`,
        destinataireId: candidat.id,
        texte: `Demande de complétion pour votre dossier (${demandePiece}) : ${demandeMotif.trim()}`,
        date: nowIso,
        lue: false,
        type: 'action',
        actionLabel: fr.notifications.btnCompleterDossier,
        actionTab: 'dossier',
      });
      localStorage.setItem('usmba_notifications', JSON.stringify(notifs));
      window.dispatchEvent(new CustomEvent('usmba_notifications_updated'));
    } catch {}

    logEvent(
      { id: activeTeacher.id, nom: activeTeacher.nom, role: 'enseignant' },
      fr.journalActions.anomalieSignalee,
      `${candidat.nom} : ${demandePiece} - ${demandeMotif.trim()}`
    );

    setFeedback(fr.dossierDirecteur.demandeEnvoyeeToast);
    setTimeout(() => setFeedback(null), 4000);
    setShowDemandeModal(false);
    setDemandeMotif('');
    setDemandeError(null);
  };

  // Cas d'erreur : candidat introuvable
  if (!candidat) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto p-4">
        <button
          type="button"
          onClick={onRetour}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
        >
          <ArrowLeft size={14} />
          <span>{fr.dossierDirecteur.btnRetour}</span>
        </button>
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500 font-medium">
          {fr.dossierDirecteur.aucuneDonnee}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-8">
      {/* a) En-tête : Bouton "← Candidatures", nom, CNE, CIN */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={onRetour}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer active:scale-98"
          >
            <ArrowLeft size={15} />
            <span>{fr.dossierDirecteur.btnRetour}</span>
          </button>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Évaluation candidat
          </span>
        </div>

        <div className="pt-1 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-t border-slate-100">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              {candidat.nom || fr.dossierDirecteur.aucuneDonnee}
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-600 mt-1 flex-wrap">
              <span>
                CNE :{' '}
                <strong className="font-mono text-slate-900">
                  {candidat.cne || fr.dossierDirecteur.aucuneDonnee}
                </strong>
              </span>
              <span>•</span>
              <span>
                CIN :{' '}
                <strong className="font-mono text-slate-900">
                  {candidat.cin || fr.dossierDirecteur.aucuneDonnee}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedback && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl p-3 text-xs flex items-center gap-2 shadow-xs">
          <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* b) Verdict : "Dossier complet" ou "Dossier incomplet : [manques]" + Boutons */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            {check.complet ? (
              <div className="flex items-center gap-2 text-emerald-800">
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                <span className="text-sm font-bold">{fr.dossierDirecteur.verdictComplet}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-900">
                <AlertTriangle size={20} className="text-amber-600 shrink-0" />
                <span className="text-sm font-bold">
                  {fr.dossierDirecteur.verdictIncomplet.replace('{manques}', check.manques.join(', '))}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Bouton Valider */}
            {check.complet ? (
              <button
                type="button"
                onClick={handleValider}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white transition cursor-pointer shadow-xs active:scale-98"
              >
                {fr.dossierDirecteur.btnValider}
              </button>
            ) : (
              <button
                type="button"
                disabled
                title={fr.dossierDirecteur.btnValiderIncomplet.replace('{manques}', check.manques.join(', '))}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
              >
                {fr.dossierDirecteur.btnValiderIncomplet.replace('{manques}', check.manques.join(', '))}
              </button>
            )}

            {/* Bouton Demander de compléter (visible si incomplet) */}
            {!check.complet && (
              <button
                type="button"
                onClick={() => {
                  const firstManque = check.manques[0];
                  if (firstManque === 'Cursus Apogée') setDemandePiece('CURSUS');
                  else if (firstManque === 'CIN') setDemandePiece('CIN');
                  else setDemandePiece('CV');
                  setShowDemandeModal(true);
                  setDemandeMotif('');
                  setDemandeError(null);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition cursor-pointer shadow-xs active:scale-98 flex items-center gap-1.5"
              >
                <AlertTriangle size={14} />
                <span>{fr.dossierDirecteur.btnDemanderCompleter}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* c) Contrôle : 3 lignes Cursus Apogée, CIN, CV */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {fr.dossierDirecteur.controleTitre}
        </h2>

        <div className="divide-y divide-slate-100 border border-slate-200/70 rounded-xl overflow-hidden bg-slate-50/50">
          {/* Ligne 1 : Cursus Apogée */}
          <div className="p-3.5 flex items-center justify-between gap-3 bg-white">
            <div className="flex items-center gap-3 min-w-0">
              {cursusApogeeOk ? (
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              ) : (
                <XCircle size={18} className="text-rose-500 shrink-0" />
              )}
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-900 block truncate">
                  {fr.dossierDirecteur.cursusApogee}
                </span>
                <span
                  className={`text-[11px] font-semibold ${
                    cursusApogeeOk ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {cursusApogeeOk
                    ? fr.dossierDirecteur.statutVerifieeApogee
                    : fr.dossierDirecteur.statutManquante}
                </span>
              </div>
            </div>

            {diplomePiece?.fichier ? (
              <button
                type="button"
                onClick={() => {
                  setPieceIllisible(false);
                  setViewingPiece({
                    titre: fr.dossierDirecteur.cursusApogee,
                    fichier: diplomePiece.fichier!,
                  });
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer flex items-center gap-1 active:scale-98 shrink-0"
              >
                <Eye size={13} className="text-slate-500" />
                <span>{fr.dossierDirecteur.btnVoir}</span>
              </button>
            ) : null}
          </div>

          {/* Ligne 2 : CIN */}
          <div className="p-3.5 flex items-center justify-between gap-3 bg-white">
            <div className="flex items-center gap-3 min-w-0">
              {cinOk ? (
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              ) : (
                <XCircle size={18} className="text-rose-500 shrink-0" />
              )}
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-900 block truncate">
                  {fr.dossierDirecteur.cin}
                </span>
                <span
                  className={`text-[11px] font-semibold ${
                    cinOk ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {cinOk
                    ? fr.dossierDirecteur.statutPreuveFournie
                    : fr.dossierDirecteur.statutManquante}
                </span>
              </div>
            </div>

            {cinPiece?.fichier ? (
              <button
                type="button"
                onClick={() => {
                  setPieceIllisible(false);
                  setViewingPiece({
                    titre: fr.dossierDirecteur.cin,
                    fichier: cinPiece.fichier!,
                  });
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer flex items-center gap-1 active:scale-98 shrink-0"
              >
                <Eye size={13} className="text-slate-500" />
                <span>{fr.dossierDirecteur.btnVoir}</span>
              </button>
            ) : null}
          </div>

          {/* Ligne 3 : CV */}
          <div className="p-3.5 flex items-center justify-between gap-3 bg-white">
            <div className="flex items-center gap-3 min-w-0">
              {cvOk ? (
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              ) : (
                <XCircle size={18} className="text-rose-500 shrink-0" />
              )}
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-900 block truncate">
                  {fr.dossierDirecteur.cv}
                </span>
                <span
                  className={`text-[11px] font-semibold ${
                    cvOk ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {cvOk
                    ? fr.dossierDirecteur.statutPreuveFournie
                    : fr.dossierDirecteur.statutManquante}
                </span>
              </div>
            </div>

            {cvPiece?.fichier ? (
              <button
                type="button"
                onClick={() => {
                  setPieceIllisible(false);
                  setViewingPiece({
                    titre: fr.dossierDirecteur.cv,
                    fichier: cvPiece.fichier!,
                  });
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer flex items-center gap-1 active:scale-98 shrink-0"
              >
                <Eye size={13} className="text-slate-500" />
                <span>{fr.dossierDirecteur.btnVoir}</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* d) Cursus : diplômes et relevés en liste simple, si présents */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {fr.dossierDirecteur.cursusTitre}
        </h2>

        {candidat.cursus || diplomePiece?.fichier || relevesPiece?.fichier || candidat.dossier?.casParticulier ? (
          <ul className="space-y-2 text-xs text-slate-800">
            {candidat.cursus?.diplome && (
              <li className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <GraduationCap size={16} className="text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">{candidat.cursus.diplome}</span>
                  {(candidat.cursus.etablissement || candidat.cursus.anneeObtention || candidat.cursus.mention) && (
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {[
                        candidat.cursus.etablissement,
                        candidat.cursus.anneeObtention ? `Promotion ${candidat.cursus.anneeObtention}` : null,
                        candidat.cursus.mention ? `Mention ${candidat.cursus.mention}` : null,
                      ]
                        .filter(Boolean)
                        .join(' — ')}
                    </p>
                  )}
                </div>
              </li>
            )}

            {diplomePiece?.fichier && !candidat.cursus?.diplome && (
              <li className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <div className="flex items-center gap-2">
                  <FileText size={15} className="text-slate-500 shrink-0" />
                  <span>Dernier diplôme fourni</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPieceIllisible(false);
                    setViewingPiece({
                      titre: 'Dernier diplôme',
                      fichier: diplomePiece.fichier!,
                    });
                  }}
                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                >
                  {fr.dossierDirecteur.btnVoir}
                </button>
              </li>
            )}

            {relevesPiece?.fichier && (
              <li className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <div className="flex items-center gap-2">
                  <FileText size={15} className="text-slate-500 shrink-0" />
                  <span>Relevés de notes universitaires</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPieceIllisible(false);
                    setViewingPiece({
                      titre: 'Relevés de notes',
                      fichier: relevesPiece.fichier!,
                    });
                  }}
                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                >
                  {fr.dossierDirecteur.btnVoir}
                </button>
              </li>
            )}

            {candidat.dossier?.casParticulier && (
              <li className="flex items-start gap-2 p-2.5 rounded-xl bg-purple-50 border border-purple-200/60 text-purple-900">
                <AlertCircle size={15} className="text-purple-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Cas particulier déclaré : </span>
                  <span>{candidat.dossier.motifAutre || candidat.dossier.motif || 'Dérogatoire'}</span>
                </div>
              </li>
            )}
          </ul>
        ) : (
          <p className="text-xs text-slate-500 italic p-2">{fr.dossierDirecteur.aucuneDonnee}</p>
        )}
      </div>

      {/* e) Candidature : les 3 sujets choisis, celui de ce directeur en premier */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {fr.dossierDirecteur.candidaturesTitre}
        </h2>

        {sujetsOrdonnes.length > 0 ? (
          <div className="space-y-2.5">
            {sujetsOrdonnes.map((s, index) => {
              const isMine = s.enseignantId === activeTeacher.id || s.enseignantId === enseignantId;
              const statut = candidat.candidaturesStatuts?.[s.id] || 'deposee';

              return (
                <div
                  key={s.id}
                  className={`p-3.5 rounded-xl border transition-colors ${
                    isMine
                      ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-300/40'
                      : 'bg-slate-50/60 border-slate-200/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                          Choix {index + 1}
                        </span>
                        {isMine && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-700 text-white">
                            Votre sujet
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 mt-1 line-clamp-2">
                        {s.titre}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {s.structure}
                      </p>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${
                        statut === 'retenue'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : statut === 'a_corriger'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-sky-50 text-sky-800 border-sky-200'
                      }`}
                    >
                      {statut === 'retenue'
                        ? 'Validée'
                        : statut === 'a_corriger'
                        ? 'À corriger'
                        : 'Déposée'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic p-2">{fr.dossierDirecteur.aucuneDonnee}</p>
        )}
      </div>

      {/* f) Historique : 5 dernières actions du journal concernant ce candidat (date, action) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {fr.dossierDirecteur.historiqueTitre}
        </h2>

        {historique.length > 0 ? (
          <div className="divide-y divide-slate-100 border border-slate-200/70 rounded-xl overflow-hidden bg-slate-50/40">
            {historique.map((evt) => {
              const formattedDate = new Date(evt.date).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div key={evt.id} className="p-3 flex items-start justify-between gap-3 text-xs bg-white">
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900 block truncate">{evt.action}</span>
                    {evt.detail && <span className="text-[11px] text-slate-500 block truncate">{evt.detail}</span>}
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">{formattedDate}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic p-2">{fr.dossierDirecteur.aucuneDonnee}</p>
        )}
      </div>

      {/* 3. Aperçu pièce plein écran */}
      {viewingPiece && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex flex-col p-3 sm:p-6 overflow-hidden">
          <div className="flex items-center justify-between pb-3 text-white border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <h3 className="text-sm sm:text-base font-bold truncate">{viewingPiece.titre}</h3>
              {isPdfData(viewingPiece.fichier) && (
                <button
                  type="button"
                  onClick={() => openPdfInNewTab(viewingPiece.fichier)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                >
                  <ExternalLink size={13} />
                  <span>{fr.dossierDirecteur.ouvrirNouvelOnglet}</span>
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setViewingPiece(null);
                setPieceIllisible(false);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer ml-2"
              aria-label={fr.dossierDirecteur.fermerApercu}
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-2 sm:p-4 overflow-auto">
            {pieceIllisible ? (
              <div className="text-center p-8 bg-slate-900 rounded-2xl text-rose-400 font-medium border border-rose-950">
                <AlertTriangle size={32} className="mx-auto mb-2 text-rose-500" />
                <p>{fr.dossierDirecteur.fichierIllisible}</p>
              </div>
            ) : isPdfData(viewingPiece.fichier) ? (
              <iframe
                src={viewingPiece.fichier}
                title={viewingPiece.titre}
                className="w-full h-full min-h-[75vh] rounded-xl bg-white border border-slate-800 shadow-xl"
                onError={() => setPieceIllisible(true)}
              />
            ) : isImageData(viewingPiece.fichier) ? (
              <img
                src={viewingPiece.fichier}
                alt={viewingPiece.titre}
                onError={() => setPieceIllisible(true)}
                className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-xl bg-slate-900"
              />
            ) : (
              <div className="text-center p-8 bg-slate-900 rounded-2xl text-rose-400 font-medium border border-rose-950">
                <AlertTriangle size={32} className="mx-auto mb-2 text-rose-500" />
                <p>{fr.dossierDirecteur.fichierIllisible}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modale "Demander de compléter" */}
      {showDemandeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {fr.dossierDirecteur.modalDemandeTitre}
                </h3>
                <p className="text-xs text-slate-500">
                  {fr.dossierDirecteur.modalDemandeDesc}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDemandeModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDemanderCompleterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {fr.dossierDirecteur.pieceACompleter}
                </label>
                <select
                  value={demandePiece}
                  onChange={(e) => setDemandePiece(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600"
                >
                  <option value="CURSUS">Cursus Apogée (Diplôme)</option>
                  <option value="CIN">Carte d'Identité Nationale (CIN)</option>
                  <option value="CV">Curriculum Vitae (CV)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {fr.dossierDirecteur.motifLabel}
                </label>
                <textarea
                  value={demandeMotif}
                  onChange={(e) => {
                    setDemandeMotif(e.target.value);
                    setDemandeError(null);
                  }}
                  rows={3}
                  placeholder={fr.dossierDirecteur.motifPlaceholder}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
                {demandeError && (
                  <p className="text-[11px] font-semibold text-rose-600 mt-1">
                    {demandeError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDemandeModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                >
                  {fr.dossierDirecteur.btnAnnuler}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Send size={13} />
                  <span>{fr.dossierDirecteur.btnEnvoyerDemande}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
