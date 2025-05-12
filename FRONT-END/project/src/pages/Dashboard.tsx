import { useState, useMemo, useEffect, useCallback, useRef, Suspense, Component } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Plot from 'react-plotly.js';
import { format } from 'date-fns';
import { useAuthStore } from '../stores/auth';
import api from '../lib/axios';
import { useTranslation } from 'react-i18next';
import { formatRUL } from '../utils/durationFormatter';
import { Activity, Bell } from 'lucide-react';
import { useThemeStore } from '../stores/theme';

interface Measurement {
  id: number;
  timestamp: string;
  co: number;
  h2: number;
  c2h2: number;
  c2h4: number;
  fdd: number;
  rul: number;
  temperature: number;
  transformer: number;
}

interface Notification {
  id: number;
  message: number;
  session: number;
  created_at: string;
  is_read: boolean;
  sender_name: string;
  message_content: string;
  session_title: string;
  notification_type?: string; // Optional field to distinguish notification types
}

// Helper function to group measurements by interval
const groupMeasurementsByInterval = (measurements: Measurement[]) => {
  const grouped = new Map<string, Measurement>();
  
  measurements.forEach(measurement => {
    const date = new Date(measurement.timestamp);
    const key = date.toISOString();
    
    if (!grouped.has(key)) {
      grouped.set(key, {
        ...measurement,
        timestamp: key,
      });
    } else {
      const existing = grouped.get(key)!;
      grouped.set(key, {
        ...existing,
        co: (existing.co + measurement.co) / 2,
        h2: (existing.h2 + measurement.h2) / 2,
        c2h2: (existing.c2h2 + measurement.c2h2) / 2,
        c2h4: (existing.c2h4 + measurement.c2h4) / 2,
        fdd: (existing.fdd + measurement.fdd) / 2,
        rul: (existing.rul + measurement.rul) / 2,
        temperature: measurement.temperature 
          ? existing.temperature 
            ? (existing.temperature + measurement.temperature) / 2 
            : measurement.temperature
          : existing.temperature,
      });
    }
  });
  
  return Array.from(grouped.values()).sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
};

// Helper function to group measurements by custom time interval
const groupMeasurementsByCustomInterval = (measurements: Measurement[], intervalHours: number) => {
  if (intervalHours <= 1) return groupMeasurementsByInterval(measurements);
  
  const grouped = new Map<string, Measurement>();
  
  measurements.forEach(measurement => {
    const date = new Date(measurement.timestamp);
    // Round to the nearest interval
    const hours = date.getHours();
    const roundedHours = Math.floor(hours / intervalHours) * intervalHours;
    
    // Create a new date with rounded hours
    const roundedDate = new Date(date);
    roundedDate.setHours(roundedHours, 0, 0, 0);
    
    const key = roundedDate.toISOString();
    
    if (!grouped.has(key)) {
      grouped.set(key, {
        ...measurement,
        timestamp: key,
      });
    } else {
      const existing = grouped.get(key)!;
      grouped.set(key, {
        ...existing,
        co: (existing.co + measurement.co) / 2,
        h2: (existing.h2 + measurement.h2) / 2,
        c2h2: (existing.c2h2 + measurement.c2h2) / 2,
        c2h4: (existing.c2h4 + measurement.c2h4) / 2,
        fdd: (existing.fdd + measurement.fdd) / 2,
        rul: (existing.rul + measurement.rul) / 2,
        temperature: measurement.temperature 
          ? existing.temperature 
            ? (existing.temperature + measurement.temperature) / 2 
            : measurement.temperature
          : existing.temperature,
      });
    }
  });
  
  return Array.from(grouped.values()).sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
};

const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return format(date, 'yyyy-MM-dd HH:mm:ss');
  } catch (error) {
    return 'Invalid Date';
  }
};

const getFDDStatusInfo = (fdd: number, t: any = null) => {
  switch (fdd) {
    case 1:
      return { 
        label: t ? t('NormalMode') : 'Normal mode', 
        description: t ? t('normalModeDesc') : 'Normal operating conditions',
        color: 'text-green-600', 
        bg: 'bg-green-50', 
        border: 'border-green-200' 
      };
    case 2:
      return { 
        label: t ? t('partialDischarge') : 'Partial discharge', 
        description: t ? t('partialDischargeDesc') : 'Local dielectric breakdown in gas-filled cavities',
        color: 'text-yellow-600', 
        bg: 'bg-yellow-50', 
        border: 'border-yellow-200' 
      };
    case 3:
      return { 
        label: t ? t('lowEnergyDischarge') : 'Low energy discharge', 
        description: t ? t('lowEnergyDischargeDesc') : 'Sparking or arc discharges in poor contact connections',
        color: 'text-orange-600', 
        bg: 'bg-orange-50', 
        border: 'border-orange-200' 
      };
    case 4:
      return { 
        label: t ? t('lowTempOverheating') : 'Low-temperature overheating', 
        description: t ? t('lowTempOverheatingDesc') : 'Oil flow disruption in cooling channels',
        color: 'text-red-600', 
        bg: 'bg-red-50', 
        border: 'border-red-200' 
      };
    default:
      return { 
        label: t ? t('status.unknown.label') : 'Unknown', 
        description: t ? t('status.unknown.description') : 'Status information not available',
        color: 'text-gray-600', 
        bg: 'bg-gray-50', 
        border: 'border-gray-200' 
      };
  }
};

