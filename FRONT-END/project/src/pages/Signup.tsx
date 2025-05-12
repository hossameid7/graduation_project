import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Activity, Home, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import { useTranslation } from 'react-i18next';

export default function Signup() {
  const { t } = useTranslation();
  const { isDarkMode, toggleDarkMode } = useThemeStore();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    dateOfBirth: '',
    company: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const signup = useAuthStore((state) => state.signup);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (formData.password !== formData.confirmPassword) {
      setError(t('pages.signup.passwordsDontMatch'));
      setIsLoading(false);
      return;
    }
    
    try {
      await signup({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName || undefined,
        lastName: formData.lastName || undefined,
        phone: formData.phone || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        company: formData.company || undefined,
      });
      navigate('/login');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className={`min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="fixed top-4 left-4 flex items-center gap-2">
        <Link
          to="/"
          className={`p-2 rounded-full hover:bg-opacity-10 hover:bg-gray-500 ${isDarkMode ? 'text-white' : 'text-gray-600'}`}
          title="Go to Home"
        >
          <Home className="w-6 h-6" />
        </Link>
        <button
          onClick={toggleDarkMode}
          className={`p-2 rounded-full hover:bg-opacity-10 hover:bg-gray-500 ${isDarkMode ? 'text-white' : 'text-gray-600'}`}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
        </button>
      </div>

      <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-8 rounded-lg shadow-lg max-w-md w-full border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-center gap-2 mb-8">
          <Activity className="w-12 h-12 text-blue-600" />
          <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{t('pages.signup.title')}</h1>
        </div>
        
        {error && (
          <div className={`mb-4 p-3 rounded ${isDarkMode ? 'bg-red-900 bg-opacity-20 text-red-200' : 'bg-red-500 text-white'}`}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('pages.signup.firstName')} *
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className={`w-full p-2 rounded border focus:outline-none focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 text-white border-gray-500' : 'bg-white border-gray-300 text-gray-900'}`}
                required
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('pages.signup.lastName')} *
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className={`w-full p-2 rounded border focus:outline-none focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 text-white border-gray-500' : 'bg-white border-gray-300 text-gray-900'}`}
                required
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('pages.signup.username')} *
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className={`w-full p-2 rounded border focus:outline-none focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 text-white border-gray-500' : 'bg-white border-gray-300 text-gray-900'}`}
              required
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('pages.signup.email')} *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full p-2 rounded border focus:outline-none focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 text-white border-gray-500' : 'bg-white border-gray-300 text-gray-900'}`}
              required
            />
          </div>
          
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('pages.signup.phone')} *
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={`w-full p-2 rounded border focus:outline-none focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 text-white border-gray-500' : 'bg-white border-gray-300 text-gray-900'}`}
              required
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('pages.signup.dateOfBirthOptional')}
            </label>
            <input
              type="date"
              name="dateOfBirth"
              value={formData.dateOfBirth}
              onChange={handleChange}
              className={`w-full p-2 rounded border focus:outline-none focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 text-white border-gray-500' : 'bg-white border-gray-300 text-gray-900'}`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('pages.signup.company')} *
            </label>
            <input
              type="text"
              name="company"
              value={formData.company}
              onChange={handleChange}
              className={`w-full p-2 rounded border focus:outline-none focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 text-white border-gray-500' : 'bg-white border-gray-300 text-gray-900'}`}
              required
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('pages.signup.password')} *
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={`w-full p-2 rounded border focus:outline-none focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 text-white border-gray-500' : 'bg-white border-gray-300 text-gray-900'}`}
              required
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('pages.signup.confirmPassword')} *
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={`w-full p-2 rounded border focus:outline-none focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 text-white border-gray-500' : 'bg-white border-gray-300 text-gray-900'}`}
              required
            />
          </div>
          
          <button
            type="submit"
            className={`w-full p-2 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
              isDarkMode 
                ? 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-offset-gray-800' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
            disabled={isLoading}
          >
            {isLoading ? t('pages.signup.creatingAccount') : t('pages.signup.signUp')}
          </button>
        </form>
        
        <p className={`mt-4 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {t('pages.signup.alreadyHaveAccount')}{' '}
          <Link to="/login" className="text-blue-600 hover:underline">
            {t('pages.signup.login')}
          </Link>
        </p>
      </div>
    </div>
  );
}