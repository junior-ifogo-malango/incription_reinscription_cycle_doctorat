import React, { useState, useEffect, useRef } from 'react';
import { Check, Clock, Lock, ArrowRight, X, ExternalLink, Sparkles, AlertTriangle } from 'lucide-react';
import { fr } from '../i18n/fr';
import { Candidat, Creneau, PV, ProgressionEtapeInfo, dossierComplet } from '../types';
import { storageService } from '../services/storage';
import { ECHEANCES, aujourdhui } from '../data/mockData';

function formatJJMM(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length >= 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return dateStr;
}

function formatJJMMAAAA(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [yyyy, mm, dd] = clean.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    const dd = String(parsed.getDate()).padStart(2, '0');
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const yyyy = parsed.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  return clean;
}

function polarToCartesian(cx: number, cy: number, r: number, angleInDegrees: number) {
  const rad = (angleInDegrees * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArcSegment(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${r} ${r} 0 0 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
}

function getRetardInfo(echeanceStr?: string, dateRef?: string): { enRetard: boolean; jours: number } {
  if (!echeanceStr) return { enRetard: false, jours: 0 };
  const ref = dateRef || aujourdhui();
  if (ref > echeanceStr) {
    const dRef = new Date(ref + 'T00:00:00').getTime();
    const dEch = new Date(echeanceStr + 'T00:00:00').getTime();
    const diff = Math.max(1, Math.round((dRef - dEch) / (1000 * 60 * 60 * 24)));
    return { enRetard: true, jours: diff };
  }
  return { enRetard: false, jours: 0 };
}

interface ProgressionCandidatProps {
  candidatId?: string;
  candidat?: Candidat;
  onNavigate?: (tab: any) => void;
}

export const ProgressionCandidat: React.FC<ProgressionCandidatProps> = ({
  candidatId,
  candidat: propsCandidat,
  onNavigate,
}) => {
  const [candidat, setCandidat] = useState<Candidat | null>(() => {
    if (propsCandidat) return propsCandidat;
    try {
      const rawCand = localStorage.getItem('usmba_doctorat_candidat');
      if (rawCand) return JSON.parse(rawCand);
      return storageService.getCandidat();
    } catch {
      return null;
    }
  });

  const [creneaux, setCreneaux] = useState<Creneau[]>([]);
  const [pvs, setPvs] = useState<PV[]>([]);
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const [dateActuelle, setDateActuelle] = useState<string>(() => aujourdhui());
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerDownRef = useRef<boolean>(false);

  // Synchronisation des données locales
  const loadData = () => {
    setDateActuelle(aujourdhui());
    try {
      const rawCand = localStorage.getItem('usmba_doctorat_candidat');
      if (rawCand) {
        setCandidat(JSON.parse(rawCand));
      } else if (propsCandidat) {
        setCandidat(propsCandidat);
      } else {
        setCandidat(storageService.getCandidat());
      }
    } catch {
      setCandidat(propsCandidat || null);
    }

    try {
      const rawCr = localStorage.getItem('usmba_doctorat_creneaux');
      if (rawCr) {
        setCreneaux(JSON.parse(rawCr));
      } else {
        setCreneaux(storageService.getCreneaux());
      }
    } catch {
      setCreneaux([]);
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

  useEffect(() => {
    if (propsCandidat) {
      setCandidat(propsCandidat);
    }
  }, [propsCandidat]);

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('storage', handleSync);
    window.addEventListener('usmba_demo_date_updated', handleSync);
    window.addEventListener('usmba_pvs_updated', handleSync);
    window.addEventListener('usmba_creneaux_updated', handleSync);
    window.addEventListener('usmba_dossier_updated', handleSync);
    window.addEventListener('usmba_pieces_updated', handleSync);
    window.addEventListener('usmba_candidat_updated', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('usmba_demo_date_updated', handleSync);
      window.removeEventListener('usmba_pvs_updated', handleSync);
      window.removeEventListener('usmba_creneaux_updated', handleSync);
      window.removeEventListener('usmba_dossier_updated', handleSync);
      window.removeEventListener('usmba_pieces_updated', handleSync);
      window.removeEventListener('usmba_candidat_updated', handleSync);
    };
  }, [candidatId]);

  // Fermer l'infobulle au clic extérieur ou avec la touche Échap
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveTooltip(null);
        setHoveredStep(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTooltip(null);
        setHoveredStep(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Candidatures du candidat connecté (sécurisé avec tableau vide par défaut sans planter)
  const candidatures = Array.isArray(candidat?.candidatures) ? candidat.candidatures : [];
  const hasCandidatures = candidatures.length > 0;
  const currentCandidatId = candidat?.id || candidatId || '';

  // --- CALCUL DYNAMIQUE DES 5 ÉTAPES (aucun nouveau stockage) ---
  const candidaturesStatuts = candidat?.candidaturesStatuts || {};
  const hasACorriger = candidatures.some((id) => candidaturesStatuts[id] === 'a_corriger');

  const dateEnvoi =
    candidat?.dossier?.dateEnvoi ||
    (!hasACorriger
      ? candidat?.envoyeLe || Object.values(candidat?.candidaturesEnvoyeLe || {})[0]
      : undefined);

  const hasThreeSubjects = candidatures.length >= 3;
  const hasCompleteDossier = dossierComplet(candidat).complet;
  const hasSavedCinInfos = Boolean(
    candidat?.nomFamille?.trim() &&
    candidat?.prenom?.trim() &&
    candidat?.cin?.trim() &&
    /^[A-Za-z]{1,2}[0-9]{5,6}$/.test(candidat.cin.trim()) &&
    candidat?.dateNaissance?.trim()
  );

  // Étape 2 : Validée (≥1 candidature retenue)
  const step2Done = Object.values(candidaturesStatuts).some((st) => st === 'retenue');

  // Étape 3 : Entretien (terminée uniquement quand le directeur a marqué le candidat Présent)
  const step3Done = Boolean(currentCandidatId) && creneaux.some(
    (c) => c.candidatId === currentCandidatId && c.presence === 'present'
  );

  // Étape 4 : Résultat (un PV publié contenant son résultat)
  const publishedPv = pvs.find(
    (pv) =>
      Boolean(pv.publieLe) &&
      Boolean(currentCandidatId) &&
      pv.resultats?.some((r) => r.candidatId === currentCandidatId)
  );
  const monResultat = publishedPv?.resultats?.find(
    (r) => Boolean(currentCandidatId) && r.candidatId === currentCandidatId
  );
  const step4Done = Boolean(monResultat);
  const isRefuse = monResultat?.resultat === 'REFUSE';

  const isLegacySubmitted = Boolean(
    !hasACorriger &&
    (candidat?.envoyeLe ||
      (candidat?.candidaturesEnvoyeLe && Object.keys(candidat.candidaturesEnvoyeLe).length > 0) ||
      step2Done ||
      step3Done ||
      step4Done)
  );
  const isCandidatureEnvoyee = Boolean(dateEnvoi || isLegacySubmitted);

  // Étape 1 : Candidature (3 sujets validés + pièces fournies + CIN enregistrée + envoyée, ou déjà déposée)
  const step1Done =
    (hasThreeSubjects && hasCompleteDossier && hasSavedCinInfos && isCandidatureEnvoyee) ||
    isLegacySubmitted;

  // Étape 5 : Inscription (toujours grisée, 'future')
  const step5Done = false;

  const rawDones = [step1Done, step2Done, step3Done, step4Done, step5Done];

  // Construction des 5 étapes avec statut, infobulle et action
  const etapes: ProgressionEtapeInfo[] = [
    {
      numero: 1,
      cle: 'candidature',
      nom: fr.progression.steps.candidature.nom,
      statut: 'future',
      infobulle: fr.progression.stepCandidatureUnifiedFuture,
      actionTexte: fr.progression.steps.candidature.action,
    },
    {
      numero: 2,
      cle: 'validee',
      nom: fr.progression.steps.validee.nom,
      statut: 'future',
      infobulle: fr.progression.steps.validee.future,
      actionTexte: fr.progression.steps.validee.action,
    },
    {
      numero: 3,
      cle: 'entretien',
      nom: fr.progression.steps.entretien.nom,
      statut: 'future',
      infobulle: fr.progression.steps.entretien.future,
      actionTexte: fr.progression.steps.entretien.action,
    },
    {
      numero: 4,
      cle: 'resultat',
      nom: fr.progression.steps.resultat.nom,
      statut: 'future',
      infobulle: fr.progression.steps.resultat.future,
      actionTexte: fr.progression.steps.resultat.action,
    },
    {
      numero: 5,
      cle: 'inscription',
      nom: fr.progression.steps.inscription.nom,
      statut: 'future',
      infobulle: fr.progression.steps.inscription.future,
      actionTexte: undefined,
    },
  ];

  if (isRefuse) {
    // Si Résultat est « Refusé » : les étapes 1 à 4 sont faites, l'étape 5 est grisée « Non applicable »
    for (let i = 0; i < 4; i++) {
      etapes[i].statut = 'faite';
      etapes[i].infobulle = fr.progression.steps[etapes[i].cle].terminee;
    }
    etapes[4].statut = 'future';
    etapes[4].estNonApplicable = true;
    etapes[4].infobulle = fr.progression.nonApplicable;
  } else {
    // Cas normal : la première non faite est 'en_cours', les précédentes 'faite', les suivantes 'future'
    const firstNonDoneIndex = rawDones.findIndex((done) => !done);

    for (let i = 0; i < 5; i++) {
      const echeance = ECHEANCES[etapes[i].cle];
      etapes[i].echeance = echeance;

      if (firstNonDoneIndex === -1 || i < firstNonDoneIndex) {
        etapes[i].statut = 'faite';
        etapes[i].infobulle = fr.progression.steps[etapes[i].cle].terminee;
        etapes[i].enRetard = false;
        etapes[i].joursRetard = 0;
      } else if (i === firstNonDoneIndex) {
        etapes[i].statut = 'en_cours';
        etapes[i].infobulle =
          etapes[i].cle === 'candidature'
            ? fr.progression.stepCandidatureUnifiedEnCours
            : fr.progression.steps[etapes[i].cle].enCours;
        if (echeance) {
          const { enRetard, jours } = getRetardInfo(echeance, dateActuelle);
          etapes[i].enRetard = enRetard;
          etapes[i].joursRetard = jours;
        } else {
          etapes[i].enRetard = false;
          etapes[i].joursRetard = 0;
        }
      } else {
        etapes[i].statut = 'future';
        etapes[i].infobulle =
          etapes[i].cle === 'candidature'
            ? fr.progression.stepCandidatureUnifiedFuture
            : fr.progression.steps[etapes[i].cle].future;
        etapes[i].enRetard = false;
        etapes[i].joursRetard = 0;
      }
    }
  }

  // Nombre d'étapes franchies
  const doneCount = etapes.filter((e) => e.statut === 'faite').length;

  // Gestion des actions associées
  const handleAction = (stepIndex: number) => {
    switch (stepIndex) {
      case 0: // Étape 1 : Candidature
        {
          if (!hasThreeSubjects) {
            onNavigate?.('panier');
            return;
          }
          const el =
            document.getElementById('bloc-envoi-dossier') ||
            document.getElementById('compteur-pieces-fournies');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            onNavigate?.('dossier');
          }
        }
        break;
      case 1: // Étape 2 : Validée
        onNavigate?.('sujets');
        break;
      case 2: // Étape 3 : Entretien
        {
          const el = document.getElementById('creneaux-section');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
          } else {
            onNavigate?.('entretiens');
          }
        }
        break;
      case 3: // Étape 4 : Résultat
        {
          const el = document.getElementById('mon-resultat');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
          } else {
            onNavigate?.('entretiens');
          }
        }
        break;
      case 4: // Étape 5 : Inscription
        break;
    }
  };

  const handleStepToggle = (index: number) => {
    setActiveTooltip((prev) => (prev === index ? null : index));
  };

  const isValidationPending = isCandidatureEnvoyee && !step2Done && !isRefuse;
  const presentCreneau = currentCandidatId
    ? creneaux.find((c) => c.candidatId === currentCandidatId && c.presence === 'present')
    : undefined;

  const getSegmentMeta = (etape: ProgressionEtapeInfo) => {
    const isStepValidationPending =
      etape.cle === 'validee' && isCandidatureEnvoyee && !step2Done && !isRefuse;

    if (etape.statut === 'faite') {
      let doneDate: string | undefined;
      if (etape.cle === 'candidature') {
        doneDate = dateEnvoi || candidat?.attesteLe;
      } else if (etape.cle === 'entretien') {
        doneDate = presentCreneau?.presenceConstateeLe || presentCreneau?.date;
      } else if (etape.cle === 'resultat') {
        doneDate = publishedPv?.publieLe;
      }
      return {
        kind: 'faite' as const,
        stroke: '#059669',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        etatLabel: fr.progression.statuts.faite,
        dateLabel: doneDate
          ? fr.progression.infobulleTermineLe.replace('{date}', formatJJMMAAAA(doneDate))
          : fr.progression.nonRenseigne,
      };
    }

    if (isStepValidationPending) {
      return {
        kind: 'validation' as const,
        stroke: '#f97316',
        badgeClass: 'bg-orange-100 text-orange-900 border-orange-300',
        etatLabel: fr.progression.enCoursValidation,
        dateLabel: dateEnvoi
          ? fr.progression.infobulleEnvoyeLe.replace('{date}', formatJJMMAAAA(dateEnvoi))
          : fr.progression.nonRenseigne,
      };
    }

    if (etape.enRetard) {
      return {
        kind: 'retard' as const,
        stroke: '#dc2626',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
        etatLabel: fr.progression.enRetardDepuis.replace('{jours}', String(etape.joursRetard || 1)),
        dateLabel: etape.echeance
          ? fr.progression.infobulleEcheance.replace('{date}', formatJJMMAAAA(etape.echeance))
          : fr.progression.nonRenseigne,
      };
    }

    const etatLabel = etape.estNonApplicable
      ? fr.progression.statuts.nonApplicable
      : etape.statut === 'en_cours'
      ? fr.progression.statuts.enCours
      : fr.progression.statuts.future;

    return {
      kind: 'future' as const,
      stroke: '#cbd5e1',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      etatLabel,
      dateLabel: etape.echeance
        ? fr.progression.infobulleEcheance.replace('{date}', formatJJMMAAAA(etape.echeance))
        : fr.progression.nonRenseigne,
    };
  };

  const hasRetard = etapes.some((e) => e.enRetard && !(e.cle === 'validee' && isValidationPending));
  const displayedTooltipIndex = activeTooltip !== null ? activeTooltip : hoveredStep;
  const displayedTooltipEtape =
    displayedTooltipIndex !== null ? etapes[displayedTooltipIndex] : undefined;
  const displayedTooltipMeta = displayedTooltipEtape
    ? getSegmentMeta(displayedTooltipEtape)
    : undefined;

  return (
    <div
      ref={containerRef}
      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5 transition-all"
    >
      {/* Titre et ratio */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>{fr.progression.title}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {doneCount}/{etapes.length} {fr.progression.statuts.faite.toLowerCase()}s
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{fr.progression.subtitle}</p>
        </div>
        <div className="text-right">
          <span className="text-lg font-black text-slate-900">
            {doneCount}
            <span className="text-xs text-slate-400 font-normal ml-0.5">/5</span>
          </span>
        </div>
      </div>

      {/* Anneau SVG en 5 segments égaux OU carte initiale si aucune candidature */}
      {hasCandidatures ? (
        <div className="flex flex-col items-center justify-center py-2 relative space-y-3">
          <div className="relative w-[196px] h-[196px] flex items-center justify-center shrink-0 mx-auto">
            <svg
              viewBox="0 0 200 200"
              className="w-full h-full overflow-visible"
              role="group"
              aria-label={fr.progression.canvasAriaCinq.replace('{count}', String(doneCount))}
            >
              {etapes.map((etape, index) => {
                const startAngle = -90 + index * 72 + 2.5;
                const endAngle = -90 + (index + 1) * 72 - 2.5;
                const pathD = describeArcSegment(100, 100, 76, startAngle, endAngle);
                const meta = getSegmentMeta(etape);
                const isSelected = displayedTooltipIndex === index;

                return (
                  <path
                    key={etape.cle}
                    d={pathD}
                    fill="none"
                    stroke={meta.stroke}
                    strokeWidth={isSelected ? 26 : 22}
                    strokeLinecap="butt"
                    tabIndex={0}
                    role="button"
                    aria-expanded={activeTooltip === index}
                    aria-label={fr.progression.segmentAria
                      .replace('{numero}', String(etape.numero))
                      .replace('{nom}', etape.nom)
                      .replace('{etat}', meta.etatLabel)}
                    className="cursor-pointer transition-all duration-150 focus:outline-none focus-visible:opacity-85"
                    onPointerDown={() => {
                      pointerDownRef.current = true;
                      setTimeout(() => {
                        pointerDownRef.current = false;
                      }, 0);
                    }}
                    onPointerEnter={(e) => {
                      if (e.pointerType !== 'touch') {
                        setHoveredStep(index);
                      }
                    }}
                    onPointerLeave={(e) => {
                      if (e.pointerType !== 'touch') {
                        setHoveredStep((prev) => (prev === index ? null : prev));
                      }
                    }}
                    onFocus={() => {
                      if (!pointerDownRef.current) {
                        setActiveTooltip(index);
                      }
                    }}
                    onBlur={() => {
                      setActiveTooltip((prev) => (prev === index ? null : prev));
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      pointerDownRef.current = false;
                      setHoveredStep(null);
                      setActiveTooltip((prev) => (prev === index ? null : index));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveTooltip((prev) => (prev === index ? null : index));
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setActiveTooltip(null);
                        setHoveredStep(null);
                      }
                    }}
                  />
                );
              })}
            </svg>

            {/* Centre du cercle : N/5 + icône + libellé de l'état */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-center px-6">
              <span className="text-2xl font-black text-slate-900 leading-none">
                {doneCount}/5
              </span>
              {isValidationPending ? (
                <span className="mt-1.5 inline-flex items-center justify-center gap-1 text-[10px] font-bold text-orange-700 leading-tight max-w-[108px]">
                  <Clock size={12} className="text-orange-600 shrink-0" />
                  <span>{fr.progression.enCoursValidation}</span>
                </span>
              ) : hasRetard ? (
                <span className="mt-1.5 inline-flex items-center justify-center gap-1 text-[10px] font-bold text-rose-700 leading-tight max-w-[108px]">
                  <AlertTriangle size={12} className="text-rose-600 shrink-0" />
                  <span>{fr.progression.enRetardLabel}</span>
                </span>
              ) : doneCount === 5 || isRefuse ? (
                <span className="mt-1.5 inline-flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-700 leading-tight max-w-[108px]">
                  <Check size={12} className="text-emerald-600 shrink-0" />
                  <span>{fr.progression.statuts.faite}</span>
                </span>
              ) : (
                <span className="mt-1.5 inline-flex items-center justify-center gap-1 text-[10px] font-bold text-slate-600 leading-tight max-w-[108px]">
                  <Clock size={12} className="text-slate-500 shrink-0" />
                  <span>{fr.progression.statuts.enCours}</span>
                </span>
              )}
            </div>
          </div>

          {/* Infobulle au survol (bureau), appui (mobile) ou clavier */}
          {displayedTooltipEtape && displayedTooltipMeta && (
            <div
              role="tooltip"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xs bg-slate-900 text-white rounded-xl p-3 shadow-lg border border-slate-700 text-xs space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-white leading-snug">
                  {displayedTooltipEtape.numero}. {displayedTooltipEtape.nom}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTooltip(null);
                    setHoveredStep(null);
                  }}
                  aria-label={fr.progression.tooltipClose}
                  className="p-0.5 rounded text-slate-400 hover:text-white cursor-pointer shrink-0"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${displayedTooltipMeta.badgeClass}`}
                >
                  {displayedTooltipMeta.kind === 'faite' ? (
                    <Check size={10} strokeWidth={2.5} />
                  ) : displayedTooltipMeta.kind === 'validation' ? (
                    <Clock size={10} strokeWidth={2.5} />
                  ) : displayedTooltipMeta.kind === 'retard' ? (
                    <AlertTriangle size={10} strokeWidth={2.5} />
                  ) : (
                    <Lock size={10} strokeWidth={2.5} />
                  )}
                  <span>{displayedTooltipMeta.etatLabel}</span>
                </span>
              </div>

              <p className="text-[11px] text-slate-300 font-medium">
                {displayedTooltipMeta.dateLabel}
              </p>
            </div>
          )}
        </div>
      ) : !hasCandidatures ? (
        /* Petite carte si aucune candidature déposée */
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 text-center space-y-2.5 my-1">
          <div className="w-9 h-9 mx-auto rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
            <Sparkles size={18} />
          </div>
          <h3 className="text-xs font-bold text-slate-900">
            {fr.progression.emptyCardTitle}
          </h3>
          <p className="text-[11px] text-slate-600 max-w-xs mx-auto leading-relaxed">
            {fr.progression.emptyCardDesc}
          </p>
          <div>
            <button
              type="button"
              onClick={() => onNavigate?.('sujets')}
              className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <span>{fr.progression.emptyCardAction}</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      ) : null}

      {/* Liste verticale des 6 étapes sous le cercle */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
          {fr.progression.title}
        </h3>
        <div className="space-y-2">
          {etapes.map((etape, index) => {
            const isFaite = etape.statut === 'faite';
            const isEnCours = etape.statut === 'en_cours';
            const isFuture = etape.statut === 'future';
            const isSelected = activeTooltip === index;

            return (
              <div
                key={etape.cle}
                tabIndex={0}
                role="button"
                aria-expanded={isSelected}
                onClick={() => handleStepToggle(index)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleStepToggle(index);
                  }
                }}
                className={`w-full text-left rounded-xl border p-3 transition-all cursor-pointer focus:outline-none focus:ring-2 ${
                  isFaite
                    ? 'bg-emerald-50/50 border-emerald-200/80 hover:bg-emerald-50 focus:ring-emerald-500/20'
                    : isEnCours && etape.enRetard
                    ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-200 shadow-xs focus:ring-rose-500/20'
                    : isEnCours
                    ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-200 shadow-xs focus:ring-amber-500/20'
                    : 'bg-slate-50/60 border-slate-200 text-slate-400 focus:ring-slate-400/20'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Icône + Numéro & Nom */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                        isFaite
                          ? 'bg-emerald-600 text-white'
                          : isEnCours && etape.enRetard
                          ? 'bg-rose-600 text-white'
                          : isEnCours
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {isFaite ? (
                        <Check size={14} strokeWidth={2.5} />
                      ) : isEnCours && etape.enRetard ? (
                        <AlertTriangle size={14} strokeWidth={2.5} />
                      ) : isEnCours ? (
                        <Clock size={14} strokeWidth={2.5} />
                      ) : (
                        <Lock size={13} strokeWidth={2.5} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-xs font-bold truncate ${
                          isFaite
                            ? 'text-slate-900'
                            : isEnCours && etape.enRetard
                            ? 'text-rose-950 font-extrabold'
                            : isEnCours
                            ? 'text-amber-950 font-extrabold'
                            : 'text-slate-600'
                        }`}
                      >
                        {etape.numero}. {etape.nom}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {etape.infobulle}
                      </p>
                    </div>
                  </div>

                  {/* Badge statut textuel (Jamais la couleur seule) */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    {etape.estNonApplicable ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 flex items-center gap-1">
                        <Lock size={10} />
                        <span>{fr.progression.statuts.nonApplicable}</span>
                      </span>
                    ) : isFaite ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <Check size={10} strokeWidth={2.5} />
                        <span>{fr.progression.statuts.faite}</span>
                      </span>
                    ) : isEnCours && etape.enRetard ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                        <AlertTriangle size={11} strokeWidth={2.5} className="text-rose-600" />
                        <span>{fr.progression.enRetardDepuis.replace('{jours}', String(etape.joursRetard || 1))}</span>
                      </span>
                    ) : isEnCours ? (
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 flex items-center gap-1">
                          <Clock size={10} strokeWidth={2.5} />
                          <span>{fr.progression.statuts.enCours}</span>
                        </span>
                        {etape.echeance && (
                          <span className="text-[10px] font-semibold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            {fr.progression.avantLe.replace('{date}', formatJJMM(etape.echeance))}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 flex items-center gap-1">
                        <Lock size={10} strokeWidth={2.5} />
                        <span>{fr.progression.statuts.future}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Bouton d'action pour l'étape en cours ou étape faite */}
                {isEnCours && etape.actionTexte && (
                  <div className={`mt-3 pt-2.5 border-t flex items-center justify-end ${
                    etape.enRetard ? 'border-rose-200/70' : 'border-amber-200/60'
                  }`}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction(index);
                      }}
                      className={`py-1.5 px-3 rounded-lg text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer ${
                        etape.enRetard ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'
                      }`}
                    >
                      <span>{etape.actionTexte}</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                )}

                {isFaite && (
                  <div className="mt-2 pt-2 border-t border-emerald-100 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction(index);
                      }}
                      className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{fr.progression.actionConsulter}</span>
                      <ExternalLink size={11} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
