import React, { useState, useEffect } from 'react';
import { X, LogIn, ChevronDown, ChevronUp, AlertCircle, KeyRound } from 'lucide-react';
import { UserRole, Candidat, Compte, normaliserRole, getCompteRoles } from '../types';
import { fr } from '../i18n/fr';
import { DEMO_CANDIDAT_YASSINE, INITIAL_ENSEIGNANTS, MOCK_CANDIDATS, getComptes } from '../data/mockData';
import { logEvent } from '../utils/journal';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (role: UserRole, email: string, candidateData?: Candidat, compte?: Compte) => void;
  onRequestCreateAccount?: () => void;
  onOpenVoteComite?: () => void;
  restrictionMessage?: string;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onRequestCreateAccount,
  onOpenVoteComite,
  restrictionMessage,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setPassword('');
      setError(null);
    }
  }, [isOpen]);

  // Fermeture par Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) return;

    // Détection du compte et lecture dynamique de son rôle (compte.role)
    const isDemoPassword = cleanPassword === 'demo1234';

    // 0. Vérification des comptes gérés (admin, comptes en attente ou validés)
    const comptes = getComptes();
    const compteTrouve = comptes.find((c) => c.email && c.email.toLowerCase().trim() === cleanEmail);
    if (compteTrouve) {
      const matchPass = compteTrouve.motDePasse ? compteTrouve.motDePasse === cleanPassword : isDemoPassword;
      if (!matchPass) {
        setError(fr.auth.invalidCredentials);
        return;
      }
      if (compteTrouve.statut === 'en_attente' || compteTrouve.statut === 'refuse') {
        setError(fr.auth.accountPendingValidation);
        return;
      }
      const roles = getCompteRoles(compteTrouve);
      const primaryRole = normaliserRole(roles[0] || compteTrouve.role || 'candidat');
      logEvent(
        { id: compteTrouve.id, nom: compteTrouve.nom, role: primaryRole },
        fr.journalActions.connexion,
        cleanEmail
      );
      onLoginSuccess(primaryRole, cleanEmail, undefined, compteTrouve);
      onClose();
      return;
    }

    // 1. Compte Yassine (Candidat)
    if (
      (cleanEmail === 'yassine@demo.ma' ||
        cleanEmail === 'yassine.elfassi@demo.ma' ||
        cleanEmail === 'yassine.elfassi@etu.usmba.ac.ma') &&
      isDemoPassword
    ) {
      if (DEMO_CANDIDAT_YASSINE.desactive) {
        setError(fr.auth.accountDeactivated);
        return;
      }
      logEvent(
        { id: DEMO_CANDIDAT_YASSINE.id, nom: DEMO_CANDIDAT_YASSINE.nom, role: 'candidat' },
        fr.journalActions.connexion,
        cleanEmail
      );
      onLoginSuccess('candidat', cleanEmail, DEMO_CANDIDAT_YASSINE);
      onClose();
      return;
    }

    // 2. Compte Directeur de thèse (Enseignant)
    if (
      (cleanEmail === 'prof@demo.ma' ||
        cleanEmail === 'k.elamrani@usmba.ac.ma') &&
      isDemoPassword
    ) {
      logEvent(
        { id: 'ens-1', nom: 'Pr. Karim El Amrani', role: 'enseignant' },
        fr.journalActions.connexion,
        cleanEmail
      );
      onLoginSuccess('enseignant', cleanEmail);
      onClose();
      return;
    }

    // 3. Compte Structure (CED)
    if (
      (cleanEmail === 'ced@demo.ma' ||
        cleanEmail === 'ced@usmba.ac.ma') &&
      isDemoPassword
    ) {
      logEvent(
        { id: 'dir-ced', nom: 'Directeur CED', role: 'directeur_ced' },
        fr.journalActions.connexion,
        cleanEmail
      );
      onLoginSuccess('directeur_ced', cleanEmail);
      onClose();
      return;
    }

    // Autres enseignants
    const teacherMatch = INITIAL_ENSEIGNANTS.find(
      (t) => t.email && t.email.toLowerCase().trim() === cleanEmail
    );
    if (teacherMatch && isDemoPassword) {
      if (teacherMatch.desactive) {
        setError(fr.auth.accountDeactivated);
        return;
      }
      onLoginSuccess('enseignant', cleanEmail);
      onClose();
      return;
    }

    // Autres candidats de démonstration
    const candMatch = MOCK_CANDIDATS.find(
      (c) => c.email && c.email.toLowerCase().trim() === cleanEmail
    );
    if (candMatch && isDemoPassword) {
      if (candMatch.desactive) {
        setError(fr.auth.accountDeactivated);
        return;
      }
      onLoginSuccess('candidat', cleanEmail, candMatch);
      onClose();
      return;
    }

    // Comptes enregistrés dans localStorage (toujours rôle candidat)
    try {
      const rawAccounts = localStorage.getItem('usmba_registered_accounts');
      const accounts: Candidat[] = rawAccounts ? JSON.parse(rawAccounts) : [];
      const foundInAccounts = accounts.find(
        (a) => a.email && a.email.toLowerCase().trim() === cleanEmail
      );

      if (foundInAccounts) {
        if (foundInAccounts.desactive) {
          setError(fr.auth.accountDeactivated);
          return;
        }
        if (foundInAccounts.motDePasse && foundInAccounts.motDePasse === cleanPassword) {
          onLoginSuccess('candidat', cleanEmail, foundInAccounts);
          onClose();
          return;
        } else {
          setError(fr.auth.invalidCredentials);
          return;
        }
      }

      const rawCur = localStorage.getItem('usmba_doctorat_candidat');
      if (rawCur) {
        const cur: Candidat = JSON.parse(rawCur);
        if (cur.email && cur.email.toLowerCase().trim() === cleanEmail) {
          if (cur.desactive) {
            setError(fr.auth.accountDeactivated);
            return;
          }
          if (cur.motDePasse && cur.motDePasse === cleanPassword) {
            onLoginSuccess('candidat', cleanEmail, cur);
            onClose();
            return;
          }
        }
      }
    } catch {
      // safe fallback
    }

    // Échec de vérification : erreur unique
    setError(fr.auth.invalidCredentials);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 md:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full md:max-w-[420px] bg-white rounded-t-2xl md:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête sobre */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <LogIn size={16} className="text-emerald-700" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              {fr.auth.loginTitle}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Message de restriction si redirection */}
        {restrictionMessage && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="text-amber-700 shrink-0" />
            <span>{restrictionMessage}</span>
          </div>
        )}

        {/* Formulaire standard e-mail + mot de passe */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              {fr.auth.emailLabel}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ex: yassine@demo.ma"
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              {fr.auth.passwordLabel}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
              required
            />
          </div>

          <button
            type="submit"
            disabled={!email.trim() || !password.trim()}
            className={`w-full min-h-[44px] py-2.5 rounded-xl text-xs font-bold transition shadow-xs ${
              !email.trim() || !password.trim()
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-700 hover:bg-emerald-800 text-white active:scale-95 cursor-pointer'
            }`}
          >
            {fr.auth.btnSubmitLogin}
          </button>
          {(!email.trim() || !password.trim()) && (
            <p className="text-[11px] text-slate-500 text-center pt-0.5">
              {fr.auth.loginDisabledReason}
            </p>
          )}
        </form>

        {/* Lien discret « Comptes de démo » (replié par défaut) */}
        <div className="px-4 pb-3 pt-2 border-t border-slate-100 bg-slate-50/70 text-center">
          <button
            type="button"
            onClick={() => setShowDemoAccounts((prev) => !prev)}
            className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 underline underline-offset-2 transition cursor-pointer inline-flex items-center gap-1"
          >
            <span>{fr.auth.demoAccountsToggle}</span>
            {showDemoAccounts ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showDemoAccounts && (
            <div className="mt-2 space-y-1.5 animate-in fade-in duration-150">
              {(['yassine@demo.ma', 'prof@demo.ma', 'ced@demo.ma', 'karim.structure@demo.ma'] as const).map((demoEmail) => (
                <button
                  key={demoEmail}
                  type="button"
                  onClick={() => {
                    setEmail(demoEmail);
                    setPassword('demo1234');
                    setError(null);
                  }}
                  className="w-full text-left py-2 px-3 rounded-lg text-xs font-mono bg-white hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 border border-slate-200 text-slate-700 transition cursor-pointer active:scale-98 shadow-2xs flex items-center justify-between"
                >
                  <span>{demoEmail}</span>
                  <span className="text-[10px] text-slate-400 font-sans">demo1234</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Liens bas de modale : Vote comité SANS compte + Création compte candidat */}
        <div className="p-3 text-center border-t border-slate-100 bg-white space-y-1.5">
          {onOpenVoteComite && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenVoteComite();
              }}
              className="text-xs font-semibold text-amber-800 hover:text-amber-900 hover:underline flex items-center justify-center gap-1.5 w-full cursor-pointer py-1"
            >
              <KeyRound size={13} className="text-amber-600" />
              <span>{fr.auth.comiteVoteLink}</span>
            </button>
          )}

          {onRequestCreateAccount && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onRequestCreateAccount();
              }}
              className="text-xs font-semibold text-emerald-700 hover:underline block w-full cursor-pointer py-0.5"
            >
              {fr.auth.linkCreateAccount}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
