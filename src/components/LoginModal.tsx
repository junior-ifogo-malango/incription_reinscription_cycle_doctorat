import React, { useState, useEffect, useRef } from 'react';
import { X, LogIn, AlertCircle, KeyRound, Eye, EyeOff } from 'lucide-react';
import { UserRole, Candidat, Compte, normaliserRole, getCompteRoles } from '../types';
import { fr } from '../i18n/fr';
import { DEMO_CANDIDAT_YASSINE, INITIAL_ENSEIGNANTS, MOCK_CANDIDATS, getComptes } from '../data/mockData';
import { storageService } from '../services/storage';
import { logEvent, logCompteCree } from '../utils/journal';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (role: UserRole, email: string, candidateData?: Candidat, compte?: Compte) => void;
  onRequestCreateAccount?: () => void;
  onOpenVoteComite?: () => void;
  restrictionMessage?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const DEMO_KNOWN_EMAILS = new Set([
  'yassine@demo.ma',
  'yassine.elfassi@demo.ma',
  'yassine.elfassi@etu.usmba.ac.ma',
  'prof@demo.ma',
  'k.elamrani@usmba.ac.ma',
  'ced@demo.ma',
  'ced@usmba.ac.ma',
]);

function checkIsKnownEmail(cleanEmail: string): boolean {
  if (!cleanEmail) return false;
  if (DEMO_KNOWN_EMAILS.has(cleanEmail)) return true;

  const comptes = getComptes();
  if (comptes.some((c) => c.email && c.email.toLowerCase().trim() === cleanEmail)) return true;

  if (INITIAL_ENSEIGNANTS.some((t) => t.email && t.email.toLowerCase().trim() === cleanEmail)) return true;
  if (MOCK_CANDIDATS.some((c) => c.email && c.email.toLowerCase().trim() === cleanEmail)) return true;

  try {
    const rawAccounts = localStorage.getItem('usmba_registered_accounts');
    if (rawAccounts) {
      const accounts: Candidat[] = JSON.parse(rawAccounts);
      if (accounts.some((a) => a.email && a.email.toLowerCase().trim() === cleanEmail)) return true;
    }
    const rawCur = localStorage.getItem('usmba_doctorat_candidat');
    if (rawCur) {
      const cur: Candidat = JSON.parse(rawCur);
      if (cur.compteCree && cur.email && cur.email.toLowerCase().trim() === cleanEmail) return true;
    }
  } catch {
    // safe fallback
  }

  return false;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onOpenVoteComite,
  restrictionMessage,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const hasAutoFocusedPasswordRef = useRef(false);

  const cleanEmail = email.trim().toLowerCase();
  const isEmailValid = EMAIL_REGEX.test(cleanEmail);
  const isKnown = isEmailValid && checkIsKnownEmail(cleanEmail);
  const cleanPassword = password.trim();
  const isPasswordLongEnough = cleanPassword.length >= 8;
  const isFormValid = isEmailValid && isPasswordLongEnough;

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setPassword('');
      setShowPassword(false);
      setEmailTouched(false);
      setPasswordTouched(false);
      setError(null);
      hasAutoFocusedPasswordRef.current = false;
      requestAnimationFrame(() => emailInputRef.current?.focus());
    }
  }, [isOpen]);

  // Focus sur Mot de passe dès que l'e-mail atteint un format valide
  useEffect(() => {
    if (!isOpen) return;
    if (!isEmailValid) {
      hasAutoFocusedPasswordRef.current = false;
      return;
    }
    if (!hasAutoFocusedPasswordRef.current) {
      const timer = setTimeout(() => {
        if (passwordInputRef.current && document.activeElement !== passwordInputRef.current) {
          passwordInputRef.current.focus();
          hasAutoFocusedPasswordRef.current = true;
        }
      }, 380);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isEmailValid, email]);

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
    setEmailTouched(true);
    setPasswordTouched(true);
    setError(null);

    if (!isEmailValid || !isPasswordLongEnough) return;

    // Cas création de nouveau compte (e-mail inconnu -> toujours Candidat)
    if (!isKnown) {
      const newCandId = `cand-${Date.now()}`;
      let existingPanier: string[] = [];
      try {
        const cur = storageService.getCandidat();
        if (cur && Array.isArray(cur.panier)) {
          existingPanier = cur.panier;
        }
      } catch {}

      const newCandidat: Candidat = {
        id: newCandId,
        nom: '',
        cne: '',
        cin: '',
        email: cleanEmail,
        tel: '',
        motDePasse: cleanPassword,
        panier: existingPanier,
        panierInteret: existingPanier,
        candidatures: [],
        interets: [],
        compteCree: true,
        verificationStatut: 'verifie',
      };

      try {
        const rawAccounts = localStorage.getItem('usmba_registered_accounts');
        const accounts: Candidat[] = rawAccounts ? JSON.parse(rawAccounts) : [];
        const filtered = accounts.filter(
          (a) => !a.email || a.email.toLowerCase().trim() !== cleanEmail
        );
        filtered.push(newCandidat);
        localStorage.setItem('usmba_registered_accounts', JSON.stringify(filtered));
      } catch {
        // safe fallback
      }

      storageService.setCandidat(newCandidat);
      logCompteCree(newCandId, cleanEmail);
      onLoginSuccess('candidat', cleanEmail, newCandidat);
      onClose();
      return;
    }

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
        { id: 'dir-ced', nom: 'Directeur de structure', role: 'directeur_ced' },
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
          logEvent(
            {
              id: foundInAccounts.id,
              nom: foundInAccounts.nom?.trim() || cleanEmail,
              role: 'candidat',
            },
            fr.journalActions.connexion,
            cleanEmail
          );
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
            logEvent(
              {
                id: cur.id,
                nom: cur.nom?.trim() || cleanEmail,
                role: 'candidat',
              },
              fr.journalActions.connexion,
              cleanEmail
            );
            onLoginSuccess('candidat', cleanEmail, cur);
            onClose();
            return;
          }
        }
      }
    } catch {
      // safe fallback
    }

    // Échec de vérification : erreur sous le champ mot de passe
    setError(fr.auth.invalidCredentials);
  };

  const showEmailError = emailTouched && email.trim().length > 0 && !isEmailValid;
  const showPasswordShortError =
    isEmailValid &&
    password.length > 0 &&
    !isPasswordLongEnough &&
    (!isKnown || passwordTouched);
  const passwordFieldError = error || (showPasswordShortError ? fr.auth.passwordTooShort : null);

  const disabledReason = !isEmailValid
    ? fr.auth.loginDisabledEmailReason
    : !isPasswordLongEnough
    ? fr.auth.loginDisabledPasswordReason
    : null;

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
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
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

        {/* Formulaire progressif unique : E-mail d'abord, puis Mot de passe */}
        <form onSubmit={handleSubmit} noValidate className="p-4 space-y-3">
          <div>
            <label htmlFor="login-email-input" className="block text-[11px] font-bold text-slate-700 mb-1">
              {fr.auth.emailLabel}
            </label>
            <input
              ref={emailInputRef}
              id="login-email-input"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              onBlur={() => setEmailTouched(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isEmailValid && !password) {
                  e.preventDefault();
                  passwordInputRef.current?.focus();
                  hasAutoFocusedPasswordRef.current = true;
                }
              }}
              className={`w-full text-xs p-2.5 rounded-lg border focus:outline-none focus:ring-1 bg-white ${
                showEmailError
                  ? 'border-rose-400 focus:ring-rose-500'
                  : 'border-slate-300 focus:ring-emerald-600'
              }`}
              required
            />
            {showEmailError && (
              <p className="text-[11px] text-rose-600 font-medium mt-1">
                {fr.auth.invalidEmail}
              </p>
            )}
          </div>

          {isEmailValid && (
            <div className="space-y-2 animate-in fade-in duration-150">
              {!isKnown && (
                <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 font-medium">
                  {fr.auth.newAccountHint}
                </p>
              )}

              <div>
                <label htmlFor="login-password-input" className="block text-[11px] font-bold text-slate-700 mb-1">
                  {fr.auth.passwordLabel}
                </label>
                <div className="relative flex items-center">
                  <input
                    ref={passwordInputRef}
                    id="login-password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    onBlur={() => setPasswordTouched(true)}
                    placeholder="••••••••"
                    className={`w-full text-xs p-2.5 pr-9 rounded-lg border focus:outline-none focus:ring-1 bg-white ${
                      passwordFieldError
                        ? 'border-rose-400 focus:ring-rose-500'
                        : 'border-slate-300 focus:ring-emerald-600'
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? fr.auth.hidePassword : fr.auth.showPassword}
                    className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {passwordFieldError && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">
                    {passwordFieldError}
                  </p>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={!isFormValid}
            className={`w-full min-h-[44px] py-2.5 rounded-xl text-xs font-bold transition shadow-xs ${
              !isFormValid
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-700 hover:bg-emerald-800 text-white active:scale-95 cursor-pointer'
            }`}
          >
            {isEmailValid && !isKnown ? fr.auth.btnCreateAccount : fr.auth.btnSubmitLogin}
          </button>
          {disabledReason && (
            <p className="text-[11px] text-slate-500 text-center pt-0.5">
              {disabledReason}
            </p>
          )}
        </form>

        {/* Lien bas de modale : Vote comité SANS compte */}
        {onOpenVoteComite && (
          <div className="p-3 text-center border-t border-slate-100 bg-white">
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
          </div>
        )}
      </div>
    </div>
  );
};

