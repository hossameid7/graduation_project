import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Activity, Home, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const login = useAuthStore((state) => state.login);
  const { isDarkMode, toggleDarkMode } = useThemeStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      // Set session expiration in browser cookies based on remember me option
      document.cookie = `session_persistent=${rememberMe ? '1' : '0'}; path=/`;
      
      await login(username, password);
      
      // After successful login, prefetch data before redirecting
      setIsRedirecting(true);
      
      try {
        // Prefetch measurements and transformers in parallel
        await Promise.all([
          queryClient.prefetchQuery({
            queryKey: ['measurements'],
            queryFn: async () => {
              const response = await api.get('/api/measurements/');
              return response.data;
            },
          }),
          queryClient.prefetchQuery({
            queryKey: ['transformers'],
            queryFn: async () => {
              const response = await api.get('/api/transformers/');
              return response.data;
            },
          })
        ]);
      } catch (prefetchError) {
        // If prefetch fails, continue anyway - the dashboard will handle it
        console.error('Prefetch error:', prefetchError);
      }
      
      // Navigate to dashboard after prefetching
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || t('invalidCredentials', 'Invalid credentials'));
      setIsRedirecting(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-dark' : 'bg-gray-50'} flex flex-col`}>
      {/* Header with Home and Dark Mode buttons */}
      <div className="p-4 flex justify-start gap-2">
        <Link
          to="/"
          className={`p-2 rounded-full hover:bg-opacity-10 hover:bg-gray-500 ${isDarkMode ? 'text-white' : 'text-gray-600'}`}
          title={t('home', 'Home')}
        >
          <Home className="w-6 h-6" />
        </Link>
        <button
          onClick={toggleDarkMode}
          className={`p-2 rounded-full hover:bg-opacity-10 hover:bg-gray-500 ${isDarkMode ? 'text-white' : 'text-gray-600'}`}
          title={isDarkMode ? t('switchToLight', 'Switch to Light Mode') : t('switchToDark', 'Switch to Dark Mode')}
        >
          {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4">
        {isRedirecting ? (
          <div className="flex flex-col items-center justify-center">
            <Activity className={`w-12 h-12 ${isDarkMode ? 'text-blue-400' : 'text-blue-500'} animate-spin mb-4`} />
            <h2 className={`text-xl font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              {t('redirecting', 'Redirecting to dashboard...')}
            </h2>
          </div>
        ) : (
          <div className={`${isDarkMode ? 'bg-dark-card border-dark' : 'bg-white'} p-8 rounded-lg shadow-lg w-96 border`}>
            <div className="flex items-center justify-center gap-2 mb-8">
              <Activity className={`w-12 h-12 ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`} />
              <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                {t('transformerMonitor', 'Transformer Monitor')}
              </h1>
            </div>
            
            {error && (
              <div className="bg-red-500 text-white p-3 rounded mb-4">{error}</div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={`block mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {t('usernameOrEmail', 'Username or Email')}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`w-full p-2 rounded border focus:outline-none focus:border-blue-500 ${
                    isDarkMode 
                      ? 'bg-dark-paper border-dark text-gray-100 placeholder-gray-500' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder={t('enterUsernameOrEmail', 'Enter username or email')}
                  required
                />
              </div>
              
              <div>
                <label className={`block mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {t('password', 'Password')}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full p-2 rounded border focus:outline-none focus:border-blue-500 ${
                    isDarkMode 
                      ? 'bg-dark-paper border-dark text-gray-100 placeholder-gray-500' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder={t('enterPassword', 'Enter your password')}
                  required
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="remember-me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className={`h-4 w-4 focus:ring-blue-500 rounded ${
                    isDarkMode ? 'bg-dark-paper border-dark' : 'border-gray-300'
                  }`}
                />
                <label htmlFor="remember-me" className={`ml-2 block text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {t('rememberMe', 'Remember me')}
                </label>
              </div>
              
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full p-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDarkMode 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {isLoading ? t('loggingIn', 'Logging in...') : t('login', 'Log In')}
              </button>
            </form>
            
            <p className={`mt-4 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {t('dontHaveAccount', "Don't have an account?")}{' '}
              <Link to="/signup" className={`${isDarkMode ? 'text-blue-400' : 'text-blue-500'} hover:underline`}>
                {t('signup', 'Sign up')}
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}