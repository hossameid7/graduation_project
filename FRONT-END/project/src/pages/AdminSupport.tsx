import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import AdminChat from '../components/AdminChat';
import { useTranslation } from 'react-i18next';

const AdminSupport = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const { t } = useTranslation();

  // Protect this route - only staff/admin can access
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    if (!user?.is_staff) {
      navigate('/dashboard');
    }
  }, [user, isAuthenticated, navigate]);

  return (
    <div className={`container mx-auto px-4 py-6 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
      <h1 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}> {t('support.supportMessages')}</h1>
      <AdminChat />
    </div>
  );
};

export default AdminSupport;