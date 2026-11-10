import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, ArrowLeft, CheckCircle2, Clock, XCircle, CheckSquare, Square, ExternalLink } from 'lucide-react';
import { PV, ResultatType, Resultat, calculerNoteResultat } from '../types';
import { MOCK_CANDIDATS, INITIAL_SUJETS, getComptes } from '../data/mockData';
import { fr } from '../i18n/fr';

interface PVDocumentProps {
  pv: PV;
  directeurNom: string;
  candidatId?: string;
  onClose: () => void;
  autoPrint?: boolean;
}

export const PVDocument: React.FC<PVDocumentProps> = ({
  pv,
  directeurNom,
  candidatId,
  onClose,
  autoPrint = false,
}) => {
  const [printError, setPrintError] = useState(false);

  const imprimerPV = () => {
    setPrintError(false);
    try {
      if (typeof window === 'undefined' || typeof window.print !== 'function') {
        throw new Error('window.print indisponible');
      }
      setTimeout(() => {
        try {
          window.print();
        } catch (err) {
          setPrintError(true);
        }
      }, 100);
    } catch (err) {
      setPrintError(true);
    }
  };

  useEffect(() => {
    if (autoPrint) {
      imprimerPV();
    }
  }, [autoPrint]);

  const getCandidatFullInfo = (cId: string) => {
    let c = MOCK_CANDIDATS.find((x) => x.id === cId);
    if (!c) {
      try {
        const raw = localStorage.getItem('usmba_doctorat_candidat');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.id === cId) c = parsed;
        }
      } catch {}
    }
    if (!c) {
      try {
        const rawAccounts = localStorage.getItem('usmba_registered_accounts');
        if (rawAccounts) {
          const accs = JSON.parse(rawAccounts);
          c = accs.find((x: any) => x.id === cId);
        }
      } catch {}
    }

    const nom = c?.nom || fr.commission.nonRenseigne;
    const cin = c?.cin || fr.commission.nonRenseigne;
    const cne = c?.cne || fr.commission.nonRenseigne;

    // Diplome et établissement
    const diplome = c?.cursus?.diplome || fr.commission.nonRenseigne;
    const specialite = c?.cursus?.specialite || c?.cursus?.filiere || 'Sciences & Technologies';
    const etablissementOrigine = c?.cursus?.etablissement || fr.commission.nonRenseigne;

    // Sujet
    const sujetId = c?.candidatures?.[0];
    const sujetObj = INITIAL_SUJETS.find((s) => s.id === sujetId || s.enseignantId === pv.directeurId);
    const sujetTitre = sujetObj ? sujetObj.titre : 'Thèse de doctorat en Sciences et Technologies';
    const discipline = sujetObj?.discipline || 'Sciences et Technologies';

    return {
      nom,
      cin,
      cne,
      diplome,
      specialite,
      etablissementOrigine,
      sujetTitre,
      discipline,
    };
  };

  const formattedDate = () => {
    try {
      const [y, m, d] = pv.date.split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return pv.date;
    }
  };

  // Liste des résultats à afficher : un seul candidat ou tous les candidats de la séance
  const targetResults: Resultat[] = React.useMemo(() => {
    if (candidatId) {
      const match = pv.resultats.filter((r) => r.candidatId === candidatId);
      if (match.length > 0) return match;
    }
    return pv.resultats;
  }, [pv.resultats, candidatId]);

  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const dateFormatted = formattedDate();
  const baseCode = (pv.code || 'CODE').slice(0, 4);

  return (
    <div className="space-y-4">
      {/* Styles d'impression stricts A4 2 pages par candidat dans zone dédiée .pv-print */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }

          /* Aucun parent de .pv-print ne doit avoir overflow:hidden, position:fixed ni hauteur bloquée en impression */
          html, body, #root, .min-h-screen, div {
            overflow: visible !important;
            position: static !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
          }

          /* Masque l'en-tête, la barre de navigation, la barre du bas, les boutons et les formulaires */
          header, nav, footer, button, form, input, select, textarea, .no-print, [role="navigation"] {
            display: none !important;
          }

          body * {
            visibility: hidden;
          }

          /* Affiche uniquement .pv-print */
          .pv-print, .pv-print * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          .pv-print {
            display: block !important;
            position: static !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          /* Chaque PV dans un bloc avec break-after: page */
          .pv-print-bloc {
            break-after: page !important;
            page-break-after: always !important;
            display: block !important;
            clear: both !important;
          }

          .pv-print-bloc:last-child {
            break-after: auto !important;
            page-break-after: auto !important;
          }

          .pv-a4-page {
            break-after: page !important;
            page-break-after: always !important;
            box-shadow: none !important;
            border: none !important;
            padding: 12px 16px !important;
            margin: 0 !important;
            min-height: 260mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
            overflow: visible !important;
          }

          .pv-a4-page:last-child {
            break-after: auto !important;
            page-break-after: auto !important;
          }
        }
      `}</style>

      {/* Barre d'actions en haut (écran uniquement) */}
      <div className="no-print bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer self-start"
          >
            <ArrowLeft size={15} />
            <span>{fr.commission.btnRetourSeance}</span>
          </button>

          <div className="flex flex-col items-start sm:items-end gap-1">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-600 font-mono hidden sm:inline">
                {candidatId
                  ? `PV candidat · Ref. PV-${pv.date}-${baseCode}-${pv.resultats.findIndex((r) => r.candidatId === candidatId) + 1}`
                  : `Séance du ${dateFormatted} (${targetResults.length} PV)`}
              </span>
              <button
                type="button"
                onClick={imprimerPV}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs transition cursor-pointer"
              >
                <Printer size={15} />
                <span>{candidatId ? fr.commission.btnTelecharger : fr.commission.btnTelechargerSeance}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              {fr.commission.indicationPdf}
            </p>
          </div>
        </div>

        {printError && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>{fr.commission.impressionBloquee}</span>
            <button
              type="button"
              onClick={() => window.open(window.location.href, '_blank')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition cursor-pointer shrink-0"
            >
              <ExternalLink size={13} />
              <span>{fr.commission.ouvrirNouvelOnglet}</span>
            </button>
          </div>
        )}
      </div>

      {/* Section imprimable dédiée des PVs avec classe .pv-print */}
      <div className="pv-print space-y-8 print:space-y-0">
        {targetResults.map((res, targetIdx) => {
          // Index séquentiel du candidat dans la séance (1, 2, ...)
          const candIndex = pv.resultats.findIndex((r) => r.candidatId === res.candidatId);
          const numCandidat = (candIndex >= 0 ? candIndex : targetIdx) + 1;
          const refCandidat = `PV-${pv.date}-${baseCode}-${numCandidat}`;
          const qrCodeUrl = `${originUrl}/#verif/${(pv.code || 'CODE').trim()}-${numCandidat}`;

          const candInfo = getCandidatFullInfo(res.candidatId);
          const noteGlobale = calculerNoteResultat(res);
          const crit = res.criteres;

          return (
            <div key={res.candidatId || targetIdx} className="pv-print-bloc space-y-8 print:space-y-0">
              {/* PAGE 1 DU CANDIDAT */}
              <div className="pv-a4-page max-w-[840px] mx-auto bg-white border border-slate-300 rounded-xl p-7 sm:p-9 shadow-md text-slate-900 font-sans print:border-none print:shadow-none print:rounded-none">
                <div className="space-y-4">
                  {/* EN-TÊTE OFFICIEL BILINGUE ROYAUME DU MAROC */}
                  <div className="border-b-2 border-slate-900 pb-3">
                    <div className="grid grid-cols-12 items-center gap-2">
                      <div className="col-span-5 text-left text-[11px] leading-tight text-slate-800 font-semibold space-y-0.5">
                        <p className="font-extrabold uppercase text-slate-900 text-xs tracking-wider">
                          {fr.commission.pvModele.royaumeMarocFr}
                        </p>
                        <p className="font-bold text-slate-900">{fr.commission.pvModele.universiteFr}</p>
                        <p className="text-slate-700">Faculté des Sciences Dhar El Mahraz / FST Fès</p>
                        <p className="text-slate-700">
                          {fr.commission.pvModele.cedocFr} <span className="font-semibold">{pv.structure || 'Sciences et Technologies'}</span>
                        </p>
                        <p className="text-slate-700">
                          {fr.commission.pvModele.formationDoctoraleFr} <span className="font-semibold">{candInfo.discipline}</span>
                        </p>
                      </div>

                      <div className="col-span-2 flex flex-col items-center justify-center text-center">
                        <div className="w-12 h-12 rounded-full border border-slate-300 flex items-center justify-center bg-red-50 text-red-700 shadow-2xs">
                          <span className="text-2xl" role="img" aria-label="Maroc">🇲🇦</span>
                        </div>
                      </div>

                      <div className="col-span-5 text-right text-[11px] leading-tight text-slate-800 font-semibold space-y-0.5" dir="rtl">
                        <p className="font-extrabold text-slate-900 text-xs tracking-wider">
                          {fr.commission.pvModele.royaumeMarocAr}
                        </p>
                        <p className="font-bold text-slate-900">{fr.commission.pvModele.universiteAr}</p>
                        <p className="text-slate-700">كلية العلوم ظهر المهراز / كلية العلوم والتقنيات فاس</p>
                        <p className="text-slate-700">{fr.commission.pvModele.cedocAr}</p>
                        <p className="text-slate-700">{fr.commission.pvModele.formationDoctoraleAr}</p>
                      </div>
                    </div>

                    <div className="text-center pt-3 mt-2 border-t border-slate-300">
                      <h2 className="text-base sm:text-lg font-black tracking-wide text-slate-900 uppercase">
                        {fr.commission.pvModele.titrePV}
                      </h2>
                      <p className="text-xs font-bold text-slate-700 mt-0.5 tracking-wider uppercase">
                        {fr.commission.pvModele.sousTitrePV}
                      </p>
                    </div>
                  </div>

                  {/* 1. IDENTIFICATION DU CANDIDAT */}
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider pb-0.5 border-b border-dashed border-slate-400">
                      {fr.commission.pvModele.sec1Titre}
                    </h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-800 pt-0.5">
                      <div>
                        <span className="font-bold text-slate-900">{fr.commission.pvModele.nomPrenom}</span>{' '}
                        <span className="font-bold uppercase text-slate-900">{candInfo.nom}</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-900">{fr.commission.pvModele.cni}</span>{' '}
                        <span className="font-mono font-bold text-slate-800">{candInfo.cin}</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-900">{fr.commission.pvModele.cneMassar}</span>{' '}
                        <span className="font-mono font-bold text-slate-800">{candInfo.cne}</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-900">{fr.commission.pvModele.dateEntretien}</span>{' '}
                        <span className="font-semibold text-slate-800">{dateFormatted}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="font-bold text-slate-900">{fr.commission.pvModele.dernierDiplome}</span>{' '}
                        <span className="font-semibold text-slate-800">{candInfo.diplome}</span>{' '}
                        <span className="text-slate-600">{fr.commission.pvModele.enSpecialite}</span>{' '}
                        <span className="font-semibold text-slate-800">{candInfo.specialite}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="font-bold text-slate-900">{fr.commission.pvModele.etablissementOrigine}</span>{' '}
                        <span className="font-semibold text-slate-800">{candInfo.etablissementOrigine}</span>
                      </div>
                    </div>
                  </div>

                  {/* 2. CADRE DU PROJET DE RECHERCHE */}
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider pb-0.5 border-b border-dashed border-slate-400">
                      {fr.commission.pvModele.sec2Titre}
                    </h3>
                    <div className="text-xs text-slate-800 space-y-1 pt-0.5">
                      <div>
                        <span className="font-bold text-slate-900">{fr.commission.pvModele.intituleSujet}</span>{' '}
                        <span className="font-bold text-slate-900">{candInfo.sujetTitre}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="font-bold text-slate-900">{fr.commission.pvModele.directeurThese}</span>{' '}
                          <span className="font-semibold text-slate-900">Pr. {directeurNom}</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-900">{fr.commission.pvModele.coDirecteur}</span>{' '}
                          <span className="font-semibold text-slate-900">{fr.commission.aucun}</span>
                        </div>
                      </div>
                      <div>
                        <span className="font-bold text-slate-900">{fr.commission.pvModele.structureRecherche}</span>{' '}
                        <span className="font-semibold text-slate-800">{pv.structure || 'Laboratoire LISAC, FST Fès'}</span>
                      </div>
                    </div>
                  </div>

                  {/* 3. ÉVALUATION DU CANDIDAT PAR LA COMMISSION */}
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider pb-0.5 border-b border-dashed border-slate-400">
                      {fr.commission.pvModele.sec3Titre}
                    </h3>
                    <div className="border border-slate-900 rounded-sm overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-900 text-slate-900 font-black text-[11px] uppercase">
                            <th className="p-2 w-1/2 border-r border-slate-900">{fr.commission.pvModele.colCriteres}</th>
                            <th className="p-2 w-1/4 text-center border-r border-slate-900">{fr.commission.pvModele.colNoteBareme}</th>
                            <th className="p-2 w-1/4">{fr.commission.pvModele.colAppreciations}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-300 text-slate-900">
                          {/* 1. Acquis */}
                          <tr>
                            <td className="p-2 border-r border-slate-900">
                              <p className="font-bold">{fr.commission.critereAcquisLabel}</p>
                              <p className="text-[10px] text-slate-600">{fr.commission.critereAcquisDesc}</p>
                            </td>
                            <td className="p-2 text-center font-mono font-bold border-r border-slate-900">
                              {crit?.acquis !== undefined ? `${crit.acquis.toFixed(1)} / 05` : fr.commission.nonRenseigne}
                            </td>
                            <td className="p-2 text-[11px] text-slate-600 italic">
                              {crit?.acquis !== undefined && crit.acquis >= 4 ? 'Très satisfaisant' : '—'}
                            </td>
                          </tr>

                          {/* 2. Projet */}
                          <tr>
                            <td className="p-2 border-r border-slate-900">
                              <p className="font-bold">{fr.commission.critereProjetLabel}</p>
                              <p className="text-[10px] text-slate-600">{fr.commission.critereProjetDesc}</p>
                            </td>
                            <td className="p-2 text-center font-mono font-bold border-r border-slate-900">
                              {crit?.projet !== undefined ? `${crit.projet.toFixed(1)} / 05` : fr.commission.nonRenseigne}
                            </td>
                            <td className="p-2 text-center text-[11px] text-slate-600 italic">—</td>
                          </tr>

                          {/* 3. Methodo */}
                          <tr>
                            <td className="p-2 border-r border-slate-900">
                              <p className="font-bold">{fr.commission.critereMethodoLabel}</p>
                              <p className="text-[10px] text-slate-600">{fr.commission.critereMethodoDesc}</p>
                            </td>
                            <td className="p-2 text-center font-mono font-bold border-r border-slate-900">
                              {crit?.methodo !== undefined ? `${crit.methodo.toFixed(1)} / 05` : fr.commission.nonRenseigne}
                            </td>
                            <td className="p-2 text-center text-[11px] text-slate-600 italic">—</td>
                          </tr>

                          {/* 4. Oral */}
                          <tr>
                            <td className="p-2 border-r border-slate-900">
                              <p className="font-bold">{fr.commission.critereOralLabel}</p>
                              <p className="text-[10px] text-slate-600">{fr.commission.critereOralDesc}</p>
                            </td>
                            <td className="p-2 text-center font-mono font-bold border-r border-slate-900">
                              {crit?.oral !== undefined ? `${crit.oral.toFixed(1)} / 05` : fr.commission.nonRenseigne}
                            </td>
                            <td className="p-2 text-center text-[11px] text-slate-600 italic">—</td>
                          </tr>

                          {/* TOTAL NOTE GLOBALE */}
                          <tr className="bg-slate-50 font-black border-t-2 border-slate-900">
                            <td className="p-2 uppercase tracking-wide border-r border-slate-900">
                              {fr.commission.pvModele.noteGlobaleEntretien}
                            </td>
                            <td className="p-2 text-center font-mono text-sm text-emerald-950 font-black border-r border-slate-900">
                              {noteGlobale.toFixed(1)} / 20
                            </td>
                            <td className="p-2 text-center text-xs font-bold text-slate-700">
                              {res.resultat === 'ADMIS' ? 'Favorable' : res.resultat === 'LISTE_COMPLEMENTAIRE' ? 'Attente' : 'Défavorable'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 4. AVIS MOTIVÉ ET DÉCISION DE LA COMMISSION */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider pb-0.5 border-b border-dashed border-slate-400">
                      {fr.commission.pvModele.sec4Titre}
                    </h3>
                    <div className="border border-slate-900 rounded-sm p-2.5 space-y-2.5 text-xs">
                      <div>
                        <span className="font-bold text-slate-900">{fr.commission.pvModele.avisMotiveCommission}</span>
                        <div className="mt-1 p-2 bg-slate-50 border border-slate-200 rounded min-h-[46px] text-xs text-slate-800">
                          {res.avis || res.motif || (res.resultat === 'REFUSE' ? 'Candidat non retenu pour le sujet de doctorat.' : 'Avis favorable après examen des compétences et motivations.')}
                        </div>
                      </div>

                      <div className="pt-1">
                        <span className="font-bold text-slate-900 block mb-1.5">{fr.commission.pvModele.decisionFinale}</span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {/* Favorable */}
                          <div className="flex items-center gap-2 p-1.5 rounded border border-slate-300 bg-white">
                            {res.resultat === 'ADMIS' ? (
                              <CheckSquare size={16} className="text-emerald-700 shrink-0 font-bold" />
                            ) : (
                              <Square size={16} className="text-slate-400 shrink-0" />
                            )}
                            <span className={`text-[11px] leading-tight ${res.resultat === 'ADMIS' ? 'font-black text-slate-900' : 'text-slate-600'}`}>
                              {fr.commission.pvModele.choixFavorable}
                            </span>
                          </div>

                          {/* Liste d'attente */}
                          <div className="flex items-center gap-2 p-1.5 rounded border border-slate-300 bg-white">
                            {res.resultat === 'LISTE_COMPLEMENTAIRE' ? (
                              <CheckSquare size={16} className="text-amber-700 shrink-0 font-bold" />
                            ) : (
                              <Square size={16} className="text-slate-400 shrink-0" />
                            )}
                            <span className={`text-[11px] leading-tight ${res.resultat === 'LISTE_COMPLEMENTAIRE' ? 'font-black text-slate-900' : 'text-slate-600'}`}>
                              {fr.commission.pvModele.choixListeAttente}
                            </span>
                          </div>

                          {/* Défavorable */}
                          <div className="flex items-center gap-2 p-1.5 rounded border border-slate-300 bg-white">
                            {res.resultat === 'REFUSE' ? (
                              <CheckSquare size={16} className="text-rose-700 shrink-0 font-bold" />
                            ) : (
                              <Square size={16} className="text-slate-400 shrink-0" />
                            )}
                            <span className={`text-[11px] leading-tight ${res.resultat === 'REFUSE' ? 'font-black text-slate-900' : 'text-slate-600'}`}>
                              {fr.commission.pvModele.choixDefavorable}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 5. ÉMARGEMENT ET SIGNATURES (Titre d'annonce en bas de page 1) */}
                  <div className="pt-1">
                    <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider pb-0.5 border-b border-dashed border-slate-400">
                      {fr.commission.pvModele.sec5Titre}
                    </h3>
                  </div>
                </div>

                {/* PIED DE PAGE 1 SUR 2 */}
                <div className="pt-3 mt-4 border-t border-slate-400 flex items-center justify-between text-[10px] text-slate-600">
                  <div className="font-semibold text-slate-700">
                    {fr.commission.pvModele.footerTitre}
                  </div>
                  <div className="font-bold text-slate-800">
                    {fr.commission.pvModele.footerDocOfficiel}
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span>{fr.commission.pvModele.footerPage1}</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-bold text-slate-900">{refCandidat}</span>
                    <div className="ml-1">
                      <QRCodeSVG value={qrCodeUrl} size={36} level="M" />
                    </div>
                  </div>
                </div>
              </div>

              {/* PAGE 2 DU CANDIDAT */}
              <div className="pv-a4-page max-w-[840px] mx-auto bg-white border border-slate-300 rounded-xl p-7 sm:p-9 shadow-md text-slate-900 font-sans print:border-none print:shadow-none print:rounded-none">
                <div className="space-y-6">
                  {/* Petit rappel de référence et candidat sur page 2 */}
                  <div className="border-b border-slate-200 pb-2 flex items-center justify-between text-xs text-slate-600">
                    <div>
                      <span className="font-bold text-slate-900">{candInfo.nom}</span> — {candInfo.cin}
                    </div>
                    <div className="font-mono text-[11px] font-bold text-slate-700">
                      {refCandidat}
                    </div>
                  </div>

                  {/* TABLEAU DES SIGNATURES DES MEMBRES */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                      {fr.commission.pvModele.sec5Titre}
                    </h3>

                    <div className="border border-slate-900 rounded-sm overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-900 text-slate-900 font-black text-[11px] uppercase">
                            <th className="p-3 w-1/3 border-r border-slate-900">{fr.commission.pvModele.colQualiteRole}</th>
                            <th className="p-3 w-1/3 border-r border-slate-900">{fr.commission.pvModele.colNomPrenom}</th>
                            <th className="p-3 w-1/3 text-center">{fr.commission.pvModele.colEmargement}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-300 text-slate-900">
                          {/* 1. Directeur de Thèse */}
                          <tr>
                            <td className="p-3 font-bold border-r border-slate-900">
                              {fr.commission.pvModele.roleDirecteur}
                            </td>
                            <td className="p-3 font-semibold text-slate-900 border-r border-slate-900">
                              Pr. {directeurNom.replace(/^Pr\.?\s*/i, '')}
                            </td>
                            <td className="p-3 h-16 min-h-[64px] bg-slate-50/50"></td>
                          </tr>

                          {/* 2. Co-directeur de Thèse */}
                          <tr>
                            <td className="p-3 font-bold border-r border-slate-900">
                              {fr.commission.pvModele.roleCoDirecteur}
                            </td>
                            <td className="p-3 font-semibold text-slate-600 border-r border-slate-900 italic">
                              {fr.commission.aucun}
                            </td>
                            <td className="p-3 h-16 min-h-[64px] bg-slate-50/50"></td>
                          </tr>

                          {/* 3. Membre 1 */}
                          <tr>
                            <td className="p-3 font-bold border-r border-slate-900">
                              {fr.commission.pvModele.roleMembre1}
                            </td>
                            <td className="p-3 font-semibold border-r border-slate-900">
                              {pv.membres?.[0] && pv.membres[0].trim() !== '' ? (
                                <span className="text-slate-900">
                                  {pv.membres[0].trim().startsWith('Pr.') ? pv.membres[0].trim() : `Pr. ${pv.membres[0].trim()}`}
                                </span>
                              ) : (
                                <span className="text-slate-500 italic font-normal">
                                  {fr.commission.aCompleterALaMain}
                                </span>
                              )}
                            </td>
                            <td className="p-3 h-16 min-h-[64px] bg-slate-50/50"></td>
                          </tr>

                          {/* 4. Membre 2 */}
                          <tr>
                            <td className="p-3 font-bold border-r border-slate-900">
                              {fr.commission.pvModele.roleMembre2}
                            </td>
                            <td className="p-3 font-semibold border-r border-slate-900">
                              {pv.membres?.[1] && pv.membres[1].trim() !== '' ? (
                                <span className="text-slate-900">
                                  {pv.membres[1].trim().startsWith('Pr.') ? pv.membres[1].trim() : `Pr. ${pv.membres[1].trim()}`}
                                </span>
                              ) : (
                                <span className="text-slate-500 italic font-normal">
                                  {fr.commission.aCompleterALaMain}
                                </span>
                              )}
                            </td>
                            <td className="p-3 h-16 min-h-[64px] bg-slate-50/50"></td>
                          </tr>

                          {/* 5. Coordonnateur CEDoc */}
                          <tr>
                            <td className="p-3 font-bold border-r border-slate-900">
                              {fr.commission.pvModele.roleCoordonnateur}
                            </td>
                            <td className="p-3 font-semibold border-r border-slate-900">
                              {(() => {
                                if (pv.coordonnateur && pv.coordonnateur.trim() !== '') {
                                  return (
                                    <span className="text-slate-900">
                                      {pv.coordonnateur.trim().startsWith('Pr.') || pv.coordonnateur.trim().startsWith('M.') || pv.coordonnateur.trim().startsWith('Mme')
                                        ? pv.coordonnateur.trim()
                                        : `Pr. ${pv.coordonnateur.trim()}`}
                                    </span>
                                  );
                                }
                                try {
                                  const comptes = getComptes();
                                  const pvStruct = pv.structure;
                                  const match = comptes.find(
                                    (c) =>
                                      (c.role === 'directeur_ced' || c.roles?.includes('structure')) &&
                                      c.structure &&
                                      pvStruct &&
                                      (c.structure.toLowerCase().includes(pvStruct.toLowerCase()) ||
                                        pvStruct.toLowerCase().includes(c.structure.toLowerCase())) &&
                                      c.nom &&
                                      !c.nom.toLowerCase().includes('direction')
                                  );
                                  if (match?.nom) {
                                    return <span className="text-slate-900">{match.nom}</span>;
                                  }
                                  const fallback = comptes.find(
                                    (c) =>
                                      (c.role === 'directeur_ced' || c.roles?.includes('structure')) &&
                                      c.nom &&
                                      !c.nom.toLowerCase().includes('direction')
                                  );
                                  if (fallback?.nom) {
                                    return <span className="text-slate-900">{fallback.nom}</span>;
                                  }
                                } catch {}
                                return (
                                  <span className="text-slate-500 italic font-normal">
                                    {fr.commission.aCompleterALaMain}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="p-3 h-16 min-h-[64px] bg-slate-50/50"></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Fait à Fès, le [JJ/MM/AAAA] */}
                  <div className="pt-4 text-right">
                    <p className="text-xs font-bold text-slate-900">
                      {fr.commission.pvModele.faitAFes} <span className="font-black">{dateFormatted}</span>
                    </p>
                  </div>
                </div>

                {/* PIED DE PAGE 2 SUR 2 */}
                <div className="pt-3 mt-6 border-t border-slate-400 flex items-center justify-between text-[10px] text-slate-600">
                  <div className="font-semibold text-slate-700">
                    {fr.commission.pvModele.footerTitre}
                  </div>
                  <div className="font-bold text-slate-800">
                    {fr.commission.pvModele.footerDocOfficiel}
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span>{fr.commission.pvModele.footerPage2}</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-bold text-slate-900">{refCandidat}</span>
                    <div className="ml-1">
                      <QRCodeSVG value={qrCodeUrl} size={36} level="M" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
