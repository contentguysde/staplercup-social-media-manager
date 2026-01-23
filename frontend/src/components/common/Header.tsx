import { RefreshCw, LogOut, User, ChevronDown, Globe } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import type { Language } from '../../types/auth';

interface HeaderProps {
  title: string;
  onRefresh?: () => void;
  loading?: boolean;
}

export function Header({ title, onRefresh, loading }: HeaderProps) {
  const { t } = useTranslation();
  const { user, logout, changeLanguage } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [changingLanguage, setChangingLanguage] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
  };

  const handleLanguageChange = async (language: Language) => {
    if (user?.language === language || changingLanguage) return;
    setChangingLanguage(true);
    try {
      await changeLanguage(language);
    } catch (error) {
      console.error('Failed to change language:', error);
    } finally {
      setChangingLanguage(false);
    }
  };

  const roleLabels: Record<string, string> = {
    admin: t('common.roles.admin'),
    manager: t('common.roles.manager'),
    viewer: t('common.roles.viewer'),
  };

  const languageLabels: Record<Language, string> = {
    de: 'Deutsch',
    en: 'English',
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <h2 className="text-xl font-semibold text-gray-800">{title}</h2>

      <div className="flex items-center gap-4">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span>{t('common.refresh')}</span>
          </button>
        )}

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
              <User size={16} className="text-white" />
            </div>
            <span className="text-sm font-medium">{user?.name}</span>
            <ChevronDown size={16} className={`transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                  {roleLabels[user?.role || 'viewer']}
                </span>
              </div>

              {/* Language Switcher */}
              <div className="px-4 py-2 border-b border-gray-100">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <Globe size={14} />
                  <span>{t('language.label')}</span>
                </div>
                <div className="flex gap-1">
                  {(['de', 'en'] as Language[]).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => handleLanguageChange(lang)}
                      disabled={changingLanguage}
                      className={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition-colors ${
                        user?.language === lang
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      } ${changingLanguage ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {languageLabels[lang]}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={16} />
                <span>{t('auth.logout')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