// Add utility function for calculating end of life date
const calculateEndOfLifeDate = (startDate: string, rulDays: number): Date => {
  const date = new Date(startDate);
  date.setDate(date.getDate() + rulDays);
  return date;
};

// Convert UTC timestamp to local time
const convertToLocalTime = (utcDateString: string) => {
  const date = new Date(utcDateString);
  // Format as a readable local date-time string without timezone information
  return format(date, 'yyyy-MM-dd HH:mm:ss');
};

export default function Dashboard() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const [selectedTransformer, setSelectedTransformer] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isNewTransformerModalOpen, setIsNewTransformerModalOpen] = useState(false);
  const [newTransformerName, setNewTransformerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [language, setLanguage] = useState('en');
  const { t, i18n } = useTranslation();
  const { isDarkMode } = useThemeStore();
  
  // Define time resolution options with translations
  const timeResolutionLabels = useMemo(() => ({
    1: t('all'),
    6: t('every6Hours', 'Every 6 hours'),
    12: t('every12Hours', 'Every 12 hours'),
    24: t('daily'),
    168: t('weekly')
  }), [t]);
  
  // New state variables for date filtering and time resolution
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [timeResolution, setTimeResolution] = useState<number>(1);
  const [showRUL, setShowRUL] = useState(false); // Add state for RUL line visibility

  // Add pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(10);

  // Notification center state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  
  // Fetch notifications for all users (admin and regular)
  const fetchNotifications = useCallback(async () => {
    try {
      // Get notification count - works for both admin and regular users
      const countResponse = await api.get('/api/unread-notifications-count/');
      setUnreadCount(countResponse.data.unread_count);
      
      // Get notifications - works for both admin and regular users
      const notificationsResponse = await api.get('/api/admin-notifications/');
      setNotifications(notificationsResponse.data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [user]);
  
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      
      // Set up polling for new notifications - increase the interval to avoid rate limits
      const interval = setInterval(fetchNotifications, 60000); // Poll every 60 seconds instead of 30
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, user, fetchNotifications]);
  
  // Close notifications panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await api.post(`/api/admin-notifications/${notificationId}/mark_as_read/`);
      
      // Update local state
      setNotifications(prevNotifications => 
        prevNotifications.map(notification => 
          notification.id === notificationId 
            ? { ...notification, is_read: true } 
            : notification
        )
      );
      
      // Update unread count
      setUnreadCount(prevCount => Math.max(0, prevCount - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };
  
  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/api/admin-notifications/mark_all_as_read/');
      
      // Update local state
      setNotifications(prevNotifications => 
        prevNotifications.map(notification => ({ ...notification, is_read: true }))
      );
      
      // Update unread count
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };
  
  // Update handleViewConversation to handle both admin and user redirects
  const handleViewConversation = (sessionId: number) => {
    if (user?.is_staff) {
      navigate(`/admin-support?session=${sessionId}`);
    } else {
      navigate(`/support?session=${sessionId}`);
    }
    setIsNotificationOpen(false);
  };
  
  const handleCancelTransformerModal = useCallback(() => {
    // If user has entered a name and not submitting, ask for confirmation
    if (newTransformerName.trim() && !isSubmitting) {
      const confirmed = window.confirm(t('pages.dashboard.confirmCancel', 'Discard changes?'));
      if (!confirmed) return;
    }
    
    // Close modal and reset values
    setIsNewTransformerModalOpen(false);
    setNewTransformerName('');
    setErrorMessage(null);
  }, [newTransformerName, isSubmitting, t]);
  
  useEffect(() => {
    // Check authentication status and redirect if not authenticated
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Add escape key handler for the modal
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isNewTransformerModalOpen) {
        handleCancelTransformerModal();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isNewTransformerModalOpen, handleCancelTransformerModal]);

  const { data: measurements, isLoading, error, refetch } = useQuery<Measurement[]>({
    queryKey: ['measurements'],
    queryFn: async () => {
      try {
        const response = await api.get('/api/measurements/');
        return response.data;
      } catch (err: any) {
        if (err.response?.status === 401) {
          navigate('/login');
        }
        throw err;
      }
    },
    retry: 1,
  });

  const { data: transformers, refetch: refetchTransformers } = useQuery({
    queryKey: ['transformers'],
    queryFn: async () => {
      const response = await api.get('/api/transformers/');
      return response.data;
    },
  });

  const handleCreateTransformer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    
    const normalizedName = newTransformerName.trim().toLowerCase();
    
    // Check if transformer already exists
    if (transformers?.some((t: { name: string }) => t.name.toLowerCase() === normalizedName)) {
      setErrorMessage('A transformer with this name already exists');
      setIsSubmitting(false);
      return;
    }
    
    try {
      await api.post('/api/transformers/', {
        name: normalizedName
      });
      setIsNewTransformerModalOpen(false);
      setNewTransformerName('');
      setSuccessMessage('Transformer created successfully');
      await refetchTransformers();
    } catch (err: any) {
      if (err.response?.data?.name?.[0]?.includes('already exists')) {
        setErrorMessage('A transformer with this name already exists');
      } else {
        setErrorMessage(err.response?.data?.error || err.response?.data?.detail || 'Failed to create transformer');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const uniqueTransformers = useMemo(() => {
    if (!measurements) return [];
    return [...new Set(measurements.map(m => m.transformer))].sort((a, b) => a - b);
  }, [measurements]);

  const processedMeasurements = useMemo(() => {
    if (!measurements) return [];
    
    // Step 1: Filter by transformer if needed
    let filtered = selectedTransformer === null 
      ? measurements 
      : measurements.filter(m => m.transformer === selectedTransformer);
    
    // Step 2: Filter by date range if provided
    if (startDate) {
      const startDateTime = new Date(startDate).getTime();
      filtered = filtered.filter(m => new Date(m.timestamp).getTime() >= startDateTime);
    }
    
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999); // Set to end of day
      filtered = filtered.filter(m => new Date(m.timestamp).getTime() <= endDateTime.getTime());
    }
    
    // Step 3: Group by selected time resolution
    const groupedData = groupMeasurementsByCustomInterval(filtered, timeResolution);
    
    // Step 4: Sort by timestamp ascending (oldest first, newest last)
    return groupedData.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [measurements, selectedTransformer, startDate, endDate, timeResolution]);

  const getLatestMeasurements = useMemo(() => {
    if (!measurements) return [];
    const latestByTransformer = new Map();
    
    measurements.forEach(measurement => {
      const current = latestByTransformer.get(measurement.transformer);
      if (!current || new Date(measurement.timestamp) > new Date(current.timestamp)) {
        latestByTransformer.set(measurement.transformer, measurement);
      }
    });
    
    return Array.from(latestByTransformer.values());
  }, [measurements]);

  // Initialize date range with default values (last 30 days)
  useEffect(() => {
    if (measurements?.length) {
      // Find the latest date in measurements
      const dates = measurements.map(m => new Date(m.timestamp).getTime());
      const latestDate = new Date(Math.max(...dates));
      const thirtyDaysAgo = new Date(latestDate);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Format dates in local timezone instead of UTC
      const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      setEndDate(formatLocalDate(latestDate));
      setStartDate(formatLocalDate(thirtyDaysAgo));
    }
  }, [measurements]);

  useEffect(() => {
    if (error) {
      console.error('Query error:', error);
    }
  }, [error]);

  // Add this new useMemo hook before the return statement
  const sortedTableMeasurements = useMemo(() => {
    return [...processedMeasurements].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [processedMeasurements]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center">
          <Activity className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <div className="text-xl text-gray-600">{t('loading', 'Loading...')}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <div className="text-xl text-red-400 mb-4">Error loading data</div>
        {errorMessage && <div className="text-md text-gray-300 mb-4">{errorMessage}</div>}
        <div className="flex flex-col items-center space-y-4">
          {/* Retry Button */}
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-48 justify-center"
            onClick={() => refetch()}
          >
            Retry
          </button>
          <button
            onClick={() => {
              useAuthStore.getState().logout();
              navigate('/login');
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 text-red-600 hover:text-red-900 w-48"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
          
          {/* Support Button */}
          <button
            onClick={() => navigate('/support')}
            className="flex items-center justify-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 w-48"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Support
          </button>

          {/* Language Selector */}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className={`px-4 py-2 ${isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-50 text-gray-800'} rounded-md border ${isDarkMode ? 'border-gray-600' : 'border-gray-300'} focus:outline-none focus:ring-2 focus:ring-blue-500 w-48`}
          >
            <option value="en">English</option>
            <option value="ar">العربية</option>
            <option value="ru">Русский</option>
          </select>
        </div>
      </div>
    );
  }

  const uniqueTransformerCount = uniqueTransformers.length;

  // Add a renderNotificationCenter function
  const renderNotificationCenter = () => {
    if (!isNotificationOpen) return null;
    
    return (
      <div 
        ref={notificationRef}
        className="absolute right-0 top-12 w-80 bg-white border border-gray-200 shadow-lg rounded-lg z-50"
      >
        <div className="p-3 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-semibold text-gray-700">Notifications</h3>
          {unreadCount > 0 && (
            <button 
              onClick={handleMarkAllAsRead}
              className="text-sm text-blue-500 hover:text-blue-700"
            >
              Mark all as read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No notifications
            </div>
          ) : (
            <ul>
              {notifications.map(notification => (
                <li 
                  key={notification.id} 
                  className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${!notification.is_read ? 'bg-blue-50' : ''}`}
                  onClick={() => {
                    if (!notification.is_read) {
                      handleMarkAsRead(notification.id);
                    }
                    handleViewConversation(notification.session);
                  }}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-sm">
                      {notification.sender_name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(notification.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                    {notification.message_content}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t('welcome', 'Welcome')}, {user?.firstName+" "+user?.lastName || 'User'}</h1>
        
        {/* Notification icon for all users */}
        <div className="relative">
          <button 
            className="p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
          >
            <Bell className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 inline-block w-5 h-5 text-xs text-white bg-red-500 rounded-full flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {renderNotificationCenter()}
        </div>
      </div>

      <div className="space-y-6 p-6 bg-gray-50 dark:bg-gray-800">
        {successMessage && (
          <div className="fixed top-4 right-4 bg-green-50 text-green-700 p-4 rounded-lg shadow-lg border border-green-200 z-50 dark:bg-green-900 dark:text-green-200 dark:border-green-700">
            {successMessage}
          </div>
        )}
        
        {errorMessage && (
          <div className="fixed top-4 right-4 bg-red-50 text-red-700 p-4 rounded-lg shadow-lg border border-red-200 z-50 dark:bg-red-900 dark:text-red-200 dark:border-red-700">
            {errorMessage}
          </div>
        )}

        {isNewTransformerModalOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 dark:bg-opacity-80"
            onClick={handleCancelTransformerModal}
          >
            <div 
              className="bg-white rounded-lg p-6 w-96 shadow-xl dark:bg-gray-900"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">{t('addNewTransformer')}</h2>
              {errorMessage && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md border border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700">
                  {errorMessage}
                </div>
              )}
              <form onSubmit={handleCreateTransformer}>
                <div className="mb-4">
                  <label htmlFor="transformerName" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                    {t('pages.dashboard.form.transformerName')}
                  </label>
                  <input
                    type="text"
                    id="transformerName"
                    value={newTransformerName}
                    onChange={(e) => setNewTransformerName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
                    required
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={handleCancelTransformerModal}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
                  >
                    {isSubmitting ? t('pages.dashboard.creating') : t('pages.dashboard.createTransformer')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">{t('pages.dashboard.title', 'Dashboard')}</h1>
          <button
            onClick={() => setIsNewTransformerModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            <span className="mr-2">+</span> {t('addNewTransformer')}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 dark:bg-gray-900 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-700 mb-2 dark:text-gray-300">{t('totalTransformers')}</h3>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {uniqueTransformerCount || 0}
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 dark:bg-gray-900 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-700 mb-2 dark:text-gray-300">{t('latestFDDStatus')}</h3>
            {getLatestMeasurements.length > 0 && getLatestMeasurements[0] && (
              <>
                <p className="text-3xl font-bold text-green-600 mb-2 dark:text-green-400">
                  {getLatestMeasurements[0].fdd}
                </p>
                {(() => {
                  const status = getFDDStatusInfo(getLatestMeasurements[0].fdd, t);
                  const statusElement = (
                    <div className={`${status.bg} ${status.border} border rounded-md p-2 gray:bg-opacity-50 dark:border-opacity-50`}>
                      <p className={`${status.color} font-medium dark:text-opacity-80`}>{status.label}</p>
                      {status.description && (
                        <p className={`${status.color} text-sm mt-1 dark:text-opacity-80`}>{status.description}</p>
                      )}
                    </div>
                  );
                  return statusElement;
                })()}
              </>
            )}
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 dark:bg-gray-900 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-700 mb-2 dark:text-gray-300">{t('latestRUL')}</h3>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {getLatestMeasurements.length && getLatestMeasurements[0]
                ? formatRUL(getLatestMeasurements[0].rul, { i18n, useGrammarRules: true })
                : 'N/A'}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 dark:bg-gray-900 dark:border-gray-700">
          <div className="flex flex-col mb-6">
            <h2 className="text-2xl font-bold text-gray-800 border-b pb-3 mb-4 dark:text-gray-200 dark:border-gray-700">{t('gasConcentrations')}</h2>
            
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 flex-wrap bg-gray-50 p-3 rounded-md dark:bg-gray-800">
              {/* Time resolution control */}
              <div className="flex items-center gap-3">
                <label htmlFor="time-resolution" className="text-gray-600 text-sm font-medium whitespace-nowrap dark:text-gray-300">{t('timeResolution')}:</label>
                <select
                  id="time-resolution"
                  className="bg-white text-gray-800 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
                  value={timeResolution}
                  onChange={(e) => setTimeResolution(Number(e.target.value))}
                >
                  <option value={1}>{timeResolutionLabels[1]}</option>
                  <option value={6}>{timeResolutionLabels[6]}</option>
                  <option value={12}>{timeResolutionLabels[12]}</option>
                  <option value={24}>{timeResolutionLabels[24]}</option>
                  <option value={168}>{timeResolutionLabels[168]}</option>
                </select>
              </div>

              {/* Date range controls */}
              <div className="flex items-center gap-3">
                <label htmlFor="start-date" className="text-gray-600 text-sm font-medium whitespace-nowrap dark:text-gray-300">{t('from')}:</label>
                <input
                  type="date"
                  id="start-date"
                  className="bg-white text-gray-800 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <label htmlFor="end-date" className="text-gray-600 text-sm font-medium whitespace-nowrap dark:text-gray-300">{t('to')}:</label>
                <input
                  type="date"
                  id="end-date"
                  className="bg-white text-gray-800 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              {/* Transformer filter */}
              <div className="flex items-center gap-3">
                <label htmlFor="chart-transformer" className="text-gray-600 text-sm font-medium whitespace-nowrap dark:text-gray-300">{t('filterByTransformer')}:</label>
                <select
                  id="chart-transformer"
                  className="bg-white text-gray-800 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
                  value={selectedTransformer === null ? '' : selectedTransformer}
                  onChange={(e) => setSelectedTransformer(e.target.value ? Number(e.target.value) : null)}
                >
                  <option key="all" value="">{t('allTransformers')}</option>
                  {transformers?.map((transformer: { id: number; name: string }) => (
                    <option key={`chart-transformer-${transformer.id}`} value={transformer.id}>
                      {transformer.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Add RUL toggle control */}
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRUL}
                    onChange={(e) => setShowRUL(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 dark:bg-gray-700 dark:peer-checked:bg-blue-500"></div>
                  <span className="ms-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('showRUL', 'Show RUL')}</span>
                </label>
              </div>
            </div>
          </div>
          <div className="h-[600px] w-full">
            <ChartErrorBoundary>
              <Suspense fallback={
                <div className="flex items-center justify-center h-[600px]">
                  <Activity className="w-12 h-12 text-blue-500 animate-spin" />
                </div>
              }>
                <Plot
                  data={[
                    // Gas concentration traces
                    {
                      x: processedMeasurements.map(m => m.timestamp),
                      y: processedMeasurements.map(m => m.h2),
                      customdata: processedMeasurements.map(m => {
                        const date = new Date(m.timestamp);
                        return format(date, 'yyyy-MM-dd HH:mm:ss');
                      }),
                      type: 'scatter' as const,
                      mode: 'lines+markers' as const,
                      name: 'H2',
                      line: {
                        shape: 'spline',
                        smoothing: 1.3,
                        width: 2
                      },
                      marker: { 
                        color: '#82ca9d',
                        size: 6 
                      },
                      hovertemplate: 
                        
                        '<b>H2</b>: %{y:.5f} ppm<br>' +
                        '<extra></extra>'
                    },
                    {
                      x: processedMeasurements.map(m => m.timestamp),
                      y: processedMeasurements.map(m => m.co),
                      customdata: processedMeasurements.map(m => {
                        const date = new Date(m.timestamp);
                        return format(date, 'yyyy-MM-dd HH:mm:ss');
                      }),
                      type: 'scatter' as const,
                      mode: 'lines+markers' as const,
                      name: 'CO',
                      line: {
                        shape: 'spline',
                        smoothing: 1.3,
                        width: 2
                      },
                      marker: { 
                        color: '#8884d8',
                        size: 6
                      },
                      hovertemplate: 
                        // '<b>Time</b>: %{customdata}<br>' +
                        '<b>CO</b>:  %{y:.5f} ppm<br>' +
                        '<extra></extra>'
                    },
                    {
                      x: processedMeasurements.map(m => m.timestamp),
                      y: processedMeasurements.map(m => m.c2h4),
                      customdata: processedMeasurements.map(m => {
                        const date = new Date(m.timestamp);
                        return format(date, 'yyyy-MM-dd HH:mm:ss');
                      }),
                      type: 'scatter' as const,
                      mode: 'lines+markers' as const,
                      name: 'C2H4',
                      line: {
                        shape: 'spline',
                        smoothing: 1.3,
                        width: 2
                      },
                      marker: { 
                        color: '#ff7300',
                        size: 6
                      },
                      hovertemplate: 
                        // '<b>Time</b>: %{customdata}<br>' +
                        '<b>C2H4</b>:  %{y:.5f} ppm<br>' +
                        '<extra></extra>'
                    },
                    {
                      x: processedMeasurements.map(m => m.timestamp),
                      y: processedMeasurements.map(m => m.c2h2),
                      customdata: processedMeasurements.map(m => {
                        const date = new Date(m.timestamp);
                        return format(date, 'yyyy-MM-dd HH:mm:ss');
                      }),
                      type: 'scatter' as const,
                      mode: 'lines+markers' as const,
                      name: 'C2H2',
                      line: {
                        shape: 'spline',
                        smoothing: 1.3,
                        width: 2
                      },
                      marker: { 
                        color: '#ffc658',
                        size: 6
                      },
                      hovertemplate: 
                        // '<b>Time</b>: %{customdata}<br>' +
                        '<b>C2H2</b>:  %{y:.5f} ppm<br>' +
                        '<extra></extra>'
                    },
                    // RUL vertical line
                    ...(showRUL && getLatestMeasurements.length > 0 ? [{
                      x: (() => {
                        const defectDate = new Date(getLatestMeasurements[0].timestamp);
                        defectDate.setHours(defectDate.getHours() + (getLatestMeasurements[0].rul * 12));
                        // Return the same date for both points to create a vertical line
                        return [defectDate.toISOString(), defectDate.toISOString()];
                      })(),
                      y: [0, Math.max(...processedMeasurements.map(m => 
                        Math.max(m.h2, m.co, m.c2h2, m.c2h4)
                      )) * 1.1], // Add 10% padding to the max value
                      customdata: (() => {
                        const defectDate = new Date(getLatestMeasurements[0].timestamp);
                        defectDate.setHours(defectDate.getHours() + (getLatestMeasurements[0].rul * 12));
                        const formattedDate = format(defectDate, 'yyyy-MM-dd HH:mm:ss');
                        return [formattedDate, formattedDate];
                      })(),
                      type: 'scatter' as const,
                      mode: 'lines' as const,
                      name: 'Predicted Defect Date',
                      line: {
                        dash: 'dash' as const,
                        color: 'red',
                        width: 2
                      },
                      hovertemplate: 
                        // '<b>Time</b>: %{customdata}<br>' +
                        '<b>RUL</b>: ' + (getLatestMeasurements[0].rul/2).toFixed(0) + ' days<br>' +
                        '<extra></extra>'
                    }] : [])
                  ]}
                  layout={{
                    autosize: true,
                    margin: { t: 10, r: 30, l: 60, b: 80 }, // Increased bottom margin
                    xaxis: {
                      title: t('datetime'),
                      type: 'date',
                      tickformat: '%Y-%m-%d %H:%M:%S',
                      tickangle: -45,
                      tickfont: {
                        size: 10,
                        color: isDarkMode ? '#fff' : '#000'
                      },
                      gridcolor: isDarkMode ? '#444' : '#e0e0e0',
                      showgrid: true,
                      // Smart tick selection to prevent overlap
                      tickmode: 'array',
                      tickvals: (() => {
                        // Only take a subset of timestamps if there are too many
                        if (processedMeasurements.length <= 8) {
                          // For small datasets, show all points
                          return processedMeasurements.map(m => m.timestamp);
                        } else {
                          // For larger datasets, intelligently select points
                          const maxTicks = 8; // Maximum number of ticks to show
                          const step = Math.ceil(processedMeasurements.length / maxTicks);
                          
                          // Always include first and last point, then evenly space the rest
                          const selectedIndices = [];
                          for (let i = 0; i < processedMeasurements.length; i += step) {
                            selectedIndices.push(i);
                          }
                          
                          // Make sure to include the last point if it's not already included
                          if (selectedIndices[selectedIndices.length - 1] !== processedMeasurements.length - 1) {
                            selectedIndices.push(processedMeasurements.length - 1);
                          }
                          
                          return selectedIndices.map(i => processedMeasurements[i].timestamp);
                        }
                      })(),
                      ticktext: (() => {
                        if (processedMeasurements.length <= 8) {
                          // For small datasets, show all points
                          return processedMeasurements.map(m => convertToLocalTime(m.timestamp));
                        } else {
                          // For larger datasets, match the selected tickvals
                          const maxTicks = 8; 
                          const step = Math.ceil(processedMeasurements.length / maxTicks);
                          
                          const selectedIndices = [];
                          for (let i = 0; i < processedMeasurements.length; i += step) {
                            selectedIndices.push(i);
                          }
                          
                          if (selectedIndices[selectedIndices.length - 1] !== processedMeasurements.length - 1) {
                            selectedIndices.push(processedMeasurements.length - 1);
                          }
                          
                          return selectedIndices.map(i => convertToLocalTime(processedMeasurements[i].timestamp));
                        }
                      })()
                    },
                    yaxis: {
                      title: 'ppm',
                      gridcolor: isDarkMode ? '#444' : '#e0e0e0',
                      showgrid: true,
                      autorange: true
                    },
                    shapes: processedMeasurements.reduce((acc: any[], measurement, index) => {
                      if (index === 0) return acc;
                      const prevMeasurement = processedMeasurements[index - 1];
                      
                      // Get FDD status color with lower opacity for background
                      const getFDDColor = (fdd: number) => {
                        switch (fdd) {
                          case 1: return 'rgba(22, 163, 74, 0.1)';  // green with lower opacity
                          case 2: return 'rgba(234, 179, 8, 0.1)';  // yellow with lower opacity
                          case 3: return 'rgba(249, 115, 22, 0.1)'; // orange with lower opacity
                          case 4: return 'rgba(239, 68, 68, 0.1)';  // red with lower opacity
                          default: return 'rgba(229, 231, 235, 0.1)'; // gray with lower opacity
                        }
                      };

                      // Add shape for the region between current and previous measurement
                      acc.push({
                        type: 'rect',
                        x0: prevMeasurement.timestamp,
                        x1: measurement.timestamp,
                        y0: 0,
                        y1: 1,
                        yref: 'paper',
                        fillcolor: getFDDColor(measurement.fdd),
                        line: { width: 0 },
                        layer: 'below'
                      });

                      // If this is the last measurement, extend the color to the end of the plot
                      if (index === processedMeasurements.length - 1) {
                        // Calculate the average time difference between measurements
                        const avgTimeDiff = processedMeasurements.reduce((sum, curr, i) => {
                          if (i === 0) return 0;
                          const prev = processedMeasurements[i - 1];
                          return sum + (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime());
                        }, 0) / (processedMeasurements.length - 1);

                        // Extend the last FDD color by one more time interval
                        const lastDate = new Date(measurement.timestamp);
                        lastDate.setTime(lastDate.getTime() + avgTimeDiff);

                        acc.push({
                          type: 'rect',
                          x0: measurement.timestamp,
                          x1: lastDate.toISOString(),
                          y0: 0,
                          y1: 1,
                          yref: 'paper',
                          fillcolor: getFDDColor(measurement.fdd),
                          line: { width: 0 },
                          layer: 'below'
                        });
                      }

                      return acc;
                    }, []),
                    hovermode: 'x unified',
                    hoverlabel: {
                      bgcolor: isDarkMode ? '#333' : '#fff',
                      bordercolor: isDarkMode ? '#555' : '#ccc',
                      font: { size: 13, color: isDarkMode ? '#fff' : '#000' }
                    },
                    showlegend: true,
                    legend: {
                      x: 0,
                      y: 1,
                      orientation: 'h',
                      bgcolor: isDarkMode ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)',
                      bordercolor: isDarkMode ? '#444' : '#e0e0e0',
                      borderwidth: 1
                    },
                    dragmode: 'zoom',
                    plot_bgcolor: isDarkMode ? '#222' : '#fff',
                    paper_bgcolor: isDarkMode ? '#222' : '#fff'
                  }}
                  config={{
                    responsive: true,
                    displaylogo: false,
                    modeBarButtonsToAdd: ['zoomIn2d', 'zoomOut2d', 'resetScale2d'],
                    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
                    toImageButtonOptions: {
                      format: 'png',
                      filename: 'gas_concentrations',
                      height: 800,
                      width: 1200,
                      scale: 2
                    }
                  }}
                  style={{ width: '100%', height: '100%' }}
                  useResizeHandler={true}
                />
              </Suspense>
            </ChartErrorBoundary>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 dark:bg-gray-900 dark:border-gray-700">
          <div className="flex flex-col mb-6">
            <h2 className="text-2xl font-bold text-gray-800 border-b pb-3 mb-4 dark:text-gray-200 dark:border-gray-700">{t('recentMeasurements')}</h2>
            
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 flex-wrap bg-gray-50 p-3 rounded-md dark:bg-gray-800">
              {/* Date range controls */}
              <div className="flex items-center gap-3">
                <label htmlFor="table-start-date" className="text-gray-600 text-sm font-medium whitespace-nowrap dark:text-gray-300">{t('from')}:</label>
                <input
                  type="date"
                  id="table-start-date"
                  className="bg-white text-gray-800 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <label htmlFor="table-end-date" className="text-gray-600 text-sm font-medium whitespace-nowrap dark:text-gray-300">{t('to')}:</label>
                <input
                  type="date"
                  id="table-end-date"
                  className="bg-white text-gray-800 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              {/* Transformer filter */}
              <div className="flex items-center gap-3">
                <label htmlFor="table-transformer" className="text-gray-600 text-sm font-medium whitespace-nowrap dark:text-gray-300">{t('filterByTransformer')}:</label>
                <select
                  id="table-transformer"
                  className="bg-white text-gray-800 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
                  value={selectedTransformer === null ? '' : selectedTransformer}
                  onChange={(e) => setSelectedTransformer(e.target.value ? Number(e.target.value) : null)}
                >
                  <option key="all-table" value="">{t('allTransformers')}</option>
                  {transformers?.map((transformer: { id: number; name: string }) => (
                    <option key={`table-transformer-${transformer.id}`} value={transformer.id}>
                      {transformer.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left table-fixed">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                  <th className="p-2 text-gray-700 dark:text-gray-300 w-[12%] text-sm">{t('transformerID')}</th>
                  <th className="p-2 text-gray-700 dark:text-gray-300 w-[18%] text-sm">{t('timestamp')}</th>
                  <th className="p-2 text-gray-700 dark:text-gray-300 w-[8%] text-sm">{t('H₂')}</th>
                  <th className="p-2 text-gray-700 dark:text-gray-300 w-[8%] text-sm">{t('CO')}</th>
                  <th className="p-2 text-gray-700 dark:text-gray-300 w-[8%] text-sm">{t('C₂H₄')}</th>
                  <th className="p-2 text-gray-700 dark:text-gray-300 w-[8%] text-sm">{t('C₂H₂')}</th>
                  <th className="p-2 text-gray-700 dark:text-gray-300 w-[14%] text-sm">{t('pages.dashboard.table.headers.fdd')}</th>
                  <th className="p-2 text-gray-700 dark:text-gray-300 w-[16%] text-sm">{t('pages.dashboard.table.headers.rul')}</th>
                  <th className="p-2 text-gray-700 dark:text-gray-300 w-[8%] text-sm">{t('pages.dashboard.table.headers.temperature')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedTableMeasurements
                  .slice(
                    (currentPage - 1) * itemsPerPage,
                    currentPage * itemsPerPage
                  )
                  .map((measurement) => {
                    const transformer = transformers?.find((t: { id: number }) => t.id === measurement.transformer);
                    return (
                      <tr
                        key={measurement.id}
                        className="border-b border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
                      >
                        <td className="p-2 text-gray-800 dark:text-gray-200 text-sm truncate">{transformer?.name || measurement.transformer}</td>
                        <td className="p-2 text-gray-800 dark:text-gray-200 text-sm">
                          {formatDate(measurement.timestamp)}
                        </td>
                        <td className="p-2 text-gray-800 dark:text-gray-200 text-sm">{measurement.h2.toFixed(2)}</td>
                        <td className="p-2 text-gray-800 dark:text-gray-200 text-sm">{measurement.co.toFixed(2)}</td>
                        <td className="p-2 text-gray-800 dark:text-gray-200 text-sm">{measurement.c2h4.toFixed(2)}</td>
                        <td className="p-2 text-gray-800 dark:text-gray-200 text-sm">{measurement.c2h2.toFixed(2)}</td>
                        <td className="p-2 text-gray-800 dark:text-gray-200 text-sm">
                          <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getFDDStatusInfo(measurement.fdd, t).color} ${getFDDStatusInfo(measurement.fdd, t).bg}`}>
                            {getFDDStatusInfo(measurement.fdd, t).label}
                          </span>
                        </td>
                        <td className="p-2 text-gray-800 dark:text-gray-200 text-sm">{formatRUL(measurement.rul, { i18n, useGrammarRules: true })}</td>
                        <td className="p-2 text-gray-800 dark:text-gray-200 text-sm">{measurement.temperature}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            
            {/* Pagination Controls */}
            {processedMeasurements.length > 0 && (
              <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4 dark:bg-gray-900 dark:border-gray-700">
                <div className="flex flex-1 justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                  >
                    {t('previous')}
                  </button>
                  <span className="mx-4 flex items-center text-gray-700 dark:text-gray-300">
                    {t('page')} {currentPage} {t('of')} {Math.ceil(processedMeasurements.length / itemsPerPage)}
                  </span>
                  <button
                    onClick={() => setCurrentPage(page => Math.min(Math.ceil(processedMeasurements.length / itemsPerPage), page + 1))}
                    disabled={currentPage >= Math.ceil(processedMeasurements.length / itemsPerPage)}
                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                  >
                    {t('next')}
                  </button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {t('showing', 'Showing')} <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + 1, processedMeasurements.length)}</span>{' '}
                      {t('to', 'to')}{' '}
                      <span className="font-medium">
                        {Math.min(currentPage * itemsPerPage, processedMeasurements.length)}
                      </span>{' '}
                      {t('of', 'of')}{' '}
                      <span className="font-medium">{processedMeasurements.length}</span>{' '}
                      {t('results', 'results')}
                    </p>
                  </div>
                  <div>
                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed dark:ring-gray-600 dark:hover:bg-gray-700"
                      >
                        <span className="sr-only">{t('previous', 'Previous')}</span>
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                        </svg>
                      </button>
                      {Array.from({ length: Math.min(5, Math.ceil(processedMeasurements.length / itemsPerPage)) }, (_, i) => {
                        const pageNumber = i + 1;
                        return (
                          <button
                            key={pageNumber}
                            onClick={() => setCurrentPage(pageNumber)}
                            className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                              currentPage === pageNumber
                                ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-blue-500'
                                : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-offset-0 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-700'
                            }`}
                          >
                            {pageNumber}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setCurrentPage(page => Math.min(Math.ceil(processedMeasurements.length / itemsPerPage), page + 1))}
                        disabled={currentPage >= Math.ceil(processedMeasurements.length / itemsPerPage)}
                        className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed dark:ring-gray-600 dark:hover:bg-gray-700"
                      >
                        <span className="sr-only">{t('next', 'Next')}</span>
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Remove unused convertYearsToDetailedTime function and update ErrorBoundary
class ChartErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  
  static getDerivedStateFromError(_error: unknown) {
    return { hasError: true };
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-[600px] bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-center">
            <p className="text-gray-600 mb-2">Failed to load chart</p>
            <button 
              onClick={() => this.setState({ hasError: false })}
              className="text-blue-500 hover:text-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    
    return this.props.children;
  }
}