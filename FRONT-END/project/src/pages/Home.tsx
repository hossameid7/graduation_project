import { Activity, ArrowRight, Sun, Moon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';
import { useThemeStore } from '../stores/theme';

export default function Home() {
  const { t } = useTranslation();
  const { isDarkMode, toggleDarkMode } = useThemeStore();

  return (
    <div className={`min-h-screen bg-gradient-to-b ${isDarkMode ? 'from-gray-900 to-black' : 'from-blue-50 to-white'}`}>
      <div className="container mx-auto px-4 py-12">
        <nav className="flex justify-between items-center mb-16">
          <div className="flex items-center gap-2">
            <Activity className="w-8 h-8 text-blue-600" />
            <span className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{t('transformerMonitor')}</span>
          </div>
          <div className="flex items-center space-x-4">
            <LanguageSelector isLarge={true} transparent={!isDarkMode} />
            <button
              onClick={toggleDarkMode}
              className={`px-4 py-2 flex items-center ${isDarkMode ? 'text-white hover:text-gray-300' : 'text-gray-600 hover:text-gray-900'}`}
            >
              {isDarkMode ? <Sun className="w-5 h-5 mr-2" /> : <Moon className="w-5 h-5 mr-2" />}
              {isDarkMode ? t('switchToLight') : t('switchToDark')}
            </button>
            <Link
              to="/login"
              className={`px-4 py-2 ${isDarkMode ? 'text-white hover:text-gray-300' : 'text-gray-600 hover:text-gray-900'}`}
            >
              {t('login')}
            </Link>
            <Link
              to="/signup"
              className={`px-4 py-2 ${isDarkMode ? 'bg-blue-800 text-white' : 'bg-blue-600 text-white'} rounded-lg hover:${isDarkMode ? 'bg-blue-900' : 'bg-blue-700'} transition-colors`}
            >
              {t('signup')}
            </Link>
          </div>
        </nav>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className={`text-4xl md:text-5xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-6`}>
              {t('welcomeTitle')}
            </h1>
            <p className={`text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-8`}>
              {t('welcomeDescription')}
            </p>
            <div className="space-x-4">
              <Link
                to="/signup"
                className={`inline-flex items-center px-6 py-3 ${isDarkMode ? 'bg-blue-800 text-white' : 'bg-blue-600 text-white'} rounded-lg hover:${isDarkMode ? 'bg-blue-900' : 'bg-blue-700'} transition-colors`}
              >
                {t('getStarted')}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <a
                href="#features"
                className={`inline-flex items-center px-6 py-3 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-50 text-gray-800'} rounded-lg hover:${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'} transition-colors`}
              >
                {t('learnMore')}
              </a>
            </div>
          </div>
          <div className="hidden md:block">
            <img
              src="https://ncetest.com/wp-content/uploads/2024/05/shutterstock_1971671024-455x300.jpg"
              alt="High voltage power transformer"
              className="rounded-lg shadow-xl object-cover w-full aspect-4/3"
            />
          </div>
        </div>

        <div id="features" className="py-24">
          <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-12 text-center`}>
            {t('features')}
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className={`p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md border ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-4`}>
                {t('feature1Title')}
              </h3>
              <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {t('feature1Desc')}
              </p>
            </div>
            <div className={`p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md border ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-4`}>
                {t('feature2Title')}
              </h3>
              <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {t('feature2Desc')}
              </p>
            </div>
            <div className={`p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md border ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-4`}>
                {t('feature3Title')}
              </h3>
              <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {t('feature3Desc')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}