import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import api from '../lib/axios';
import { User, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../stores/theme';

interface UserProfile {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: string;
  company?: string;
}

export default function Profile() {
  const { t } = useTranslation();
  const { isDarkMode } = useThemeStore();
  const [profile, setProfile] = useState<UserProfile>({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    dateOfBirth: '',
    company: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const navigate = useNavigate();
  const logout = useAuthStore(state => state.logout);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/api/profile/');
      setProfile(response.data);
    } catch (err) {
      setError('Failed to load profile');
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      await api.put('/api/profile/', profile);
      setSuccess(t('pages.profile.success.profileUpdated'));
      setIsEditing(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || t('pages.profile.errors.updateFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (newPassword !== confirmPassword) {
      setError(t('pages.profile.errors.passwordsDontMatch'));
      setIsLoading(false);
      return;
    }

    try {
      await api.post('/api/change-password/', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSuccess(t('pages.profile.errors.passwordChanged'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.detail || t('pages.profile.errors.passwordChangeFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await api.delete('/api/profile/');
      logout();
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.detail || t( 'pages.profile.errors.deleteFailed'));
    }
  };

  return (
    <div className={`max-w-4xl mx-auto p-6 space-y-8 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
      <div className="flex items-center justify-between">
        <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{t('pages.profile.title')}</h1>
        <div className="flex items-center gap-4">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className={`px-4 py-2 ${isDarkMode ? 'text-gray-300 hover:text-gray-100' : 'text-gray-600 hover:text-gray-800'}`}
              >
                {t('cancel')}

              </button>
              <button
                onClick={handleProfileUpdate}
                disabled={isLoading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg disabled:opacity-50 ${
                  isDarkMode 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                <Save size={20} />
                {isLoading ? t('pages.profile.saving') : t('pages.profile.SaveChanges')}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className={`px-4 py-2 ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
            >
              {t('pages.profile.editProfile')}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className={`p-4 rounded-lg ${
          isDarkMode 
            ? 'bg-red-900 bg-opacity-20 border-red-800 text-red-200' 
            : 'bg-red-50 border-red-200 text-red-700'
        } border`}>
          {error}
        </div>
      )}

      {success && (
        <div className={`p-4 rounded-lg ${
          isDarkMode 
            ? 'bg-green-900 bg-opacity-20 border-green-800 text-green-200' 
            : 'bg-green-50 border-green-200 text-green-700'
        } border`}>
          {success}
        </div>
      )}

      <div className={`p-6 rounded-lg shadow-md border ${
        isDarkMode 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center gap-4 mb-6">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
            isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
          }`}>
            <User size={40} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
          </div>
          <div>
            <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              {profile.firstName || profile.lastName 
                ? `${profile.firstName} ${profile.lastName}` 
                : profile.username}
            </h2>
            <p className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>{profile.email}</p>
          </div>
        </div>

        <form className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('pages.profile.firstName')}
              </label>
              <input
                type="text"
                value={profile.firstName}
                onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                disabled={!isEditing}
                className={`w-full p-2 border rounded-lg ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-200 disabled:bg-gray-800' 
                    : 'bg-white border-gray-300 text-gray-900 disabled:bg-gray-50'
                }`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('pages.profile.lastName')}
              </label>
              <input
                type="text"
                value={profile.lastName}
                onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                disabled={!isEditing}
                className={`w-full p-2 border rounded-lg ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-200 disabled:bg-gray-800' 
                    : 'bg-white border-gray-300 text-gray-900 disabled:bg-gray-50'
                }`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('pages.profile.phone')}
              </label>
              <input
                type="tel"
                value={profile.phone || ''}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                disabled={!isEditing}
                className={`w-full p-2 border rounded-lg ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-200 disabled:bg-gray-800' 
                    : 'bg-white border-gray-300 text-gray-900 disabled:bg-gray-50'
                }`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('pages.profile.company')}
              </label>
              <input
                type="text"
                value={profile.company || ''}
                onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                disabled={!isEditing}
                className={`w-full p-2 border rounded-lg ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-200 disabled:bg-gray-800' 
                    : 'bg-white border-gray-300 text-gray-900 disabled:bg-gray-50'
                }`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('pages.profile.dateOfBirth')}
              </label>
              <input
                type="date"
                value={profile.dateOfBirth || ''}
                onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })}
                disabled={!isEditing}
                className={`w-full p-2 border rounded-lg ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-200 disabled:bg-gray-800' 
                    : 'bg-white border-gray-300 text-gray-900 disabled:bg-gray-50'
                }`}
              />
            </div>
          </div>
        </form>
      </div>

      <div className={`p-6 rounded-lg shadow-md border ${
        isDarkMode 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
          {t('pages.profile.ChangePassword')}
        </h3>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('pages.profile.currentPassword')}
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={`w-full p-2 border rounded-lg ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-200' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              required
            />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('pages.profile.newPassword')}
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={`w-full p-2 border rounded-lg ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-200' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              required
            />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('pages.profile.confirmNewPassword')}
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full p-2 border rounded-lg ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-200' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-2 rounded-lg transition-colors disabled:opacity-50 ${
              isDarkMode 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isLoading ? t('pages.profile.ChangePassword'):t('pages.profile.ChangePassword')}
          </button>
        </form>
      </div>

      {/* Danger Zone */}
      <div className={`p-6 rounded-lg shadow-md border ${
        isDarkMode 
          ? 'bg-gray-800 border-red-800' 
          : 'bg-white border-red-200'
      }`}>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className={`px-4 py-2 rounded-lg ${
            isDarkMode 
              ? 'bg-red-600 hover:bg-red-700 text-white' 
              : 'bg-red-500 hover:bg-red-600 text-white'
          }`}
        >
          {t('pages.profile.deleteAccount')}
        </button>

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className={`p-6 rounded-lg shadow-xl max-w-md w-full ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
             
             
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className={`px-4 py-2 ${isDarkMode ? 'text-gray-300 hover:text-gray-100' : 'text-gray-600 hover:text-gray-800'}`}
                >
                  {/* {t('pages.profile.cancel')} */}
                  {t('cancel')}
                </button>
                <button
                  onClick={handleDeleteAccount}
                  className={`px-4 py-2 rounded-lg ${
                    isDarkMode 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'bg-red-500 hover:bg-red-600 text-white'
                  }`}
                >
                  {t('pages.profile.deleteAccountConfirmation')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}