import { Activity, History, LogOut, Plus, User, MessageCircle, MessageSquare, Sun, Moon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import { useTranslation } from 'react-i18next';
import LanguageSelector from './LanguageSelector';

export default function Layout({ children }: { children: React.ReactNode }) {
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const { isDarkMode, toggleDarkMode } = useThemeStore();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-dark' : 'bg-gray-50'}`}>
      <div className="flex">
        <aside className={`w-64 min-h-screen ${isDarkMode ? 'bg-dark-paper border-dark' : 'bg-white border-gray-200'} shadow-lg p-4 flex flex-col ${i18n.dir() === 'rtl' ? 'border-l' : 'border-r'}`}>
          <div className="flex items-center gap-2 mb-8">
            <Activity className="w-8 h-8 text-blue-500" />
            <span className={`text-lg font-semibold ${isDarkMode ? 'text-dark-primary' : 'text-gray-900'}`}>
              {t('transformerMonitor')}
            </span>
          </div>
          
          <nav className="space-y-2">
            <Link
              to="/dashboard"
              className={`flex items-center gap-2 p-2 rounded ${isDarkMode ? 'text-dark-secondary hover:bg-dark-hover hover:text-dark-accent' : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'}`}
            >
              <Activity size={20} className={i18n.dir() === 'rtl' ? 'ml-2' : 'mr-2'} />
              <span>{t('dashboard')}</span>
            </Link>
            <Link
              to="/new-measurement"
              className={`flex items-center gap-2 p-2 rounded ${isDarkMode ? 'text-dark-secondary hover:bg-dark-hover hover:text-dark-accent' : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'}`}
            >
              <Plus size={20} className={i18n.dir() === 'rtl' ? 'ml-2' : 'mr-2'} />
              <span>{t('newMeasurement')}</span>
            </Link>
            <Link
              to="/history"
              className={`flex items-center gap-2 p-2 rounded ${isDarkMode ? 'text-dark-secondary hover:bg-dark-hover hover:text-dark-accent' : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'}`}
            >
              <History size={20} className={i18n.dir() === 'rtl' ? 'ml-2' : 'mr-2'} />
              <span>{t('history')}</span>
            </Link>
            <Link
              to="/profile"
              className={`flex items-center gap-2 p-2 rounded ${isDarkMode ? 'text-dark-secondary hover:bg-dark-hover hover:text-dark-accent' : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'}`}
            >
              <User size={20} className={i18n.dir() === 'rtl' ? 'ml-2' : 'mr-2'} />
              <span>{t('profile')}</span>
            </Link>
          
            {/* Only show support link for non-admin users */}
            {!user?.is_staff && (
              <Link
                to="/support"
                className={`flex items-center gap-2 p-2 rounded ${isDarkMode ? 'text-dark-secondary hover:bg-dark-hover hover:text-dark-accent' : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'}`}
              >
                <MessageCircle size={20} className={i18n.dir() === 'rtl' ? 'ml-2' : 'mr-2'} />
                <span>{t('support.title')}</span>
              </Link>
            )}

            {/* Show admin support center only for admin users */}
            {user?.is_staff && (
              <Link
                to="/admin-support"
                className={`flex items-center gap-2 p-2 rounded ${isDarkMode ? 'text-dark-secondary hover:bg-dark-hover hover:text-dark-accent' : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'}`}
              >
                <MessageSquare size={20} className={i18n.dir() === 'rtl' ? 'ml-2' : 'mr-2'} />
                <span>{t('AdminCenter')}</span>
              </Link>
            )}
 <button
                onClick={toggleDarkMode}
                className={`flex items-center gap-2 p-2 rounded w-full ${isDarkMode ? 'text-dark-secondary hover:bg-dark-hover hover:text-dark-accent' : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'}`}
              >
                {isDarkMode ? (
                  <>
                    <Sun size={20} className={i18n.dir() === 'rtl' ? 'ml-2' : 'mr-2'} />
                    <span>{t('switchToLight', 'Switch to Light Mode')}</span>
                  </>
                ) : (
                  <>
                    <Moon size={20} className={i18n.dir() === 'rtl' ? 'ml-2' : 'mr-2'} />
                    <span>{t('switchToDark', 'Switch to Dark Mode')}</span>
                  </>
                )}
              </button>
            <button
              onClick={handleLogout}
              className={`flex items-center gap-2 p-2 rounded w-full ${isDarkMode ? 'text-dark-secondary hover:bg-dark-hover hover:text-dark-accent' : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'}`}
            >
              <LogOut size={20} className={i18n.dir() === 'rtl' ? 'ml-2' : 'mr-2'} />
              <span>{t('logout')}</span>
            </button>
           

            <div className={`pt-2 mt-2 border-t ${isDarkMode ? 'border-dark' : 'border-gray-200'} space-y-2`}>
              <div className="p-2">
                <LanguageSelector />
              </div>
             
            </div>
          </nav>
        </aside>
        
        <main className={`flex-1 p-8 ${isDarkMode ? 'bg-dark' : 'bg-gray-50'} overflow-auto`}>
          {children}
        </main>
      </div>
    </div>
  );
}