import React, { useState } from 'react';
import {
  Search,
  FolderKanban,
  CalendarCheck2,
  ShieldAlert,
  FileText,
  LogIn,
  User,
  LogOut,
  X,
  MoreHorizontal,
  Calendar,
  Award,
  Users,
  GraduationCap,
} from 'lucide-react';
import { UserRole, Role, normaliserRole } from '../types';
import { fr } from '../i18n/fr';

export type TabType =
  | 'socle'
  | 'sujets'
  | 'panier'
  | 'dossier'
  | 'entretiens'
  | 'candidatures_recues'
  | 'ced'
  | 'seances'
  | 'reinscriptions'
  | 'commission'
  | 'admin_comptes'
  | 'admin_inscriptions'
  | 'admin_journal'
  | 'rapport'
  | 'suivi'
  | 'guichet'
  | 'vote_comite';

interface MobileNavProps {
  currentTab: TabType | string;
  onTabChange: (tab: TabType) => void;
  role?: UserRole;
  roles?: Role[];
  isLoggedIn: boolean;
  userName?: string;
  userEmail?: string;
  onOpenLogin: () => void;
  onLogout: () => void;
  onReset?: () => void;
  demoDateInput?: string;
  todayDate?: string;
  onDemoDateChange?: (newDate: string) => void;
  onResetDemoDate?: () => void;
  badgeCounts?: {
    panierCount?: number;
    candidaturesCount?: number;
    piecesPretes?: number;
    alertesCed?: number;
    reinscriptionsCount?: number;
  };
}

interface TabItem {
  id: TabType | 'login' | 'account' | 'plus';
  label: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentTab,
  onTabChange,
  role = 'candidat',
  roles = [],
  isLoggedIn,
  userName,
  userEmail,
  onOpenLogin,
  onLogout,
  demoDateInput = '',
  todayDate = '',
  onDemoDateChange,
  onResetDemoDate,
  badgeCounts = {},
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Union des rôles effectifs
  const effectiveRoles: Role[] =
    roles && roles.length > 0 ? roles : role ? [role] : ['candidat'];
  const normalizedRoles = Array.from(
    new Set(effectiveRoles.map((r) => normaliserRole(r)))
  );

  // Définition de tous les onglets possibles
  const allTabsMap: Record<string, TabItem> = {
    sujets: {
      id: 'sujets',
      label: normalizedRoles.includes('enseignant')
        ? fr.nav.court.sujets
        : fr.nav.court.sujets,
      icon: <Search size={18} />,
    },
    dossier: {
      id: 'dossier',
      label: fr.nav.court.dossier,
      icon: <FolderKanban size={18} />,
      badge:
        badgeCounts.piecesPretes !== undefined
          ? `${badgeCounts.piecesPretes}/3`
          : undefined,
    },
    candidatures_recues: {
      id: 'candidatures_recues',
      label: fr.nav.court.candidatures,
      icon: <FileText size={18} />,
      badge: badgeCounts.candidaturesCount
        ? String(badgeCounts.candidaturesCount)
        : undefined,
    },
    entretiens: {
      id: 'entretiens',
      label: normalizedRoles.includes('enseignant')
        ? fr.nav.court.creneaux
        : fr.nav.court.entretiens,
      icon: <CalendarCheck2 size={18} />,
    },
    commission: {
      id: 'commission',
      label: fr.commission.tabTitle,
      icon: <Award size={18} />,
    },
    seances: {
      id: 'seances',
      label: fr.nav.court.seances,
      icon: <Calendar size={18} />,
    },
    reinscriptions: {
      id: 'reinscriptions',
      label: fr.nav.court.reinscriptions,
      icon: <Award size={18} />,
    },
    ced: {
      id: 'ced',
      label: fr.nav.court.exceptionsCed,
      icon: <ShieldAlert size={18} />,
      badge: badgeCounts.alertesCed ? `${badgeCounts.alertesCed}` : undefined,
      badgeColor: 'bg-rose-500',
    },
    admin_comptes: {
      id: 'admin_comptes',
      label: fr.nav.adminComptes,
      icon: <Users size={18} />,
    },
    admin_inscriptions: {
      id: 'admin_inscriptions',
      label: fr.nav.court.adminInscriptions,
      icon: <GraduationCap size={18} />,
    },
    admin_journal: {
      id: 'admin_journal',
      label: fr.nav.adminJournal,
      icon: <FileText size={18} />,
    },
  };

  const loginTab: TabItem = {
    id: 'login',
    label: fr.auth.login,
    icon: <LogIn size={18} />,
  };

  const accountTab: TabItem = {
    id: 'account',
    label: fr.nav.court.compte,
    icon: <User size={18} />,
  };

  // Calcul de l'union des onglets sans doublon
  const getUnionTabItems = (): TabItem[] => {
    if (!isLoggedIn) {
      return [allTabsMap.sujets, loginTab, accountTab];
    }

    const items: TabItem[] = [];
    const seen = new Set<string>();

    const addTab = (key: string) => {
      if (!seen.has(key) && allTabsMap[key]) {
        seen.add(key);
        items.push(allTabsMap[key]);
      }
    };

    if (normalizedRoles.includes('candidat')) {
      addTab('sujets');
      addTab('dossier');
      addTab('entretiens');
    }
    if (normalizedRoles.includes('enseignant')) {
      addTab('candidatures_recues');
      addTab('entretiens');
      addTab('commission');
      addTab('sujets');
    }
    if (normalizedRoles.includes('directeur_ced')) {
      addTab('seances');
      addTab('reinscriptions');
      addTab('ced');
    }
    if (normalizedRoles.includes('admin')) {
      addTab('admin_comptes');
      addTab('admin_inscriptions');
      addTab('admin_journal');
    }

    if (items.length === 0) {
      addTab('sujets');
    }

    return items;
  };

