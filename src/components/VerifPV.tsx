import React, { useMemo } from 'react';
import { ShieldCheck, ShieldAlert, CheckCircle2, AlertTriangle, ArrowLeft, FileText, Calendar, Hash } from 'lucide-react';
import { PV } from '../types';
import { fr } from '../i18n/fr';

// Démo : fonctionne seulement dans le même navigateur (localStorage)

interface VerifPVProps {
  code: string;
  onClose?: () => void;
}

export const VerifPV: React.FC<VerifPVProps> = ({ code, onClose }) => {
  // Recherche du PV dans le localStorage
  const { pv, nextVersion, allPvs } = useMemo(() => {
    let pvs: PV[] = [];
    try {
      const raw = localStorage.getItem('usmba_doctorat_pvs');
      if (raw) {
        pvs = JSON.parse(raw);
      }
    } catch {
      pvs = [];
    }

    const cleanCode = (code || '').trim().toUpperCase();
    const found = pvs.find((p) => p.code?.trim().toUpperCase() === cleanCode);

    let nextVer: number | null = null;
    if (found?.remplaceePar) {
      const next = pvs.find((p) => p.id === found.remplaceePar);
      nextVer = next ? (next.version ?? 2) : ((found.version ?? 1) + 1);
    }

    return { pv: found, nextVersion: nextVer, allPvs: pvs };
  }, [code]);

  const handleBack = () => {
    if (onClose) {
      onClose();
    } else {
      window.location.hash = '';
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const [y, m, d] = dateStr.split('-');
      if (y && m && d) return `${d}/${m}/${y}`;
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Si aucun PV trouvé pour ce code
  if (!pv) {
    return (
      <div className="max-w-xl mx-auto py-10 px-4">
        <div className="bg-white border border-rose-200 rounded-3xl p-6 sm:p-8 shadow-sm text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert size={36} />
          </div>
          <div>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700 mb-2">
              Code : {code || '—'}
            </span>
            <h2 className="text-xl font-black text-rose-900">
              {fr.verifPV.pvInconnu}
            </h2>
            <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
              {fr.verifPV.notFoundDesc}
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-98"
            >
              <ArrowLeft size={14} />
              <span>{fr.verifPV.btnHome}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const reference = `PV-${pv.date}-${pv.code.slice(0, 4)}`;
  const versionNum = pv.version ?? 1;
  const isReplaced = Boolean(pv.remplaceePar);
  const statutLabel = fr.commission.pvStatuts[pv.statut] || pv.statut;

  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-4">
      {/* Bouton retour */}
      <div>
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs transition cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>{fr.verifPV.btnHome}</span>
        </button>
      </div>

      {/* Carte officielle de vérification */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        {/* En-tête */}
        <div className="text-center space-y-2 border-b border-slate-100 pb-5">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto shadow-inner">
            <ShieldCheck size={32} />
          </div>
          <p className="text-[11px] font-bold tracking-wider uppercase text-emerald-800">
            Université Sidi Mohamed Ben Abdellah — Fès
          </p>
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900">
            {fr.verifPV.title}
          </h1>
          <p className="text-xs text-slate-500">
            {fr.verifPV.subtitle}
          </p>
        </div>

        {/* Diagnostic de validité (grand badge) */}
        <div
          className={`p-4 rounded-2xl border text-center space-y-1 ${
            isReplaced
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            {isReplaced ? (
              <AlertTriangle size={18} className="text-amber-600 shrink-0" />
            ) : (
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            )}
            <span className="text-sm font-black tracking-wide">
              {isReplaced
                ? fr.verifPV.statusReplaced.replace('{version}', String(nextVersion || versionNum + 1))
                : fr.verifPV.statusValid}
            </span>
          </div>
          {isReplaced && pv.motifReouverture && (
            <p className="text-[11px] text-amber-800 mt-1 italic">
              Motif de réouverture : « {pv.motifReouverture} »
            </p>
          )}
        </div>

        {/* Métadonnées officielles du document (strictement aucune donnée personnelle) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs">
          {/* Référence */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <FileText size={11} />
              <span>{fr.verifPV.referenceLabel}</span>
            </span>
            <p className="font-mono font-bold text-slate-900 text-sm">
              {reference}
            </p>
          </div>

          {/* Version */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Hash size={11} />
              <span>{fr.verifPV.versionLabel}</span>
            </span>
            <p className="font-bold text-slate-900">
              Version {versionNum}
            </p>
          </div>

          {/* Date de séance */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Calendar size={11} />
              <span>{fr.verifPV.dateLabel}</span>
            </span>
            <p className="font-semibold text-slate-800">
              {formatDate(pv.date)}
            </p>
          </div>

          {/* Statut officiel */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {fr.verifPV.statutLabel}
            </span>
            <p className="font-semibold text-slate-800">
              {statutLabel}
            </p>
          </div>
        </div>

        {/* Code de vérification scanné */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono bg-slate-100/70 px-3.5 py-2 rounded-xl">
          <span>Code de sécurité :</span>
          <span className="font-bold text-slate-900 tracking-wider">{pv.code}</span>
        </div>

        {/* Mention de stricte confidentialité (aucune donnée personnelle : ni nom, ni note) */}
        <p className="text-[11px] text-slate-400 text-center italic border-t border-slate-100 pt-4">
          {fr.verifPV.noticeConfidentiality}
        </p>
      </div>
    </div>
  );
};
