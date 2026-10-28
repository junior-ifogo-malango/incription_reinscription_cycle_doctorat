import React, { useState } from 'react';
import { GraduationCap, LogIn, LogOut, RotateCcw, User, ChevronDown, ShoppingBag } from 'lucide-react';
import { UserRole } from '../types';
import { fr } from '../i18n/fr';
import { TabType } from './MobileNav';

interface HeaderProps {
  role: UserRole;
  isLoggedIn: boolean;
  userName?: string;
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  onOpenLogin: () => void;
  onLogout: () => void;
  onReset: () => void;
  panierCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  role,
  isLoggedIn,
  userName,
  currentTab,
  onTabChange,
  onOpenLogin,
  onLogout,
  onReset,
  panierCount = 0,
}) => {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  // Liens de navigation pour desktop (≥768px)
  const getNavLinks = (): { id: TabType; label: string; badge?: string }[] => {
    if (!isLoggedIn) {
      return [
        { id: 'sujets', label: fr.nav.sujets },
      ];
    }
    if (role === 'candidat') {
      return [
        { id: 'sujets', label: fr.nav.sujets },
        { id: 'dossier', label: fr.nav.dossier },
        { id: 'entretiens', label: fr.nav.entretiens },
      ];
    }
    if (role === 'enseignant') {
      return [
        { id: 'sujets', label: fr.nav.mesSujets },
        { id: 'candidatures_recues', label: fr.nav.candidatures },
        { id: 'entretiens', label: fr.nav.mesCreneaux },
      ];
    }
    // directeur_ced
    return [
      { id: 'ced', label: fr.nav.exceptionsCed },
      { id: 'sujets', label: fr.nav.sujets },
      { id: 'entretiens', label: fr.nav.entretiens },
    ];
  };

  const navLinks = getNavLinks();

  return (
    <header className="sticky top-0 z-40 bg-emerald-950 text-white shadow-md border-b border-emerald-900">
      <div className="max-w-[1100px] mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Gauche : Logo + USMBA Fès */}
        <div
          onClick={() => onTabChange('sujets')}
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-800 flex items-center justify-center text-amber-300 shadow-inner">
            <GraduationCap size={20} />
          </div>
          <span className="font-bold text-sm tracking-tight text-white block">
            {fr.app.institution}
          </span>
        </div>

        {/* Droite : Menu desktop + Icône panier */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Menu horizontal sur tablette et PC (≥768px) */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = currentTab === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => onTabChange(link.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-emerald-800 text-amber-300'
                      : 'text-emerald-100 hover:text-white hover:bg-emerald-900/60'
                  }`}
                >
                  <span>{link.label}</span>
                  {link.badge && (
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white font-bold text-[10px]">
                      {link.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Se connecter ou Mon compte comme DERNIER élément du menu */}
            {!isLoggedIn ? (
              <button
                onClick={onOpenLogin}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition text-emerald-100 hover:text-white hover:bg-emerald-900/60 flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn size={14} />
                <span>{fr.auth.login}</span>
              </button>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                    accountMenuOpen
                      ? 'bg-emerald-800 text-amber-300'
                      : 'text-emerald-100 hover:text-white hover:bg-emerald-900/60'
                  }`}
                >
                  <User size={14} className="text-emerald-300" />
                  <span className="max-w-[120px] truncate">{userName || fr.auth.accountMenu}</span>
                  <ChevronDown size={13} className="text-emerald-400" />
                </button>

                {accountMenuOpen && (
                  <div
                    className="absolute right-0 top-full mt-1.5 w-48 bg-white text-slate-800 rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <div className="px-3 py-2 border-b border-slate-100">
                      <p className="font-bold text-slate-900 truncate">{userName || fr.auth.accountMenu}</p>
                      <span className="text-[10px] font-semibold uppercase text-emerald-700">
                        {role === 'candidat'
                          ? fr.auth.roleCandidatBadge
                          : role === 'enseignant'
                          ? fr.auth.roleEnseignantBadge
                          : fr.auth.roleCedBadge}
                      </span>
                    </div>

                    <button
                      onClick={onReset}
                      className="w-full text-left px-3 py-2 text-slate-600 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <RotateCcw size={13} />
                      <span>{fr.nav.resetData}</span>
                    </button>

                    <button
                      onClick={onLogout}
                      className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <LogOut size={13} />
                      <span>{fr.auth.logout}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Icône panier avec badge, visible sur toutes les pages et tous les écrans */}
          <button
            onClick={() => onTabChange('panier')}
            aria-label={fr.nav.panier}
            title={fr.nav.panier}
            className={`relative p-2 rounded-xl transition cursor-pointer flex items-center justify-center ${
              currentTab === 'panier'
                ? 'bg-emerald-800 text-amber-300 ring-1 ring-amber-300/40'
                : 'text-emerald-100 hover:text-white hover:bg-emerald-900/60'
            }`}
          >
            <ShoppingBag size={20} />
            <span
              className={`absolute -top-1 -right-1 text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow-xs transition-colors ${
                panierCount > 0
                  ? 'bg-amber-400 text-slate-950 font-black'
                  : 'bg-emerald-800 text-emerald-300 font-bold'
              }`}
            >
              {panierCount}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