  const rawUnionTabs = getUnionTabItems();

  // Règle 2 : 5 onglets max dans la barre du bas, le reste dans "Plus"
  let bottomBarItems: TabItem[] = [];
  let overflowTabs: TabItem[] = [];

  if (!isLoggedIn) {
    bottomBarItems = rawUnionTabs;
  } else {
    const totalWithAccount = rawUnionTabs.length + 1; // + accountTab
    if (totalWithAccount <= 5) {
      bottomBarItems = [...rawUnionTabs, accountTab];
      overflowTabs = [];
    } else {
      // 4 premiers onglets + bouton "Plus"
      bottomBarItems = rawUnionTabs.slice(0, 4);
      overflowTabs = rawUnionTabs.slice(4);
      bottomBarItems.push({
        id: 'plus',
        label: fr.nav.plus || 'Plus',
        icon: <MoreHorizontal size={18} />,
      });
    }
  }

  const isCurrentTabInOverflow = overflowTabs.some((t) => t.id === currentTab);

  const handleItemClick = (tabItem: TabItem) => {
    if (tabItem.id === 'login') {
      onOpenLogin();
      return;
    }
    if (tabItem.id === 'account' || tabItem.id === 'plus') {
      setMobileMenuOpen(true);
      return;
    }
    onTabChange(tabItem.id as TabType);
  };

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg safe-bottom">
        <div className="max-w-md md:max-w-3xl lg:max-w-5xl mx-auto grid grid-flow-col auto-cols-fr px-2 py-1.5">
          {bottomBarItems.map((tab) => {
            const isActive =
              tab.id === 'account'
                ? mobileMenuOpen
                : tab.id === 'plus'
                ? mobileMenuOpen || isCurrentTabInOverflow
                : currentTab === tab.id;
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

      {/* Menu Compte & Plus Mobile (Feuille tiroir sobre) */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="bg-white rounded-t-2xl p-4 space-y-3 shadow-2xl border-t border-slate-200 max-w-md mx-auto w-full animate-in slide-in-from-bottom-6 duration-200 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <User size={16} />
                </div>
                <div>
                  {isLoggedIn ? (
                    <p className="font-bold text-xs text-slate-900 break-all">{userEmail || userName || fr.auth.accountMenu}</p>
                  ) : (
                    <>
                      <p className="font-bold text-xs text-slate-900">{fr.auth.visitorBadge}</p>
                      <span className="text-[10px] font-semibold text-slate-500">{fr.auth.visitorNotConnected}</span>
                    </>
                  )}
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

            {/* Rubriques supplémentaires si barre du bas saturée (> 5 éléments) */}
            {overflowTabs.length > 0 && (
              <div className="space-y-1.5 pb-2 border-b border-slate-100">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block px-1">
                  {fr.nav.plus}
                </span>
                <div className="grid grid-cols-1 gap-1">
                  {overflowTabs.map((ovTab) => {
                    const isTabActive = currentTab === ovTab.id;
                    return (
                      <button
                        key={ovTab.id}
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          onTabChange(ovTab.id as TabType);
                        }}
                        className={`w-full text-left py-2.5 px-3 rounded-xl flex items-center justify-between text-xs font-semibold cursor-pointer transition ${
                          isTabActive
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={isTabActive ? 'text-emerald-700' : 'text-slate-500'}>
                            {ovTab.icon}
                          </span>
                          <span>{ovTab.label}</span>
                        </div>
                        {ovTab.badge && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full text-white shadow-xs ${
                              'badgeColor' in ovTab && ovTab.badgeColor
                                ? ovTab.badgeColor
                                : 'bg-emerald-600'
                            }`}
                          >
                            {ovTab.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Entrée Réinscriptions pour le directeur dans le menu Compte */}
            {normalizedRoles.includes('enseignant') && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onTabChange('reinscriptions');
                }}
                className={`w-full text-left py-2.5 px-3 rounded-xl flex items-center justify-between text-xs font-semibold cursor-pointer transition ${
                  currentTab === 'reinscriptions'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Award size={16} className={currentTab === 'reinscriptions' ? 'text-emerald-700' : 'text-slate-500'} />
                  <span>{fr.nav.reinscriptions}</span>
                </div>
                {Boolean(badgeCounts?.reinscriptionsCount && badgeCounts.reinscriptionsCount > 0) && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-600 text-white shadow-xs">
                    {badgeCounts.reinscriptionsCount}
                  </span>
                )}
              </button>
            )}

            {isLoggedIn && normalizedRoles.includes('admin') && onDemoDateChange && (
              <div
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <label htmlFor="demo-date-mobile-nav" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Calendar size={13} className="text-slate-500" />
                    <span>{fr.demoDate.label}</span>
                  </label>
                  {Boolean(demoDateInput) && onResetDemoDate && (
                    <button
                      type="button"
                      onClick={onResetDemoDate}
                      className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold underline cursor-pointer"
                    >
                      {fr.demoDate.reset}
                    </button>
                  )}
                </div>
                <input
                  id="demo-date-mobile-nav"
                  type="date"
                  value={demoDateInput || todayDate}
                  onChange={(e) => onDemoDateChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
            )}

            {!isLoggedIn ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenLogin();
                }}
                className="w-full text-left py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 flex items-center gap-2.5 text-xs font-semibold cursor-pointer"
              >
                <LogIn size={15} className="text-emerald-700" />
                <span>{fr.auth.login}</span>
              </button>
            ) : (
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
            )}

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
