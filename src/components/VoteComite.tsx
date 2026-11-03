import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserCheck,
  MessageCircle,
  Mail,
  ArrowLeft,
  BookOpen,
  Calendar,
  Award,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { Rapport, Vote } from '../types';
import { INITIAL_RAPPORTS } from '../data/mockData';
import { fr } from '../i18n/fr';
import {
  normaliserTel,
  lienWhatsApp,
  lienMail,
  ouvrirLien,
  isEmailValide,
} from '../utils/messages';

const STORAGE_KEY_RAPPORTS = 'usmba_doctorat_rapports';

interface VoteComiteProps {
  onClose?: () => void;
  initialCode?: string;
}

export const VoteComite: React.FC<VoteComiteProps> = ({ onClose, initialCode = '' }) => {
  const [code, setCode] = useState(initialCode);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Rapport et vote trouvés
  const [activeRapport, setActiveRapport] = useState<Rapport | null>(null);
  const [activeVoteIndex, setActiveVoteIndex] = useState<number | null>(null);
  const [commentaire, setCommentaire] = useState('');

  // Téléphone / Email optionnels pour invitation du membre
  const [inviteTel, setInviteTel] = useState('0612345678');
  const [inviteEmail, setInviteEmail] = useState('expert@demo.ma');

  // Recherche du rapport par code
  const handleVerifyCode = (codeToTest?: string) => {
    setErrorMsg(null);
    const targetCode = (codeToTest || code).trim().toUpperCase();

    if (targetCode.length !== 12) {
      setErrorMsg(fr.reinscription.codeInvalidLength);
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY_RAPPORTS);
      const list: Rapport[] = raw ? JSON.parse(raw) : INITIAL_RAPPORTS;

      for (const r of list) {
        if (r.comite) {
          const vIdx = r.comite.findIndex(
            (v) => v.code.toUpperCase() === targetCode
          );
          if (vIdx !== -1) {
            setActiveRapport(r);
            setActiveVoteIndex(vIdx);
            setCode(targetCode);
            setCommentaire(r.comite[vIdx].commentaire || '');
            return;
          }
        }
      }

      setErrorMsg(fr.reinscription.codeNotFound);
    } catch {
      setErrorMsg('Erreur de lecture du stockage.');
    }
  };

  useEffect(() => {
    if (initialCode && initialCode.trim().length === 12) {
      handleVerifyCode(initialCode);
    }
  }, [initialCode]);

  // Soumission de l'avis
  const handleVote = (avis: 'FAVORABLE' | 'DEFAVORABLE') => {
    if (!activeRapport || activeVoteIndex === null) return;

    if (avis === 'DEFAVORABLE' && (!commentaire.trim() || commentaire.trim().length < 5)) {
      setErrorMsg(fr.reinscription.defavorableCommentRequired);
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY_RAPPORTS);
      const list: Rapport[] = raw ? JSON.parse(raw) : INITIAL_RAPPORTS;

      const rIndex = list.findIndex((r) => r.id === activeRapport.id);
      if (rIndex === -1) return;

      const targetReport = { ...list[rIndex] };
      if (!targetReport.comite || !targetReport.comite[activeVoteIndex]) return;

      const currentVote = targetReport.comite[activeVoteIndex];
      // Règle : un code ne vote qu'une seule fois
      if (currentVote.votéLe) {
        setErrorMsg('Ce code a déjà été utilisé pour voter.');
        return;
      }

      const nowIso = new Date().toISOString();
      const todayStr = new Date().toLocaleDateString('fr-FR');

      currentVote.avis = avis;
      currentVote.commentaire = commentaire.trim();
      currentVote.votéLe = nowIso;

      targetReport.chronologie = [
        ...(targetReport.chronologie || []),
        {
          date: todayStr,
          acteur: currentVote.membre,
          action: `Avis ${avis === 'FAVORABLE' ? 'FAVORABLE' : 'DÉFAVORABLE'} émis par le membre du comité`,
        },
      ];

      list[rIndex] = targetReport;
      localStorage.setItem(STORAGE_KEY_RAPPORTS, JSON.stringify(list));

      setActiveRapport(targetReport);
      setToastMsg(fr.reinscription.voteSubmittedToast);
      window.dispatchEvent(new CustomEvent('usmba_rapports_updated'));
      setTimeout(() => setToastMsg(null), 4000);
    } catch {
      setErrorMsg('Erreur lors de l’enregistrement du vote.');
    }
  };

  const activeVote =
    activeRapport && activeVoteIndex !== null && activeRapport.comite
      ? activeRapport.comite[activeVoteIndex]
      : null;

  const hasAlreadyVoted = Boolean(activeVote?.votéLe);

  // Message d'invitation sans le contenu du rapport
  const inviteMessageText = fr.reinscription.comiteInviteBody.replace('{code}', code);
  const waUrl = lienWhatsApp(inviteTel, inviteMessageText);
  const mailUrl = lienMail(inviteEmail, fr.reinscription.comiteInviteSubject, inviteMessageText);
  const hasValidTel = Boolean(inviteTel && normaliserTel(inviteTel));
  const hasValidEmail = Boolean(inviteEmail && isEmailValide(inviteEmail));

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* En-tête */}
      <div className="bg-slate-900 text-white rounded-xl p-4 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-amber-300">
            {fr.reinscription.comitePageTitle}
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            {fr.reinscription.comitePageSubtitle}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>{fr.common.back}</span>
          </button>
        )}
      </div>

      {toastMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ÉCRAN 1 : SAISIE DU CODE À 12 CARACTÈRES */}
      {!activeRapport ? (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <KeyRound size={20} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                {fr.reinscription.codeModalTitle}
              </h3>
              <p className="text-[11px] text-slate-500">
                {fr.reinscription.codeModalSub}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              {fr.reinscription.codeFieldLabel}
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                maxLength={12}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={fr.reinscription.codeFieldPlaceholder}
                className="flex-1 text-sm font-mono tracking-widest px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase font-bold"
              />
              <button
                type="button"
                onClick={() => handleVerifyCode()}
                className="px-5 py-2.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <ShieldCheck size={16} />
                <span>{fr.reinscription.btnVerifyCode}</span>
              </button>
            </div>
          </div>

          {/* Raccourcis de démo pour tests */}
          <div className="pt-3 border-t border-slate-100 bg-slate-50 -mx-5 -mb-5 p-4 rounded-b-xl space-y-2">
            <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Codes de démo disponibles (12 caractères) :
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleVerifyCode('COMITE88P44X')}
                className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 font-mono hover:bg-slate-100 cursor-pointer"
              >
                COMITE88P44X (Expert 2 - En attente)
              </button>
              <button
                type="button"
                onClick={() => handleVerifyCode('COMITE99W66Q')}
                className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 font-mono hover:bg-slate-100 cursor-pointer"
              >
                COMITE99W66Q (Labo 3 - En attente)
              </button>
              <button
                type="button"
                onClick={() => handleVerifyCode('COMITE77K92M')}
                className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 font-mono hover:bg-slate-100 cursor-pointer"
              >
                COMITE77K92M (Rapporteur 1 - Déjà voté)
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ÉCRAN 2 : RAPPORT EN LECTURE SEULE + FORMULAIRE DE VOTE */
        <div className="space-y-4">
          {/* Identité du membre */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <UserCheck size={18} />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {fr.reinscription.comiteMemberLabel}
                </span>
                <p className="text-xs font-bold text-slate-900">
                  {activeVote?.membre || 'Membre de commission'}
                </p>
                <p className="text-[11px] text-slate-500 font-mono">Code : {code}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveRapport(null);
                setActiveVoteIndex(null);
                setCode('');
              }}
              className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
            >
              Changer de code
            </button>
          </div>

          {/* Règle stricte du silence */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertCircle size={15} className="text-amber-700 shrink-0 mt-0.5" />
            <span>{fr.reinscription.silenceWarning}</span>
          </div>

          {/* Rapport en lecture seule */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {activeRapport.annee}ᵉ année de doctorat
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-1">{activeRapport.titre}</h3>
              </div>
            </div>

            {/* Indicateurs calculés */}
            <div className="grid grid-cols-3 gap-2 text-center py-2 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <p className="text-base font-bold text-emerald-700">{activeRapport.publications?.length || 0}</p>
                <span className="text-[10px] text-slate-600">Publications</span>
              </div>
              <div>
                <p className="text-base font-bold text-sky-700">{activeRapport.communications?.length || 0}</p>
                <span className="text-[10px] text-slate-600">Communications</span>
              </div>
              <div>
                <p className="text-base font-bold text-amber-700">{activeRapport.formationsHeures || 0} h</p>
                <span className="text-[10px] text-slate-600">Formations</span>
              </div>
            </div>

            {/* Avancement */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-1">
                Avancement des travaux de recherche :
              </h4>
              <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 whitespace-pre-wrap leading-relaxed">
                {activeRapport.avancement || 'Aucun descriptif saisi.'}
              </p>
            </div>

            {/* Publications */}
            {activeRapport.publications && activeRapport.publications.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-1">
                  Publications scientifiques ({activeRapport.publications.length}) :
                </h4>
                <ul className="space-y-1 text-xs">
                  {activeRapport.publications.map((p, idx) => (
                    <li key={idx} className="bg-slate-50 p-2 rounded border border-slate-200">
                      <p className="font-semibold text-slate-900">{p.titre}</p>
                      {p.doi && <p className="text-[11px] text-slate-500 font-mono">DOI: {p.doi}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Perspectives */}
            {activeRapport.perspectives && (
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-1">
                  Perspectives pour l’année à venir :
                </h4>
                <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200 whitespace-pre-wrap">
                  {activeRapport.perspectives}
                </p>
              </div>
            )}
          </div>

          {/* ZONE DE VOTE DU MEMBRE */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Votre délibération :
            </h3>

            {hasAlreadyVoted ? (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <p className="font-bold text-slate-900">
                  {fr.reinscription.alreadyVotedNotice
                    .replace('{avis}', activeVote?.avis || '')
                    .replace(
                      '{date}',
                      activeVote?.votéLe
                        ? new Date(activeVote.votéLe).toLocaleDateString('fr-FR')
                        : ''
                    )}
                </p>
                {activeVote?.commentaire && (
                  <p className="text-[11px] text-slate-600 italic">
                    « {activeVote.commentaire} »
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {fr.reinscription.avisCommentLabel}
                  </label>
                  <textarea
                    rows={3}
                    value={commentaire}
                    onChange={(e) => setCommentaire(e.target.value)}
                    placeholder={fr.reinscription.avisCommentPlaceholder}
                    className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-700 leading-relaxed"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleVote('FAVORABLE')}
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                  >
                    <CheckCircle2 size={16} />
                    <span>{fr.reinscription.btnAvisFavorable}</span>
                  </button>

                  <div className="flex-1 flex flex-col">
                    <button
                      type="button"
                      disabled={!commentaire.trim() || commentaire.trim().length < 5}
                      onClick={() => handleVote('DEFAVORABLE')}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                        commentaire.trim().length >= 5
                          ? 'bg-rose-700 hover:bg-rose-800 text-white cursor-pointer shadow-xs active:scale-98'
                          : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      }`}
                    >
                      <AlertCircle size={16} />
                      <span>{fr.reinscription.btnAvisDefavorable}</span>
                    </button>
                    {commentaire.trim().length < 5 && (
                      <span className="text-[10px] text-rose-600 font-medium mt-1 text-center">
                        {fr.reinscription.defavorableCommentRequired}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* NOTIFICATION DU MEMBRE VIA WHATSAPP OU EMAIL (RÉUTILISATION DE messages.ts SANS CONTENU DU RAPPORT) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              {fr.reinscription.shareCodeTitle}
            </h4>
            <p className="text-[11px] text-slate-500">
              Message sécurisé contenant uniquement le lien et le code, sans révéler le contenu du rapport.
            </p>

            <div className="flex items-center gap-2 flex-wrap pt-1">
              <button
                type="button"
                disabled={!hasValidTel}
                onClick={() => waUrl && ouvrirLien(waUrl)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  hasValidTel
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <MessageCircle size={13} />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                disabled={!hasValidEmail}
                onClick={() => mailUrl && ouvrirLien(mailUrl)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  hasValidEmail
                    ? 'bg-sky-600 hover:bg-sky-700 text-white cursor-pointer shadow-xs'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Mail size={13} />
                <span>E-mail</span>
              </button>
            </div>

            <p className="text-[10px] text-slate-500 italic mt-1">
              {fr.messages.disclaimer}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
