import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, MapPin, CheckCircle2, AlertCircle, Award, XCircle } from 'lucide-react';
import { Creneau, CreneauStatut, Candidat, PV, dossierComplet } from '../types';
import { fr } from '../i18n/fr';
import { storageService } from '../services/storage';
import { logEvent } from '../utils/journal';

const STORAGE_KEY_CRENEAUX = 'usmba_doctorat_creneaux';
const STORAGE_KEY_CANDIDAT = 'usmba_doctorat_candidat';

interface EntretiensProps {
  candidat?: Candidat;
  onNavigate?: (tab: any) => void;
}

function formatDateJJMMAAAA(input?: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [yyyy, mm, dd] = trimmed.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return trimmed;
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export const Entretiens: React.FC<EntretiensProps> = ({
  candidat: propsCandidat,
  onNavigate,
}) => {
  const [candidat, setCandidat] = useState<Candidat>(() => {
    if (propsCandidat) return propsCandidat;
    try {
      const rawCand = localStorage.getItem(STORAGE_KEY_CANDIDAT);
      if (rawCand) return JSON.parse(rawCand);
      return storageService.getCandidat();
    } catch {
      return storageService.getCandidat();
    }
  });
  const [creneaux, setCreneaux] = useState<Creneau[]>([]);
  const [pvs, setPvs] = useState<PV[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (propsCandidat) {
      setCandidat(propsCandidat);
    }
  }, [propsCandidat]);

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('usmba_pvs_updated', handleSync);
    window.addEventListener('usmba_creneaux_updated', handleSync);
    window.addEventListener('usmba_candidat_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('usmba_pvs_updated', handleSync);
      window.removeEventListener('usmba_creneaux_updated', handleSync);
      window.removeEventListener('usmba_candidat_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const loadData = () => {
    try {
      const rawCand = localStorage.getItem(STORAGE_KEY_CANDIDAT);
      if (rawCand) {
        setCandidat(JSON.parse(rawCand));
      } else if (propsCandidat) {
        setCandidat(propsCandidat);
      } else {
        setCandidat(storageService.getCandidat());
      }
    } catch {
      setCandidat(propsCandidat || storageService.getCandidat());
    }

    try {
      const rawCr = localStorage.getItem(STORAGE_KEY_CRENEAUX);
      if (rawCr) {
        setCreneaux(JSON.parse(rawCr));
      } else {
        setCreneaux(storageService.getCreneaux());
      }
    } catch {
      setCreneaux(storageService.getCreneaux());
    }

    try {
      const rawPvs = localStorage.getItem('usmba_doctorat_pvs');
      if (rawPvs) {
        setPvs(JSON.parse(rawPvs));
      } else {
        setPvs([]);
      }
    } catch {
      setPvs([]);
    }
  };

  // Un candidat est « retenu » s'il a au moins une candidature de statut 'retenue'
  const candidaturesStatuts = candidat.candidaturesStatuts || {};
  const retainedSujetIds = Object.keys(candidaturesStatuts).filter(
    (id) => candidaturesStatuts[id] === 'retenue'
  );
  const isRetenu = retainedSujetIds.length > 0;

  // Sauvegarde des créneaux dans localStorage
  const saveCreneaux = (updatedList: Creneau[]): boolean => {
    try {
      localStorage.setItem(STORAGE_KEY_CRENEAUX, JSON.stringify(updatedList));
      setCreneaux(updatedList);
      setErrorMsg(null);
      window.dispatchEvent(new CustomEvent('usmba_creneaux_updated'));
      window.dispatchEvent(new CustomEvent('storage'));
      return true;
    } catch {
      setErrorMsg(fr.entretiens.storageQuotaError);
      return false;
    }
  };

  // Mon créneau actif (convoqué ou convocation reçue), sinon dernière absence constatée
  const activeCreneau = creneaux.find(
    (c) =>
      c.candidatId === candidat.id &&
      (c.statut === 'reserve' || c.statut === 'confirme')
  );
  const absentCreneau = [...creneaux]
    .reverse()
    .find(
      (c) =>
        c.candidatId === candidat.id &&
        (c.statut === 'absent' || c.presence === 'absent')
    );
  const monCreneau = activeCreneau || absentCreneau;

  // Entretien où le candidat a été constaté présent par le directeur
  const creneauPresent = creneaux.find(
    (c) =>
      c.candidatId === candidat.id &&
      c.presence === 'present'
  );

  // Recherche du PV publié contenant le résultat de ce candidat
  const publishedPv = pvs.find(
    (pv) =>
      Boolean(pv.publieLe) &&
      pv.resultats?.some(
        (r) =>
          r.candidatId === candidat.id ||
          (creneauPresent && r.creneauId === creneauPresent.id)
      )
  );

  const monResultat = publishedPv
    ? publishedPv.resultats.find(
        (r) =>
          r.candidatId === candidat.id ||
          (creneauPresent && r.creneauId === creneauPresent.id)
      )
    : undefined;

  const formatDatePublication = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return `${d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })} à ${d.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } catch {
      return isoString;
    }
  };

  // Confirmer sa présence en 1 clic
  const handleConfirm = () => {
    if (!monCreneau) return;

    let currentList = creneaux;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CRENEAUX);
      if (raw) currentList = JSON.parse(raw);
    } catch {
      // fallback
    }

    const nowIso = new Date().toISOString();
    const updated = currentList.map((c) => {
      if (c.id === monCreneau.id) {
        return {
          ...c,
          statut: 'confirme' as CreneauStatut,
          dateConfirmation: nowIso,
        };
      }
      return c;
    });

    if (!saveCreneaux(updated)) return;

    const fullName =
      candidat.nomFamille?.trim() && candidat.prenom?.trim()
        ? `${candidat.prenom.trim()} ${candidat.nomFamille.trim()}`
        : candidat.nom || candidat.email || fr.dossier.nonRenseigne;

    logEvent(
      { id: candidat.id, nom: fullName, role: 'candidat' },
      fr.journalActions.convocationRecue,
      `${formatDateJJMMAAAA(monCreneau.date)} à ${monCreneau.heure}`
    );
  };

  // Calcul de l'étape en cours pour le candidat
  const { etapeNumero, etapeLibelle } = useMemo(() => {
    try {
      const candidatures = Array.isArray(candidat?.candidatures) ? candidat.candidatures : [];
      if (candidatures.length === 0) {
        return { etapeNumero: null, etapeLibelle: null };
      }

      const currentCandidatId = candidat?.id || '';
      const statuts = candidat?.candidaturesStatuts || {};

      // Étape 1 : Dossier complet
      const step1Done = Boolean(dossierComplet(candidat)?.complet);

      // Étape 2 : Candidature envoyée
      const step2Done = candidatures.some((id) => {
        const st = statuts[id];
        return Boolean(st && st !== 'brouillon');
      });

      // Étape 3 : Validée (≥1 candidature retenue)
      const step3Done = Object.values(statuts).some((st) => st === 'retenue');

      // Étape 4 : Entretien (terminée uniquement quand le directeur constate la présence)
      const step4Done =
        Boolean(currentCandidatId) &&
        Array.isArray(creneaux) &&
        creneaux.some((c) => c?.candidatId === currentCandidatId && c?.presence === 'present');

      // Étape 5 : Résultat (PV publié avec résultat)
      const pubPv = Array.isArray(pvs)
        ? pvs.find(
            (pv) =>
              Boolean(pv?.publieLe) &&
              Boolean(currentCandidatId) &&
              pv?.resultats?.some((r) => r?.candidatId === currentCandidatId)
          )
        : undefined;
      const res = pubPv?.resultats?.find(
        (r) => Boolean(currentCandidatId) && r?.candidatId === currentCandidatId
      );
      const step5Done = Boolean(res);

      // Étape 6 : Inscription
      const step6Done = false;

      const rawDones = [step1Done, step2Done, step3Done, step4Done, step5Done, step6Done];
      const firstNonDoneIndex = rawDones.findIndex((done) => !done);
      const num = firstNonDoneIndex === -1 ? 6 : firstNonDoneIndex + 1;

      const CLES = ['dossier', 'candidature', 'validee', 'entretien', 'resultat', 'inscription'] as const;
      const cle = CLES[num - 1];
      const nom = cle && fr?.progression?.steps?.[cle]?.nom ? fr.progression.steps[cle].nom : undefined;

      return { etapeNumero: num, etapeLibelle: nom };
    } catch {
      return { etapeNumero: 1, etapeLibelle: undefined };
    }
  }, [candidat, creneaux, pvs]);

  const entretienLineText = monCreneau
    ? fr.entretiens.entretienLine
        .replace('{date}', formatDateJJMMAAAA(monCreneau.date))
        .replace('{heure}', monCreneau.heure)
        .replace('{lieu}', monCreneau.lieu)
    : '';

  return (
    <div className="space-y-4">
      {/* 1. Ligne de progression : Étape N/6 : [libellé] + lien Voir ma progression */}
      {etapeNumero !== null && (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-xs flex items-center justify-between gap-3 text-xs flex-wrap">
          <span className="font-semibold text-slate-800">
            {etapeLibelle
              ? `Étape ${etapeNumero}/6 : ${etapeLibelle}`
              : `Étape ${etapeNumero}/6`}
          </span>
          <button
            type="button"
            onClick={() => onNavigate?.('dossier')}
            className="text-emerald-700 hover:text-emerald-800 font-semibold underline underline-offset-2 hover:no-underline focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 rounded transition-colors cursor-pointer"
          >
            {fr.entretiens.voirMaProgression}
          </button>
        </div>
      )}

      {/* En-tête */}
      <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-amber-300">
            {fr.entretiens.title}
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            {fr.entretiens.myInterviewTitle}
          </p>
        </div>
        <div className="w-9 h-9 rounded-lg bg-slate-800 text-amber-300 flex items-center justify-center">
          <Calendar size={18} />
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Carte « Mon résultat » uniquement après présence constatée (ou résultat publié) */}
      {(Boolean(creneauPresent) || Boolean(publishedPv && monResultat)) && (
        <div id="mon-resultat" className="bg-white border-2 border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <Award size={15} className="text-amber-500" />
              <span>{fr.entretiens.myResultTitle}</span>
            </h3>

            {!publishedPv || !monResultat ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                <Clock size={13} className="text-slate-500 shrink-0" />
                <span>{fr.entretiens.resultPendingPublication}</span>
              </span>
            ) : (
              <>
                {monResultat.resultat === 'ADMIS' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span>{fr.entretiens.listePrincipaleBadge}</span>
                  </span>
                )}
                {monResultat.resultat === 'LISTE_COMPLEMENTAIRE' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    <Clock size={13} className="text-amber-600 shrink-0" />
                    <span>{fr.entretiens.listeAttenteBadge}</span>
                  </span>
                )}
                {monResultat.resultat === 'REFUSE' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                    <XCircle size={13} className="text-rose-600 shrink-0" />
                    <span>{fr.entretiens.refuseBadge}</span>
                  </span>
                )}
              </>
            )}
          </div>

          {!publishedPv || !monResultat ? (
            <p className="text-xs text-slate-500">
              {fr.entretiens.resultPendingHint}
            </p>
          ) : (
            <div className="space-y-3 pt-1">
              {monResultat.resultat === 'ADMIS' && (
                <div className="space-y-2.5">
                  <p className="text-xs text-emerald-950 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 font-medium">
                    {fr.entretiens.admisPaperDossierMessage}
                  </p>
                  <p className="text-xs text-slate-700 font-medium">
                    {fr.entretiens.admisNextStep}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent('usmba_navigate_tab', { detail: 'dossier' })
                      );
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <span>{fr.entretiens.btnGoToDossier}</span>
                    <span>→</span>
                  </button>
                </div>
              )}

              {monResultat.resultat === 'LISTE_COMPLEMENTAIRE' && (
                <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-2.5 font-medium">
                  {fr.entretiens.listeAttenteNotice}
                </p>
              )}

              {monResultat.resultat === 'REFUSE' && (
                <p className="text-xs text-rose-900 bg-rose-50 border border-rose-200 rounded-xl p-2.5 font-medium">
                  <span className="font-bold">{fr.entretiens.motifPrefix}</span>{' '}
                  {monResultat.motif || fr.entretiens.motifNonPrecise}
                </p>
              )}

              {publishedPv.publieLe && (
                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                  <span>
                    {fr.entretiens.publishedOn} {formatDatePublication(publishedPv.publieLe)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Convocation directe du candidat */}
      {monCreneau ? (
        <div className="bg-white border-2 border-emerald-600 rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <Calendar size={15} className="text-emerald-700" />
              <span>{fr.entretiens.myInterviewTitle}</span>
            </h3>

            {monCreneau.presence === 'present' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>{fr.entretiens.statutPresent}</span>
              </span>
            ) : monCreneau.statut === 'absent' || monCreneau.presence === 'absent' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                <XCircle size={13} className="text-rose-600 shrink-0" />
                <span>{fr.entretiens.statutAbsent}</span>
              </span>
            ) : monCreneau.statut === 'confirme' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>{fr.entretiens.statutConfirme}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                <Clock size={13} className="text-amber-600 shrink-0" />
                <span>{fr.entretiens.statutConvoque}</span>
              </span>
            )}
          </div>

          <div className="space-y-1.5 text-xs text-slate-800 bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="font-bold text-slate-900 flex items-center gap-1.5">
              <MapPin size={13} className="text-emerald-700 shrink-0" />
              <span>{entretienLineText}</span>
            </p>

            {monCreneau.presence === 'present' && (
              <p className="font-semibold text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 size={13} className="shrink-0" />
                <span>{fr.entretiens.presentNotice}</span>
              </p>
            )}

            {monCreneau.presence !== 'present' &&
              monCreneau.statut !== 'absent' &&
              monCreneau.presence !== 'absent' &&
              monCreneau.statut === 'confirme' && (
                <p className="font-semibold text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="shrink-0" />
                  <span>{fr.entretiens.confirmedNotice}</span>
                </p>
              )}

            {(monCreneau.statut === 'absent' || monCreneau.presence === 'absent') && (
              <div className="space-y-1 pt-0.5">
                <p className="font-semibold text-rose-700 flex items-center gap-1.5">
                  <XCircle size={13} className="shrink-0" />
                  <span>{fr.entretiens.absentNotice}</span>
                </p>
                {monCreneau.absenceMotif && (
                  <p className="text-[11px] text-slate-600 italic">
                    {fr.entretiens.motifPrefix} {monCreneau.absenceMotif}
                  </p>
                )}
              </div>
            )}
          </div>

          {monCreneau.statut === 'reserve' && monCreneau.presence !== 'present' && (
            <div className="pt-1">
              <button
                type="button"
                onClick={handleConfirm}
                className="min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} />
                <span>{fr.entretiens.btnConfirmPresence}</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-center space-y-3 shadow-xs">
          <div className="w-11 h-11 mx-auto rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
            <Calendar size={22} />
          </div>
          <p className="text-sm font-medium text-slate-700 max-w-md mx-auto">
            {isRetenu
              ? fr.entretiens.noConvocationNotice
              : fr.entretiens.notRetainedNotice}
          </p>
        </div>
      )}
    </div>
  );
};

