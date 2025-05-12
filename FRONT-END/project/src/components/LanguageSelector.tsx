import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { useThemeStore } from '../stores/theme';

interface LanguageSelectorProps {
  isLarge?: boolean;
  transparent?: boolean;
}

export default function LanguageSelector({ isLarge = false, transparent = false }: LanguageSelectorProps) {
  const { i18n } = useTranslation();
  const { isDarkMode } = useThemeStore();

  const languages = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  ];

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
    document.documentElement.dir = languageCode === 'ar' ? 'rtl' : 'ltr';
  };

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  return (
    <div className="relative group">
      <button
        className={`flex items-center gap-2 rounded-lg ${
          isDarkMode 
            ? 'border border-gray-600 bg-gray-800' 
            : transparent 
              ? 'bg-transparent' 
              : 'border border-white-200 bg-white'
        } ${
          isLarge 
            ? 'px-4 py-2.5 text-base hover:bg-gray-50 dark:hover:bg-gray-700' 
            : 'px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700'
        } transition-colors`}
        aria-label="Select language"
      >
        <Globe className={isLarge ? 'w-5 h-5' : 'w-4 h-4'} />
        <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
          {currentLanguage.nativeName}
        </span>
      </button>
      
      <div className={`absolute ${i18n.dir() === 'rtl' ? 'right-0' : 'left-0'} mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50`}>
        <div className="py-1">
          {languages.map(({ code, nativeName }) => (
            <button
              key={code}
              onClick={() => handleLanguageChange(code)}
              className={`w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center justify-between ${
                i18n.language === code ? 'text-blue-600 font-medium bg-blue-50' : 'text-gray-700'
              }`}
            >
              <span>{nativeName}</span>
              {i18n.language === code && (
                <div className="w-2 h-2 rounded-full bg-blue-600" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}