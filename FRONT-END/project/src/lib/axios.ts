import axios from 'axios';

// Create a function that will get the auth store without creating circular imports
const getAuthStore = () => {
  // Dynamic import to avoid circular dependency
  return import('../stores/auth').then(module => module.useAuthStore.getState());
};

// Request throttling mechanism
const pendingRequests = new Map();
const throttleConfig = {
  '/api/unread-notifications-count/': { minDelay: 5000 }, // Minimum 5 second delay between identical requests
  '/api/admin-notifications/': { minDelay: 5000 }
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  withCredentials: true,  // Important for sending cookies
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Get CSRF token from cookie
const getCSRFToken = () => {
  const name = 'csrftoken';
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
};

// Add request interceptor to include CSRF token and Authorization
api.interceptors.request.use(
  async (config) => {
    const csrfToken = getCSRFToken();
    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken;
    }

    // Add Authorization header if user is logged in
    try {
      const authStore = await getAuthStore();
      const token = authStore.token;
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }

    // Apply request throttling
    const endpoint = config.url?.replace(config.baseURL || '', '');
    if (endpoint && throttleConfig[endpoint]) {
      const requestKey = `${config.method}-${endpoint}`;
      const lastRequest = pendingRequests.get(requestKey);
      const now = Date.now();
      
      if (lastRequest) {
        const timeSinceLastRequest = now - lastRequest;
        const minDelay = throttleConfig[endpoint].minDelay;
        
        if (timeSinceLastRequest < minDelay) {
          // If we've made this request too recently, reject it
          return Promise.reject({
            response: {
              status: 429,
              data: { detail: `Request throttled. Please wait ${Math.ceil((minDelay - timeSinceLastRequest)/1000)} seconds.` }
            },
            config
          });
        }
      }
      
      // Update the timestamp for this request
      pendingRequests.set(requestKey, now);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors consistently
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Handle network errors and timeouts
    if (!error.response) {
      const errorMessage = error.code === 'ECONNABORTED' 
        ? 'Request timed out. Please try again.'
        : 'Network error. Please check your connection.';
      
      error.displayMessage = errorMessage;
      return Promise.reject(error);
    }

    // Handle authentication errors (401)
    if (error.response?.status === 401) {
      // Only log out if we're not already trying to login
      if (!error.config.url?.includes('/api/login/')) {
        try {
          const authStore = await getAuthStore();
          authStore.logout();
        } catch (err) {
          console.error('Failed to logout on 401:', err);
        }
      }
    }
    
    // If error is 403 and related to CSRF
    if (error.response?.status === 403 && error.response?.data?.detail?.includes('CSRF')) {
      // Refresh the page to get a new CSRF token
      window.location.reload();
      return Promise.reject(error);
    }

    // For 429 Too Many Requests, log with timing info
    if (error.response?.status === 429) {
      console.warn(`Rate limit hit: ${error.config.url}. ${error.response.data.detail || ''}`);
    }

    error.displayMessage = error.response?.data?.detail || error.message;
    return Promise.reject(error);
  }
);

export default api;