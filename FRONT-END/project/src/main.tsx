import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from './stores/theme'

// Initialize RTL support and dark mode based on stored preferences
function AppInitializer() {
  const { i18n } = useTranslation();
  const { isDarkMode } = useThemeStore();
  
  // Set RTL direction
  document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  
  // Set dark mode class
  if (isDarkMode) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppInitializer />
  </StrictMode>,
)
