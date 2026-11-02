import React, { useState } from 'react';
import {
  Search,
  FolderKanban,
  CalendarCheck2,
  ShieldAlert,
  FileText,
  LogIn,
  User,
  RotateCcw,
  LogOut,
  X,
} from 'lucide-react';
import { UserRole } from '../types';
import { fr } from '../i18n/fr';

export type TabType = 'socle' | 'sujets' | 'panier' | 'dossier' | 'entretiens' | 'candidatures_recues' | 'ced';

interface MobileNavProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  role: UserRole;
  isLoggedIn: boolean;
  userName?: string;
  onOpenLogin: () => void;
  onLogout: () => void;
  onReset: () => void;
  badgeCounts?: {
    panierCount?: number;
    candidaturesCount?: number;
    piecesPretes?: number;
    alertesCed?: number;
  };
}

interface TabItem {
  id: TabType | 'login' | 'account';
  label: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentTab,
  onTabChange,
  role,
  isLoggedIn,
  userName,
  onOpenLogin,
  onLogout,
  onReset,
  badgeCounts = {},
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Déterminer les onglets visibles selon le rôle
  const getTabsForRole = (): TabItem[] => {
    const sujetsTab: TabItem = {
      id: 'sujets',
      label: fr.nav.sujets,
      icon: <Search size={18} />,
    };

    const dossierTab: TabItem = {
      id: 'dossier',
      label: fr.nav.dossier,
      icon: <FolderKanban size={18} />,
      badge: badgeCounts.piecesPretes !== undefined ? `${badgeCounts.piecesPretes}/4` : undefined,
    };

    const entretiensTab: TabItem = {
      id: 'entretiens',
      label: fr.nav.entretiens,
      icon: <CalendarCheck2 size={18} />,
    };

    const mesSujetsTab: TabItem = {
      id: 'sujets',
      label: fr.nav.mesSujets,
      icon: <Search size={18} />,
    };

    const candidaturesRecuesTab: TabItem = {
      id: 'candidatures_recues',
      label: fr.nav.candidatures,
      icon: <FileText size={18} />,
      badge: badgeCounts.candidaturesCount ? String(badgeCounts.candidaturesCount) : undefined,
    };

    const mesCreneauxTab: TabItem = {
      id: 'entretiens',
      label: fr.nav.mesCreneaux,
      icon: <CalendarCheck2 size={18} />,
    };

    const cedTab: TabItem = {
      id: 'ced',
      label: fr.nav.exceptionsCed,
      icon: <ShieldAlert size={18} />,
      badge: badgeCounts.alertesCed ? `${badgeCounts.alertesCed}` : undefined,
      badgeColor: 'bg-rose-500',
    };

    const loginTab: TabItem = {
      id: 'login',
      label: fr.auth.login,
      icon: <LogIn size={18} />,
    };

    const accountTab: TabItem = {
      id: 'account',
      label: fr.auth.accountMenu,
      icon: <User size={18} />,
    };

    // Visiteur sans compte : Sujets, Se connecter
    if (!isLoggedIn) {
      return [sujetsTab, loginTab];
    }

    // Connecté Candidat : Sujets, Dossier, Entretiens, Mon compte
    if (role === 'candidat') {
      return [sujetsTab, dossierTab, entretiensTab, accountTab];
    }

    // Connecté Enseignant
    if (role === 'enseignant') {
      return [mesSujetsTab, candidaturesRecuesTab, mesCreneauxTab, accountTab];
    }

    // Connecté Directeur CED
    return [cedTab, sujetsTab, entretiensTab, accountTab];
  };

  const tabs = getTabsForRole();

  const handleItemClick = (tabItem: TabItem) => {
    if (tabItem.id === 'login') {
      onOpenLogin();
      return;
    }
    if (tabItem.id === 'account') {
      setMobileMenuOpen(true);
      return;
    }
    onTabChange(tabItem.id as TabType);
  };

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg safe-bottom">
        <div className="max-w-md md:max-w-3xl lg:max-w-5xl mx-auto grid grid-flow-col auto-cols-fr px-2 py-1.5">
          {tabs.map((tab) => {
            const isActive = tab.id === 'account' ? mobileMenuOpen : currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleItemClick(tab)}
                type="button"
                className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all min-h-[50px] active:scale-90 cursor-pointer ${
                  isActive
                    ? 'text-emerald-700 font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <div className="relative">
                  {tab.icon}
                  {tab.badge && (
                    <span
                      className={`absolute -top-1.5 -right-3 text-[10px] font-bold px-1.5 py-0.2 rounded-full text-white shadow-xs ${
                        'badgeColor' in tab && tab.badgeColor
                          ? tab.badgeColor
                          : 'bg-emerald-600'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] mt-1 tracking-tight truncate max-w-full">
                  {tab.label}
                </span>
                {isActive && (
                  <span className="w-5 h-1 bg-emerald-600 rounded-full mt-0.5 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Menu Compte Mobile (Feuille tiroir sobre) */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="bg-white rounded-t-2xl p-4 space-y-3 shadow-2xl border-t border-slate-200 max-w-md mx-auto w-full animate-in slide-in-from-bottom-6 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <User size={16} />
                </div>
                <div>
                  <p className="font-bold text-xs text-slate-900">{userName || fr.auth.accountMenu}</p>
                  <span className="text-[10px] font-bold uppercase text-emerald-700">
                    {role === 'candidat'
                      ? fr.auth.roleCandidatBadge
                      : role === 'enseignant'
                      ? fr.auth.roleEnseignantBadge
                      : fr.auth.roleCedBadge}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onReset();
              }}
              className="w-full text-left py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center gap-2.5 text-xs font-semibold cursor-pointer"
            >
              <RotateCcw size={15} className="text-slate-500" />
              <span>{fr.nav.resetData}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onLogout();
              }}
              className="w-full text-left py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 flex items-center gap-2.5 text-xs font-semibold cursor-pointer"
            >
              <LogOut size={15} className="text-rose-600" />
              <span>{fr.auth.logout}</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-2 text-center text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              {fr.common.close}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
