import React, { useState, useEffect } from 'react';
import { Send, CheckCircle2, Clock, AlertCircle, FileText, Award, MessageCircle, Mail } from 'lucide-react';
import { PV, Notification, Resultat } from '../types';
import { fr } from '../i18n/fr';
import {
  normaliserTel,
  lienWhatsApp,
  lienMail,
  ouvrirLien,
  isEmailValide,
  messageResultat,
  trouverCandidat,
} from '../utils/messages';

/**
 * Action de publication des résultats d'un PV par le CED.
 * Crée une notification par candidat du PV : « Ton résultat est publié. À faire : consulte l'onglet Entretiens. » avec mention « E-mail simulé ».
 * Règle stricte : Une seule publication par PV (si publieLe existe, ne rien recréer).
 */
export const publierResultatsPV = (pvId: string): { success: boolean; message?: string } => {
  try {
    const rawPvs = localStorage.getItem('usmba_doctorat_pvs');
    let pvs: PV[] = rawPvs ? JSON.parse(rawPvs) : [];

    const pvIndex = pvs.findIndex((p) => p.id === pvId);
    if (pvIndex === -1 || pvs[pvIndex].remplaceePar) {
      return { success: false, message: 'PV introuvable ou remplacé' };
    }

    const targetPv = pvs[pvIndex];
    // Règle stricte : Une seule publication par PV
    if (targetPv.publieLe) {
      return { success: false, message: 'Ce PV est déjà publié' };
    }

    const nowIso = new Date().toISOString();
    targetPv.publieLe = nowIso;
    pvs[pvIndex] = targetPv;
    localStorage.setItem('usmba_doctorat_pvs', JSON.stringify(pvs));

    // Crée une Notification par candidat du PV
    let currentNotifs: Notification[] = [];
    try {
      const rawNotifs = localStorage.getItem('usmba_notifications');
      if (rawNotifs) currentNotifs = JSON.parse(rawNotifs);
    } catch {}

    const newNotifs: Notification[] = (targetPv.resultats || []).map((res, idx) => ({
      id: `notif-pub-${targetPv.id}-${res.candidatId}-${Date.now()}-${idx}`,
      destinataireId: res.candidatId,
      texte: "Ton résultat est publié. À faire : consulte l'onglet Entretiens.",
      date: nowIso,
      lue: false,
    }));

    const updatedNotifs = [...newNotifs, ...currentNotifs];
    localStorage.setItem('usmba_notifications', JSON.stringify(updatedNotifs));

    window.dispatchEvent(new CustomEvent('usmba_notifications_updated'));
    window.dispatchEvent(new CustomEvent('usmba_pvs_updated'));

    return { success: true };
  } catch (err) {
    console.error('Storage error during PV publication', err);
    return { success: false, message: 'Erreur de stockage' };
  }
};

