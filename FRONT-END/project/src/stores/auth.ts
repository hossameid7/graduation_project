import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../lib/axios';

interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: string;
  company?: string;
  is_staff?: boolean;
}

interface SignupData {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: string;
  company?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      login: async (usernameOrEmail: string, password: string) => {
        try {
          const response = await api.post('/api/login/', {
            username: usernameOrEmail,
            password,
          });
          
          if (response.data.user) {
            set({ user: response.data.user, isAuthenticated: true });
            // Wait for state to be updated
            await new Promise(resolve => setTimeout(resolve, 50));
          } else {
            throw new Error('Invalid response from server');
          }
        } catch (error: any) {
          set({ user: null, isAuthenticated: false });
          throw new Error(error.response?.data?.error || 'Login failed');
        }
      },

      logout: async () => {
        try {
          await api.post('/api/logout/');
        } catch (error) {
          console.error('Logout failed:', error);
        } finally {
          set({ user: null, isAuthenticated: false });
        }
      },

      checkAuth: async () => {
        try {
          const response = await api.get('/api/profile/');
          set({ user: response.data, isAuthenticated: true });
        } catch (error) {
          set({ user: null, isAuthenticated: false });
        }
      },

      signup: async (data: SignupData) => {
        try {
          const response = await api.post('/api/signup/', data);
          if (response.data.user) {
            set({ user: response.data.user, isAuthenticated: true });
          }
        } catch (error: any) {
          throw new Error(error.response?.data?.error || 'Signup failed');
        }
      },
    }),
    {
      name: 'auth-storage', // unique name for localStorage key
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }), // only persist these fields
    }
  )
);