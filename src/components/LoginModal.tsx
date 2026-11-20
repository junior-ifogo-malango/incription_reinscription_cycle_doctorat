import React, { useState, useEffect, useRef } from 'react';
import { X, LogIn, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { UserRole, Candidat, Compte, normaliserRole, getCompteRoles } from '../types';
import { fr } from '../i18n/fr';
import { INITIAL_ENSEIGNANTS, MOCK_CANDIDATS, getComptes } from '../data/mockData';
import { storageService } from '../services/storage';
import { logEvent, logCompteCree } from '../utils/journal';
import { signInWithGoogle, signOutFirebase, isUsmbaEmail } from '../firebase';
import { resolveGoogleSession } from '../utils/googleAuthResolver';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (role: UserRole, email: string, candidateData?: Candidat, compte?: Compte) => void;
  onRequestCreateAccount?: () => void;
  onOpenVoteComite?: () => void;
  restrictionMessage?: string;
  initialMode?: 'login' | 'register';
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const DEMO_KNOWN_EMAILS = new Set([
  'etudiant@gmail.com',
  'directeurthese@gmail.com',
  'directeurstructure@gmail.com',
  'admin@gmail.com',
]);

function checkIsKnownEmail(cleanEmail: string): boolean {
  if (!cleanEmail || cleanEmail.endsWith('@demo.ma')) return false;
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
  restrictionMessage,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const hasAutoFocusedPasswordRef = useRef(false);

  const cleanEmail = email.trim().toLowerCase();
  const isEmailValid = EMAIL_REGEX.test(cleanEmail);
  const isLegacyDemoEmail = cleanEmail.endsWith('@demo.ma');
  const isKnown = isEmailValid && checkIsKnownEmail(cleanEmail);
  const isTestAccount = DEMO_KNOWN_EMAILS.has(cleanEmail);
  const cleanPassword = password.trim();
  const isPasswordLongEnough = isTestAccount
    ? cleanPassword.length > 0
    : cleanPassword.length >= 8;
  const isFormValid = isEmailValid && isPasswordLongEnough;

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setEmail('');
      setPassword('');
      setShowPassword(false);
      setEmailTouched(false);
      setPasswordTouched(false);
      setError(null);
      setGoogleError(null);
      setGoogleLoading(false);
      hasAutoFocusedPasswordRef.current = false;
      requestAnimationFrame(() => emailInputRef.current?.focus());
    }
  }, [isOpen, initialMode]);

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setError(null);
    setGoogleError(null);
    setEmailTouched(false);
    setPasswordTouched(false);
    hasAutoFocusedPasswordRef.current = false;
    requestAnimationFrame(() => emailInputRef.current?.focus());
  };

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

  const handleGoogleSignIn = async () => {
    if (googleLoading) return;
    setGoogleError(null);
    setError(null);
    setGoogleLoading(true);
    try {
      const { profile } = await signInWithGoogle();
      const resolved = resolveGoogleSession(profile);
      if (resolved.error) {
        await signOutFirebase();
        setGoogleError(resolved.error);
        return;
      }
      logEvent(
        {
          id: resolved.compte?.id || profile.uid,
          nom: resolved.compte?.nom || profile.displayName || resolved.email,
          role: resolved.role,
        },
        fr.journalActions.connexion,
        `${resolved.email} (${
          isUsmbaEmail(resolved.email) ? fr.auth.usmbaGoogleBadge : fr.auth.googleAccountBadge
        })`
      );
      onLoginSuccess(resolved.role, resolved.email, resolved.candidateData, resolved.compte);
      onClose();
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setGoogleError(fr.auth.googlePopupClosed);
      } else if (code === 'auth/popup-blocked') {
        setGoogleError(fr.auth.googlePopupBlocked);
      } else if (code === 'auth/unauthorized-domain') {
        setGoogleError(fr.auth.googleUnauthorizedDomain);
      } else if (code === 'auth/operation-not-allowed') {
        setGoogleError(fr.auth.googleOperationNotAllowed);
      } else if (code === 'auth/account-exists-with-different-credential') {
        setGoogleError(fr.auth.googleAccountExistsDifferentCred);
      } else if (code === 'auth/user-disabled') {
        setGoogleError(fr.auth.accountDeactivated);
      } else {
        setGoogleError(fr.auth.googleSignInError);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    setPasswordTouched(true);
    setError(null);

    if (!isEmailValid || !isPasswordLongEnough) return;
    if (isLegacyDemoEmail) {
      setError(fr.auth.invalidCredentials);
      return;
    }
    if (mode === 'register' && isKnown) return;

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

    // 0. Vérification des comptes gérés (Scolarité, Directeur de thèse, Structure)
    const comptes = getComptes();
    const compteTrouve = comptes.find((c) => c.email && c.email.toLowerCase().trim() === cleanEmail);
    if (compteTrouve) {
      const matchPass = Boolean(compteTrouve.motDePasse && compteTrouve.motDePasse === cleanPassword);
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

    // Comptes enregistrés dans localStorage (toujours rôle candidat, en priorité pour préserver les saisies)
    const candMatch = MOCK_CANDIDATS.find(
      (c) => c.email && c.email.toLowerCase().trim() === cleanEmail
    );

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
        const expectedPass = foundInAccounts.motDePasse || candMatch?.motDePasse;
        if (expectedPass && expectedPass === cleanPassword) {
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
          const expectedPass = cur.motDePasse || candMatch?.motDePasse;
          if (expectedPass && expectedPass === cleanPassword) {
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

    // Compte candidat de test local (etudiant@gmail.com)
    if (candMatch) {
      if (candMatch.desactive) {
        setError(fr.auth.accountDeactivated);
        return;
      }
      if (candMatch.motDePasse && candMatch.motDePasse === cleanPassword) {
        logEvent(
          {
            id: candMatch.id,
            nom: candMatch.nom?.trim() || cleanEmail,
            role: 'candidat',
          },
          fr.journalActions.connexion,
          cleanEmail
        );
        onLoginSuccess('candidat', cleanEmail, candMatch);
        onClose();
        return;
      }
    }

    // Échec de vérification : erreur sous le champ mot de passe
    setError(fr.auth.invalidCredentials);
  };

  const showEmailError = emailTouched && email.trim().length > 0 && !isEmailValid;
  const showPasswordShortError =
    passwordTouched &&
    password.length > 0 &&
    !isPasswordLongEnough;
  const passwordFieldError = error || (showPasswordShortError ? fr.auth.passwordTooShort : null);

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
              {mode === 'register' ? fr.auth.createAccountTitle : fr.auth.loginTitle}
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
        {(restrictionMessage || (initialMode === 'register' && fr.auth.loginToContinue)) && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="text-amber-700 shrink-0" />
            <span>{restrictionMessage || fr.auth.loginToContinue}</span>
          </div>
        )}

        {/* Formulaire E-mail + Mot de passe visibles dès l'ouverture */}
        <form onSubmit={handleSubmit} noValidate className="p-4 pb-3 space-y-3">
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
            {mode === 'register' && isKnown && (
              <p className="text-[11px] text-rose-600 font-medium mt-1">
                {fr.auth.emailAlreadyExists}
              </p>
            )}
          </div>

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
            {(mode === 'register' || (isEmailValid && !isKnown && !isLegacyDemoEmail)) && (
              <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 font-medium mt-1.5">
                {fr.auth.newAccountHint}
              </p>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={!isFormValid || (mode === 'register' && isKnown)}
              className={`w-full min-h-[44px] py-2.5 rounded-xl text-xs font-bold transition shadow-xs ${
                !isFormValid || (mode === 'register' && isKnown)
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white active:scale-95 cursor-pointer'
              }`}
            >
              {mode === 'register' || (isEmailValid && !isKnown && !isLegacyDemoEmail)
                ? fr.auth.btnCreateAccount
                : fr.auth.btnSubmitLogin}
            </button>
            {!isFormValid && (
              <p className="text-[11px] text-slate-500 text-center pt-1.5">
                {fr.auth.loginDisabledSimpleReason}
              </p>
            )}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => switchMode(mode === 'register' ? 'login' : 'register')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
              >
                {mode === 'register' ? fr.auth.alreadyHaveAccountLink : fr.auth.noAccountCreateLink}
              </button>
            </div>
          </div>
        </form>

        {/* Séparateur "ou" puis bouton Continuer avec Google en dessous du formulaire */}
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-semibold text-slate-400">
              {fr.auth.orSeparator}
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="space-y-1.5">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 active:scale-[0.99] text-slate-800 text-xs font-bold transition shadow-xs flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            >
              {googleLoading ? (
                <Loader2 size={16} className="animate-spin text-emerald-700 shrink-0" />
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="shrink-0"
                >
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
              )}
              <span>{googleLoading ? fr.auth.googleSignInLoading : fr.auth.googleSignIn}</span>
            </button>

            {googleError && (
              <div className="space-y-0.5 text-center pt-0.5">
                <p className="text-[11px] text-rose-600 font-medium">
                  {googleError}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

