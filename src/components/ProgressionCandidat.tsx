import React, { useState, useEffect, useRef } from 'react';
import { Check, Clock, Lock, ArrowRight, Info, X, ExternalLink, Sparkles, AlertTriangle } from 'lucide-react';
import { fr } from '../i18n/fr';
import { Candidat, Creneau, PV, Piece, ProgressionEtapeInfo, dossierComplet } from '../types';
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
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('usmba_demo_date_updated', handleSync);
      window.removeEventListener('usmba_pvs_updated', handleSync);
      window.removeEventListener('usmba_creneaux_updated', handleSync);
      window.removeEventListener('usmba_dossier_updated', handleSync);
    };
  }, [candidatId]);

  // Fermer l'infobulle au clic extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveTooltip(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Candidatures du candidat connecté (sécurisé avec tableau vide par défaut sans planter)
  const candidatures = Array.isArray(candidat?.candidatures) ? candidat.candidatures : [];
  const hasCandidatures = candidatures.length > 0;
  const currentCandidatId = candidat?.id || candidatId || '';

  // --- CALCUL DYNAMIQUE DES 6 ÉTAPES (aucun nouveau stockage) ---
  const candidaturesStatuts = candidat?.candidaturesStatuts || {};

  // Étape 1 : Dossier complet (fait si dossierComplet)
  const step1Done = dossierComplet(candidat).complet;

  // Étape 2 : Envoyée (fait si statut ≠ 'brouillon')
  const step2Done =
    candidatures.length > 0 &&
    candidatures.some((id) => {
      const st = candidaturesStatuts[id];
      return Boolean(st && st !== 'brouillon');
    });

  // Étape 3 : Validée (≥1 candidature retenue)
  const step3Done = Object.values(candidaturesStatuts).some((st) => st === 'retenue');

  // Étape 4 : Entretien (créneau au statut 'confirme')
  const step4Done = Boolean(currentCandidatId) && creneaux.some(
    (c) => c.candidatId === currentCandidatId && c.statut === 'confirme'
  );

  // Étape 5 : Résultat (un PV publié contenant son résultat)
  const publishedPv = pvs.find(
    (pv) =>
      Boolean(pv.publieLe) &&
      Boolean(currentCandidatId) &&
      pv.resultats?.some((r) => r.candidatId === currentCandidatId)
  );
  const monResultat = publishedPv?.resultats?.find(
    (r) => Boolean(currentCandidatId) && r.candidatId === currentCandidatId
  );
  const step5Done = Boolean(monResultat);
  const isRefuse = monResultat?.resultat === 'REFUSE';

  // Étape 6 : Inscription (toujours grisée, 'future')
  const step6Done = false;

  const rawDones = [step1Done, step2Done, step3Done, step4Done, step5Done, step6Done];

  // Construction des 6 étapes avec statut, infobulle et action
  const etapes: ProgressionEtapeInfo[] = [
    {
      numero: 1,
      cle: 'dossier',
      nom: fr.progression.steps.dossier.nom,
      statut: 'future',
      infobulle: fr.progression.steps.dossier.future,
      actionTexte: fr.progression.steps.dossier.action,
    },
    {
      numero: 2,
      cle: 'candidature',
      nom: fr.progression.steps.candidature.nom,
      statut: 'future',
      infobulle: fr.progression.steps.candidature.future,
      actionTexte: fr.progression.steps.candidature.action,
    },
    {
      numero: 3,
      cle: 'validee',
      nom: fr.progression.steps.validee.nom,
      statut: 'future',
      infobulle: fr.progression.steps.validee.future,
      actionTexte: fr.progression.steps.validee.action,
    },
    {
      numero: 4,
      cle: 'entretien',
      nom: fr.progression.steps.entretien.nom,
      statut: 'future',
      infobulle: fr.progression.steps.entretien.future,
      actionTexte: fr.progression.steps.entretien.action,
    },
    {
      numero: 5,
      cle: 'resultat',
      nom: fr.progression.steps.resultat.nom,
      statut: 'future',
      infobulle: fr.progression.steps.resultat.future,
      actionTexte: fr.progression.steps.resultat.action,
    },
    {
      numero: 6,
      cle: 'inscription',
      nom: fr.progression.steps.inscription.nom,
      statut: 'future',
      infobulle: fr.progression.steps.inscription.future,
      actionTexte: undefined,
    },
  ];

  if (isRefuse) {
    // Si Résultat est « Refusé » : les étapes 1 à 5 sont faites, l'étape 6 est grisée « Non applicable »
    for (let i = 0; i < 5; i++) {
      etapes[i].statut = 'faite';
      etapes[i].infobulle = fr.progression.steps[etapes[i].cle].terminee;
    }
    etapes[5].statut = 'future';
    etapes[5].estNonApplicable = true;
    etapes[5].infobulle = fr.progression.nonApplicable;
  } else {
    // Cas normal : la première non faite est 'en_cours', les précédentes 'faite', les suivantes 'future'
    const firstNonDoneIndex = rawDones.findIndex((done) => !done);

    for (let i = 0; i < 6; i++) {
      const echeance = ECHEANCES[etapes[i].cle];
      etapes[i].echeance = echeance;

      if (firstNonDoneIndex === -1 || i < firstNonDoneIndex) {
        etapes[i].statut = 'faite';
        etapes[i].infobulle = fr.progression.steps[etapes[i].cle].terminee;
        etapes[i].enRetard = false;
        etapes[i].joursRetard = 0;
      } else if (i === firstNonDoneIndex) {
        etapes[i].statut = 'en_cours';
        etapes[i].infobulle = fr.progression.steps[etapes[i].cle].enCours;
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
        etapes[i].infobulle = fr.progression.steps[etapes[i].cle].future;
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
      case 0: // Candidature
        onNavigate?.('sujets');
        break;
      case 1: // Dossier complet
        onNavigate?.('dossier');
        break;
      case 2: // Validée
        onNavigate?.('sujets');
        break;
      case 3: // Entretien
        {
          const el = document.getElementById('creneaux-section');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
          } else {
            onNavigate?.('entretiens');
          }
        }
        break;
      case 4: // Résultat
        {
          const el = document.getElementById('mon-resultat');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
          } else {
            onNavigate?.('entretiens');
          }
        }
        break;
      case 5: // Inscription
        break;
    }
  };

  const handleStepToggle = (index: number) => {
    setActiveTooltip((prev) => (prev === index ? null : index));
  };

  // Calcul géométrique de l'anneau SVG : 6 segments de 60° avec un écart de 8°
  const cx = 80;
  const cy = 80;
  const r = 58;
  const segments = etapes.map((etape, i) => {
    const startDeg = -90 + i * 60 + 4;
    const endDeg = -90 + (i + 1) * 60 - 4;
    const startRad = (startDeg * Math.PI) / 180;
    const endRad = (endDeg * Math.PI) / 180;

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);

    const pathData = `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;

    let strokeColor = '#cbd5e1'; // slate-300 (future / non applicable - jamais rouge)
    if (etape.statut === 'faite') {
      strokeColor = '#059669'; // emerald-600 (fait : toujours vert)
    } else if (etape.statut === 'en_cours') {
      strokeColor = etape.enRetard ? '#dc2626' : '#d97706'; // rouge si en retard, amber-600 sinon
    }

    return {
      index: i,
      pathData,
      strokeColor,
      etape,
    };
  });

  const displayedTooltipIndex = hoveredStep !== null ? hoveredStep : activeTooltip;
  const activeEtape = displayedTooltipIndex !== null ? etapes[displayedTooltipIndex] : null;

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
            <span className="text-xs text-slate-400 font-normal ml-0.5">/6</span>
          </span>
        </div>
      </div>

      {/* Cercle de progression SVG (≈160px) OU carte initiale si aucune candidature */}
      {hasCandidatures ? (
        <div className="flex flex-col items-center justify-center py-2 relative">
          <div className="relative w-[160px] h-[160px] min-w-[160px] min-h-[160px] flex items-center justify-center shrink-0 mx-auto">
            <svg
              width="160"
              height="160"
              viewBox="0 0 160 160"
              className="w-[160px] h-[160px] shrink-0 block"
              aria-label={`${fr.progression.progressionGlobale} : ${doneCount} sur 6`}
            >
              {segments.map((seg) => {
                const isSelected = activeTooltip === seg.index;
                const isHovered = hoveredStep === seg.index;
                const isEnCours = seg.etape.statut === 'en_cours';

                return (
                  <g
                    key={seg.index}
                    className="cursor-pointer transition-transform focus:outline-none"
                    tabIndex={0}
                    role="button"
                    aria-label={`${seg.etape.numero}. ${seg.etape.nom} : ${
                      seg.etape.estNonApplicable
                        ? fr.progression.statuts.nonApplicable
                        : seg.etape.statut === 'faite'
                        ? fr.progression.statuts.faite
                        : seg.etape.statut === 'en_cours'
                        ? fr.progression.statuts.enCours
                        : fr.progression.statuts.future
                    }`}
                    onClick={() => handleStepToggle(seg.index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleStepToggle(seg.index);
                      }
                    }}
                    onMouseEnter={() => setHoveredStep(seg.index)}
                    onMouseLeave={() => setHoveredStep(null)}
                  >
                    <path
                      d={seg.pathData}
                      fill="none"
                      stroke={seg.strokeColor}
                      strokeWidth={isSelected || isHovered ? 13 : isEnCours ? 11.5 : 9.5}
                      strokeLinecap="round"
                      className="transition-all duration-200"
                    />
                  </g>
                );
              })}

              {/* Centre de l'anneau SVG : N/6 + mention toujours visible */}
              <text
                x="80"
                y="74"
                textAnchor="middle"
                dominantBaseline="central"
                className="text-3xl font-black fill-slate-900 tracking-tight select-none font-sans"
              >
                {doneCount}/6
              </text>
              <text
                x="80"
                y="94"
                textAnchor="middle"
                dominantBaseline="central"
                className="text-[10px] font-bold fill-slate-500 uppercase tracking-wider select-none font-sans"
              >
                {fr.progression.stepCount}
              </text>
            </svg>
          </div>

          {/* Infobulle contextuelle de segment actif ou survolé */}
          {activeEtape && (
            <div className="mt-3 w-full max-w-sm mx-auto bg-slate-900 text-white rounded-xl p-3 text-xs shadow-lg animate-in fade-in zoom-in-95 duration-150 relative">
              <div className="flex items-start justify-between gap-2">
                <div className={`flex items-center gap-1.5 font-bold ${activeEtape.enRetard ? 'text-rose-400' : 'text-amber-300'}`}>
                  {activeEtape.enRetard ? (
                    <AlertTriangle size={14} className="shrink-0 text-rose-400" />
                  ) : (
                    <Info size={14} className="shrink-0" />
                  )}
                  <span>
                    Étape {activeEtape.numero} : {activeEtape.nom}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTooltip(null);
                    setHoveredStep(null);
                  }}
                  className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                  aria-label={fr.progression.tooltipClose}
                >
                  <X size={14} />
                </button>
              </div>

              {activeEtape.enRetard && (
                <div className="mt-1.5 px-2.5 py-1 bg-rose-950/80 border border-rose-500/40 rounded-lg text-xs text-rose-200 flex items-center gap-1.5">
                  <AlertTriangle size={12} className="shrink-0 text-rose-400" />
                  <span className="font-bold">
                    {fr.progression.enRetardDepuis.replace('{jours}', String(activeEtape.joursRetard || 1))}
                  </span>
                </div>
              )}

              <p className="mt-1.5 text-slate-200 leading-relaxed">{activeEtape.infobulle}</p>
              {activeEtape.statut === 'en_cours' && activeEtape.actionTexte && (
                <button
                  type="button"
                  onClick={() => handleAction(activeEtape.numero - 1)}
                  className={`mt-2.5 w-full py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    activeEtape.enRetard
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  }`}
                >
                  <span>{activeEtape.actionTexte}</span>
                  <ArrowRight size={13} />
                </button>
              )}
              {activeEtape.statut === 'faite' && (
                <button
                  type="button"
                  onClick={() => handleAction(activeEtape.numero - 1)}
                  className="mt-2.5 w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>{fr.progression.actionConsulter}</span>
                  <ExternalLink size={13} />
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
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
      )}

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
