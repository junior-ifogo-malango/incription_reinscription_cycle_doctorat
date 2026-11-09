import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, ArrowLeft, CheckCircle2, Clock, XCircle, FileSignature } from 'lucide-react';
import { PV, ResultatType } from '../types';
import { MOCK_CANDIDATS, INITIAL_SUJETS } from '../data/mockData';
import { fr } from '../i18n/fr';

interface PVDocumentProps {
  pv: PV;
  directeurNom: string;
  onClose: () => void;
}

export const PVDocument: React.FC<PVDocumentProps> = ({
  pv,
  directeurNom,
  onClose,
}) => {
  const getCandidatInfo = (candidatId: string) => {
    // Check mock candidates
    let c = MOCK_CANDIDATS.find((x) => x.id === candidatId);
    if (!c) {
      try {
        const raw = localStorage.getItem('usmba_doctorat_candidat');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.id === candidatId) c = parsed;
        }
      } catch {}
    }
    if (!c) {
      try {
        const rawAccounts = localStorage.getItem('usmba_registered_accounts');
        if (rawAccounts) {
          const accs = JSON.parse(rawAccounts);
          c = accs.find((x: any) => x.id === candidatId);
        }
      } catch {}
    }

    const nom = c?.nom || candidatId;
    const cne = c?.cne || '—';
    const sujetId = c?.candidatures?.[0];
    const sujetObj = INITIAL_SUJETS.find((s) => s.id === sujetId);
    const sujet = sujetObj ? sujetObj.titre : 'Thèse de doctorat USMBA';

    return { nom, cne, sujet };
  };

  const renderResultBadge = (res: ResultatType) => {
    switch (res) {
      case 'ADMIS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 size={12} className="text-emerald-600" />
            <span>{fr.commission.resultats.ADMIS}</span>
          </span>
        );
      case 'LISTE_COMPLEMENTAIRE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock size={12} className="text-amber-600" />
            <span>{fr.commission.resultats.LISTE_COMPLEMENTAIRE}</span>
          </span>
        );
      case 'REFUSE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <XCircle size={12} className="text-rose-600" />
            <span>{fr.commission.resultats.REFUSE}</span>
          </span>
        );
      default:
        return <span>{res}</span>;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = () => {
    try {
      const [y, m, d] = pv.date.split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return pv.date;
    }
  };

  const reference = `PV-${pv.date}-${pv.code.slice(0, 4)}`;
  const versionNum = pv.version ?? 1;

  // Pagination : 8 candidats par page imprimée
  const ITEMS_PER_PAGE = 8;
  const pages: (typeof pv.resultats)[] = [];
  if (pv.resultats.length === 0) {
    pages.push([]);
  } else {
    for (let i = 0; i < pv.resultats.length; i += ITEMS_PER_PAGE) {
      pages.push(pv.resultats.slice(i, i + ITEMS_PER_PAGE));
    }
  }
  const totalPages = pages.length;

  return (
    <div className="space-y-4">
      {/* Style print isolé */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #pv-printable-section, #pv-printable-section * {
            visibility: visible !important;
          }
          #pv-printable-section {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
          }
          .pv-page {
            page-break-after: always !important;
            break-after: page !important;
            box-shadow: none !important;
            border: none !important;
            padding: 24px 20px !important;
            margin: 0 !important;
            min-height: 98vh !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }
          .pv-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Barre d'action (écran uniquement) */}
      <div className="no-print flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-3 shadow-xs">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>{fr.commission.pvDocument.btnClose}</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 font-mono">
            {reference} — v{versionNum}
          </span>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs transition cursor-pointer"
          >
            <Printer size={14} />
            <span>{fr.commission.pvDocument.btnPrint}</span>
          </button>
        </div>
      </div>

      {/* Pages du PV */}
      <div id="pv-printable-section" className="space-y-6 print:space-y-0">
        {pages.map((pageResults, pageIndex) => {
          const isLastPage = pageIndex === totalPages - 1;

          return (
            <div
              key={pageIndex}
              className="pv-page bg-white border border-slate-200 rounded-2xl p-5 sm:p-8 shadow-sm space-y-6 text-slate-900 print:border-none print:shadow-none print:rounded-none"
            >
              <div className="space-y-6">
                {/* En-tête officiel sur chaque page : porte la référence et la version */}
                <div className="border-b border-slate-200 pb-4 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold tracking-wider uppercase text-emerald-800">
                        Université Sidi Mohamed Ben Abdellah — Fès
                      </p>
                      <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">
                        {fr.commission.pvDocument.title}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {fr.commission.pvDocument.subTitle}
                      </p>
                    </div>

                    <div className="flex flex-col sm:items-end gap-1.5 self-start sm:self-auto">
                      <div className="flex items-center gap-2">
                        {/* Référence et Version officielles */}
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 font-mono">
                          <span>{reference}</span>
                          <span className="text-slate-400">•</span>
                          <span>Version {versionNum}</span>
                        </span>

                        {/* StatusBadge */}
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                          pv.statut === 'publie' || Boolean(pv.publieLe)
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : pv.statut === 'envoye'
                            ? 'bg-sky-50 text-sky-800 border-sky-300'
                            : pv.statut === 'signe'
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
                            : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}>
                          <FileSignature size={14} className={
                            pv.statut === 'publie' || Boolean(pv.publieLe) ? 'text-emerald-600' :
                            pv.statut === 'envoye' ? 'text-sky-600' :
                            pv.statut === 'signe' ? 'text-indigo-600' : 'text-amber-600'
                          } />
                          <span>{
                            pv.statut === 'publie' || Boolean(pv.publieLe)
                              ? fr.commission.pvStatuts.publie
                              : pv.statut === 'envoye'
                              ? fr.commission.pvStatuts.envoye
                              : pv.statut === 'signe'
                              ? fr.commission.pvStatuts.signe
                              : fr.commission.pvStatuts.a_signer
                          }</span>
                        </span>
                      </div>

                      {pv.remplaceePar && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          <XCircle size={12} />
                          <span>{fr.commission.replacedBadge}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-xs text-slate-700">
                    <div>
                      <span className="font-semibold text-slate-500">{fr.commission.pvDocument.dateLabel}</span>{' '}
                      <span className="font-bold text-slate-900">{formattedDate()}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-500">{fr.commission.pvDocument.directeurLabel}</span>{' '}
                      <span className="font-bold text-slate-900">{directeurNom}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-500">Structure :</span>{' '}
                      <span className="font-bold text-slate-900">{pv.structure || 'LISAC - FSDM Fès'}</span>
                    </div>
                  </div>
                </div>

                {/* Tableau des résultats (jusqu'à 8 candidats sur cette page) */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] tracking-wider font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">{fr.commission.pvDocument.tableCandidat}</th>
                        <th className="p-2.5">{fr.commission.pvDocument.tableCne}</th>
                        <th className="p-2.5">{fr.commission.pvDocument.tableSujet}</th>
                        <th className="p-2.5 text-center">{fr.commission.pvDocument.tableNote}</th>
                        <th className="p-2.5 text-center">{fr.commission.pvDocument.tableResultat}</th>
                        <th className="p-2.5">{fr.commission.pvDocument.tableMotif}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {pageResults.map((res, idx) => {
                        const info = getCandidatInfo(res.candidatId);
                        return (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">
                              {info.nom}
                            </td>
                            <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">
                              {info.cne}
                            </td>
                            <td className="p-2.5 text-slate-700 min-w-[200px]">
                              {info.sujet}
                            </td>
                            <td className="p-2.5 text-center font-bold text-emerald-800 text-sm whitespace-nowrap">
                              {res.note.toFixed(1)} / 20
                            </td>
                            <td className="p-2.5 text-center whitespace-nowrap">
                              {renderResultBadge(res.resultat)}
                            </td>
                            <td className="p-2.5 text-slate-600 text-[11px] max-w-[200px]">
                              {res.motif || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Signatures des membres de la commission (SEULEMENT SUR LA DERNIÈRE PAGE) */}
                {isLastPage && (
                  <div className="pt-4 border-t border-slate-200">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        {fr.commission.pvDocument.signaturesTitle}
                      </h4>
                      <span className="text-[11px] text-slate-500 italic">
                        {fr.commission.pvDocument.signaturesNotice}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="border border-dashed border-slate-300 rounded-xl p-3 min-h-[95px] flex flex-col justify-between bg-slate-50/50">
                        <span className="text-[11px] font-semibold text-slate-700">
                          {fr.commission.pvDocument.signatureMember1}
                        </span>
                        <div className="border-b border-slate-300 pt-10" />
                      </div>
                      <div className="border border-dashed border-slate-300 rounded-xl p-3 min-h-[95px] flex flex-col justify-between bg-slate-50/50">
                        <span className="text-[11px] font-semibold text-slate-700">
                          {fr.commission.pvDocument.signatureMember2}
                        </span>
                        <div className="border-b border-slate-300 pt-10" />
                      </div>
                      <div className="border border-dashed border-slate-300 rounded-xl p-3 min-h-[95px] flex flex-col justify-between bg-slate-50/50">
                        <span className="text-[11px] font-semibold text-slate-700">
                          {fr.commission.pvDocument.signatureMember3}
                        </span>
                        <div className="border-b border-slate-300 pt-10" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pied de page sur CHAQUE page : Page x/y, Paraphe : ________, et petit QR 56 px */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-4 text-xs text-slate-600">
                <div className="space-y-1">
                  <div className="font-semibold text-slate-800">
                    {fr.commission.pvDocument.pageIndicator
                      .replace('{current}', String(pageIndex + 1))
                      .replace('{total}', String(totalPages))}
                  </div>
                  <div className="font-mono text-slate-700 font-medium">
                    {fr.commission.pvDocument.parapheLabel}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right text-[10px] text-slate-500 hidden sm:block">
                    <p className="font-mono font-bold text-slate-800">{reference}</p>
                    <p>Version {versionNum}</p>
                  </div>
                  {/* Petit QR code 56 px */}
                  <div className="flex flex-col items-center bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                    <QRCodeSVG
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/#verif/${pv.code}`}
                      size={56}
                      level="M"
                    />
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