export const CedSeances: React.FC = () => {
  const [pvs, setPvs] = useState<PV[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = () => {
    try {
      const raw = localStorage.getItem('usmba_doctorat_pvs');
      if (raw) {
        const parsed: PV[] = JSON.parse(raw);
        // Ignore les versions remplacées
        setPvs(parsed.filter((p) => !p.remplaceePar));
      } else {
        // PV de démonstration initial prêt à être publié si aucun PV n'a encore été généré
        const demoResults: Resultat[] = [
          {
            creneauId: 'cr-201',
            candidatId: 'cand-001',
            note: 17.5,
            resultat: 'ADMIS',
            saisiLe: new Date().toISOString(),
          },
          {
            creneauId: 'cr-201',
            candidatId: 'cand-sara',
            note: 16.0,
            resultat: 'ADMIS',
            saisiLe: new Date().toISOString(),
          },
          {
            creneauId: 'cr-202',
            candidatId: 'cand-omar',
            note: 14.5,
            resultat: 'LISTE_COMPLEMENTAIRE',
            saisiLe: new Date().toISOString(),
          },
          {
            creneauId: 'cr-101',
            candidatId: 'cand-salma',
            note: 9.0,
            resultat: 'REFUSE',
            motif: 'Prérequis scientifiques et méthodologiques insuffisants',
            saisiLe: new Date().toISOString(),
          },
        ];

        const demoPV: PV = {
          id: 'pv-demo-fsdm-01',
          directeurId: 'ens-1',
          date: '2026-11-10',
          resultats: demoResults,
          statut: 'a_signer',
          code: 'PV-2026-FSDM-001',
          genereLe: new Date().toISOString(),
        };

        setPvs([demoPV]);
        localStorage.setItem('usmba_doctorat_pvs', JSON.stringify([demoPV]));
      }
    } catch {
      setPvs([]);
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('usmba_pvs_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('usmba_pvs_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const handlePublier = (pvId: string) => {
    const res = publierResultatsPV(pvId);
    if (res.success) {
      setMessage({ type: 'success', text: fr.cedSeances.notifSuccess });
      loadData();
    } else {
      setMessage({ type: 'error', text: res.message || 'Échec de la publication' });
    }
  };

  const formatDate = (isoString?: string) => {
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

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-amber-300">
            {fr.cedSeances.title}
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            {fr.cedSeances.subtitle}
          </p>
        </div>
        <div className="w-9 h-9 rounded-lg bg-slate-800 text-amber-300 flex items-center justify-center">
          <Award size={18} />
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle size={15} className="shrink-0 text-rose-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {pvs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-400">
          {fr.cedSeances.emptyList}
        </div>
      ) : (
        <div className="space-y-3">
          {pvs.map((pv) => {
            const isPublished = Boolean(pv.publieLe);

            return (
              <div
                key={pv.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText size={15} className="text-emerald-700" />
                      <span className="text-xs font-bold text-slate-900 font-mono">
                        PV-{pv.date}-{(pv.code || '').slice(0, 4)}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500 font-sans">
                        (v{pv.version ?? 1})
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      {fr.cedSeances.datePrefix} {pv.date} • {pv.resultats?.length || 0} {fr.cedSeances.candidatsCount} • Code : {pv.code}
                    </p>
                  </div>

                  <div>
                    {isPublished ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                        <span>
                          {fr.cedSeances.publishedOn} {formatDate(pv.publieLe)}
                        </span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePublier(pv.id)}
                        className="min-h-[36px] px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer active:scale-98"
                      >
                        <Send size={13} />
                        <span>{fr.cedSeances.btnPublier}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Liste succincte des résultats pour contrôle CED */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1.5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    {pv.resultats.map((res, i) => (
                      <div key={i} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                        <span className="font-medium text-slate-700">{res.candidatId}</span>
                        <span
                          className={`font-bold ${
                            res.resultat === 'ADMIS'
                              ? 'text-emerald-700'
                              : res.resultat === 'LISTE_COMPLEMENTAIRE'
                              ? 'text-amber-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {res.resultat}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ligne par candidat avec WhatsApp et E-mail (sur un PV publié) */}
                {isPublished && (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        {fr.messages.notifierCandidatsTitle}
                      </h4>
                    </div>

                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                      {pv.resultats.map((res, i) => {
                        const candidatInfo = trouverCandidat(res.candidatId);
                        const resultatText = messageResultat();

                        const hasValidTel = Boolean(
                          candidatInfo.tel && normaliserTel(candidatInfo.tel)
                        );
                        const telError = !candidatInfo.tel
                          ? fr.messages.missingPhone
                          : !normaliserTel(candidatInfo.tel)
                          ? fr.messages.invalidPhone
                          : null;

                        const hasValidEmail = Boolean(
                          candidatInfo.email && isEmailValide(candidatInfo.email)
                        );
                        const emailError = !candidatInfo.email
                          ? fr.messages.missingEmail
                          : !isEmailValide(candidatInfo.email)
                          ? fr.messages.invalidEmail
                          : null;

                        const waUrl = lienWhatsApp(candidatInfo.tel, resultatText);
                        const mailUrl = lienMail(
                          candidatInfo.email,
                          fr.messages.resultatSubject,
                          resultatText
                        );

                        return (
                          <div
                            key={i}
                            className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white hover:bg-slate-50 transition-colors"
                          >
                            <div>
                              <p className="text-xs font-bold text-slate-900">
                                {candidatInfo.nom || res.candidatId}
                              </p>
                              <p className="text-[11px] text-slate-500 font-mono">
                                {candidatInfo.tel || fr.messages.missingPhone} • {candidatInfo.email || fr.messages.missingEmail}
                              </p>
                            </div>

                            <div className="flex items-start gap-2 flex-wrap">
                              {/* WhatsApp */}
                              <div className="flex flex-col items-start">
                                <button
                                  type="button"
                                  disabled={!hasValidTel}
                                  onClick={() => waUrl && ouvrirLien(waUrl)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                                    hasValidTel
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs active:scale-98'
                                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                  }`}
                                >
                                  <MessageCircle size={13} className={hasValidTel ? 'text-white' : 'text-slate-400'} />
                                  <span>{fr.messages.btnWhatsApp}</span>
                                </button>
                                {!hasValidTel && (
                                  <span className="text-[10px] text-rose-600 font-medium mt-0.5">
                                    {telError}
                                  </span>
                                )}
                              </div>

                              {/* E-mail */}
                              <div className="flex flex-col items-start">
                                <button
                                  type="button"
                                  disabled={!hasValidEmail}
                                  onClick={() => mailUrl && ouvrirLien(mailUrl)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                                    hasValidEmail
                                      ? 'bg-sky-600 hover:bg-sky-700 text-white cursor-pointer shadow-xs active:scale-98'
                                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                  }`}
                                >
                                  <Mail size={13} className={hasValidEmail ? 'text-white' : 'text-slate-400'} />
                                  <span>{fr.messages.btnEmail}</span>
                                </button>
                                {!hasValidEmail && (
                                  <span className="text-[10px] text-rose-600 font-medium mt-0.5">
                                    {emailError}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Mention discrète sous les boutons */}
                    <p className="text-[10px] text-slate-500 italic px-1">
                      {fr.messages.disclaimer}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
