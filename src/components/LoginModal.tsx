import React, { useState, useEffect } from 'react';
import { X, LogIn, UserCheck, BookOpenCheck, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { UserRole } from '../types';
import { fr } from '../i18n/fr';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (role: UserRole, email: string) => void;
  onRequestCreateAccount?: () => void;
  restrictionMessage?: string;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onRequestCreateAccount,
  restrictionMessage,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

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

    if (cleanEmail === 'yassine@demo.ma' || cleanEmail.includes('yassine') || cleanEmail.includes('candidat')) {
      onLoginSuccess('candidat', cleanEmail);
      onClose();
    } else if (cleanEmail === 'prof@demo.ma' || cleanEmail.includes('prof') || cleanEmail.includes('elamrani') || cleanEmail.includes('enseignant')) {
      onLoginSuccess('enseignant', cleanEmail);
      onClose();
    } else if (cleanEmail === 'ced@demo.ma' || cleanEmail.includes('ced') || cleanEmail.includes('directeur')) {
      onLoginSuccess('directeur_ced', cleanEmail);
      onClose();
    } else {
      setError(fr.auth.invalidCredentials);
    }
  };

  const handleQuickDemo = (role: UserRole) => {
    if (role === 'candidat') {
      setEmail('yassine@demo.ma');
      setPassword('••••••••');
      onLoginSuccess('candidat', 'yassine@demo.ma');
      onClose();
    } else if (role === 'enseignant') {
      setEmail('prof@demo.ma');
      setPassword('••••••••');
      onLoginSuccess('enseignant', 'prof@demo.ma');
      onClose();
    } else {
      setEmail('ced@demo.ma');
      setPassword('••••••••');
      onLoginSuccess('directeur_ced', 'ced@demo.ma');
      onClose();
    }
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
            className="w-full min-h-[44px] py-2.5 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white transition active:scale-95 shadow-xs"
          >
            {fr.auth.btnSubmitLogin}
          </button>
        </form>

        {/* 3 boutons rapides « Entrer en démo » */}
        <div className="px-4 pb-3 pt-1 border-t border-slate-100 bg-slate-50/70">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2 text-center">
            {fr.auth.enterDemoLabel}
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickDemo('candidat')}
              className="py-2 px-1 text-[11px] font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:border-emerald-600 hover:text-emerald-700 transition flex flex-col items-center gap-0.5 active:scale-95 shadow-xs"
            >
              <UserCheck size={14} className="text-emerald-600" />
              <span>{fr.auth.btnDemoCandidat}</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemo('enseignant')}
              className="py-2 px-1 text-[11px] font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:border-blue-600 hover:text-blue-700 transition flex flex-col items-center gap-0.5 active:scale-95 shadow-xs"
            >
              <BookOpenCheck size={14} className="text-blue-600" />
              <span>{fr.auth.btnDemoEnseignant}</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemo('directeur_ced')}
              className="py-2 px-1 text-[11px] font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:border-amber-600 hover:text-amber-700 transition flex flex-col items-center gap-0.5 active:scale-95 shadow-xs"
            >
              <ShieldCheck size={14} className="text-amber-600" />
              <span>{fr.auth.btnDemoDirecteur}</span>
            </button>
          </div>
        </div>

        {/* Lien de création de compte */}
        {onRequestCreateAccount && (
          <div className="p-3 text-center border-t border-slate-100 bg-white">
            <button
              type="button"
              onClick={() => {
                onClose();
                onRequestCreateAccount();
              }}
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              {fr.auth.linkCreateAccount}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
