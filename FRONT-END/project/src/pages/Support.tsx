import { Send, MessageSquare, Bot, AlertCircle, Trash2, Activity } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import api from '../lib/axios';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AdminMessage {
  id?: number;
  content: string;
  sender: number;
  session: number;
  timestamp?: string;
  is_read?: boolean;
  sender_name?: string;
  highlight?: boolean; // Add highlight property
}

interface SupportSession {
  id?: number;
  user?: number;
  title: string;
  created_at?: string;
  updated_at?: string;
  is_resolved?: boolean;
  messages: AdminMessage[];
}

interface Transformer {
  id: number;
  name: string;
  user: number;
}

const Support = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'ai' | 'admin'>('admin');
  const [error, setError] = useState<string | null>(null);
  const { isDarkMode } = useThemeStore();

  // AI Assistant state
  const [aiMessages, setAiMessages] = useState<Message[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [currentAiConversation, setCurrentAiConversation] = useState<{id?: number} | null>(null);

  // Admin messaging state
  const [adminMessages, setAdminMessages] = useState<AdminMessage[]>([]);
  const [adminInput, setAdminInput] = useState('');
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [isAdminTyping, setIsAdminTyping] = useState(false);
  const [currentSession, setCurrentSession] = useState<SupportSession | null>(null);

  // Remove unused state
  const [transformers, setTransformers] = useState<Transformer[]>([]);

  // Set initial tab and handle URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session');
    
    if (sessionId) {
      setActiveTab('admin'); // Switch to admin tab if session ID is present
      fetchSessionById(Number(sessionId));
    } else {
      // Initialize a support session if there isn't one
      fetchOrCreateSupportSession();
    }
  }, []);

  // Fetch transformers
  useEffect(() => {
    const fetchTransformers = async () => {
      try {
        const response = await api.get('/api/transformers/');
        setTransformers(response.data);
      } catch (error) {
        console.error('Error fetching transformers:', error);
      }
    };
    fetchTransformers();
  }, []);

  const fetchSessionById = async (sessionId: number) => {
    if (user?.is_staff) return;
    
    try {
      setError(null);
      const response = await api.get(`/api/support-sessions/${sessionId}/`);
      setCurrentSession(response.data);
      // Add highlighting class for unread messages
      const messages = response.data.messages || [];
      setAdminMessages(messages.map((msg: AdminMessage) => ({
        ...msg,
        highlight: !msg.is_read && msg.sender !== user?.id
      })));
    } catch (error: any) {
      console.error('Error fetching support session by ID:', error);
      setError(error.response?.data?.detail || 'Failed to fetch support session');
      fetchOrCreateSupportSession();
    }
  };

  const fetchOrCreateSupportSession = async () => {
    if (user?.is_staff) return;
    
    try {
      setError(null);
      // First try to fetch existing unresolved sessions
      const response = await api.get('/api/support-sessions/', {
        params: { is_resolved: false }
      });
      
      const data = response.data;
      
      if (data.length > 0) {
        // Use the most recent session
        setCurrentSession(data[0]);
        setAdminMessages(data[0].messages || []);
      } else {
        // Create a new session
        // Note: Backend automatically sets user from the authenticated request
        const createResponse = await api.post('/api/support-sessions/', {
          title: 'Support Request'
        });
        
        const newSession = createResponse.data;
        setCurrentSession(newSession);
        setAdminMessages([]);
      }
    } catch (error: any) {
      console.error('Error fetching or creating support session:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to create or fetch support session';
      setError(errorMsg);
    }
  };

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim()) return;

    const userMessage = aiInput.trim();
    setAiInput('');
    setAiMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);
    setError(null);

    const attemptRequest = async (attempt: number): Promise<any> => {
      try {
        const response = await api.post('/api/chat/chat/', {
          message: userMessage,
          conversation_id: currentAiConversation?.id
        }, {
          timeout: 30000 * (attempt + 1) // Increase timeout with each retry
        });

        return response.data;
      } catch (error: any) {
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
          return attemptRequest(attempt + 1);
        }
        throw error;
      }
    };

    try {
      const data = await attemptRequest(0);
      const { conversation_id, message } = data;
      setCurrentAiConversation(prev => ({ ...prev, id: conversation_id }));
      setAiMessages(prev => [...prev, { role: 'assistant', content: message.content }]);
    } catch (error: any) {
      console.error('Error:', error);
      setError(error.displayMessage || 'Failed to get AI response. Please try again.');
      setAiMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again later.' 
      }]);
    } finally {
      setIsAiLoading(false);
      setIsTyping(false);
    }
  };

  useEffect(() => {
    const loadAiConversation = async () => {
      try {
        const response = await api.get('/api/chat/');
        const conversations = response.data;
        if (conversations.length > 0) {
          const latestConversation = conversations[0]; // Get most recent conversation
          setCurrentAiConversation(latestConversation);
          setAiMessages(latestConversation.messages.map((msg: any) => ({
            role: msg.role,
            content: msg.content
          })));
        }
      } catch (error) {
        console.error('Error loading AI conversation:', error);
      }
    };

    if (activeTab === 'ai') {
      loadAiConversation();
    }
  }, [activeTab]);

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminInput.trim() || !currentSession?.id) return;

    const messageContent = adminInput.trim();
    setAdminInput('');
    setIsAdminTyping(true);

    try {
      setError(null);
      // Only session and content are required; sender is automatically set by the backend
      const response = await api.post('/api/support-messages/', {
        content: messageContent,
        session: currentSession.id
      });

      // Add the message from the response to our list
      const newMessage = response.data;
      setAdminMessages(prev => [...prev, newMessage]);
    } catch (error: any) {
      console.error('Error sending message to admin:', error);
      setError(error.response?.data?.detail || 'Failed to send message');
    } finally {
      setIsAdminLoading(false);
      setIsAdminTyping(false);
    }
  };

  const clearAiConversation = async () => {
    try {
      setError(null);
      if (currentAiConversation?.id) {
        await api.delete(`/api/chat/${currentAiConversation.id}/`);
      }
      setAiMessages([]);
      setCurrentAiConversation(null);
    } catch (error: any) {
      console.error('Error clearing conversation:', error);
      setError(error.response?.data?.detail || 'Failed to clear conversation');
    }
  };

  const handleTransformerClick = async (transformer: Transformer) => {
    try {
      const response = await api.get('/api/measurements/', {
        params: {
          transformer: transformer.id,
          ordering: '-timestamp',
          limit: 1
        }
      });
      
      if (response.data.length > 0) {
        const measurement = response.data[0];
        const measurementText = `Last measurement for transformer ${transformer.name}:
H2: ${measurement.h2} ppm
CO: ${measurement.co} ppm
C2H2: ${measurement.c2h2} ppm
C2H4: ${measurement.c2h4} ppm
Temperature: ${measurement.temperature || 'N/A'} °C
FDD Status: ${measurement.fdd}
RUL: ${measurement.rul} hours`;

        setAiInput(measurementText);
      }
    } catch (error) {
      console.error('Error fetching last measurement:', error);
    }
  };

  const formatRelativeTime = (timestamp: string) => {
    if (!timestamp) return '';
    
    const messageDate = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - messageDate.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return t('just_now', 'Just now');
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} ${minutes === 1 ? t('minute_ago', 'minute ago') : t('minutes_ago', 'minutes ago')}`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} ${hours === 1 ? t('hour_ago', 'hour ago') : t('hours_ago', 'hours ago')}`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} ${days === 1 ? t('day_ago', 'day ago') : t('days_ago', 'days ago')}`;
    }
  };

  // Add session refresh mechanism
  useEffect(() => {
    // Only set up polling if on admin tab and we have a current session
    if (activeTab === 'admin' && currentSession?.id && !user?.is_staff) {
      // Function to refresh messages
      const refreshSession = async () => {
        try {
          const response = await api.get(`/api/support-sessions/${currentSession.id}/`);
          // Only update if there are new messages
          if (response.data.messages.length > adminMessages.length) {
            const messages = response.data.messages || [];
            setAdminMessages(messages.map((msg: AdminMessage) => ({
              ...msg,
              highlight: !msg.is_read && msg.sender !== user?.id
            })));
            
            // Mark messages as read
            if (messages.some((msg: AdminMessage) => !msg.is_read && msg.sender !== user?.id)) {
              try {
                await api.post('/api/support-messages/mark_session_read/', {
                  session_id: currentSession.id
                });
              } catch (error) {
                console.error('Error marking messages as read:', error);
              }
            }
          }
        } catch (error) {
          console.error('Error refreshing session:', error);
        }
      };
      
      // Initial refresh
      refreshSession();
      
      // Set up polling with a reasonable interval
      const interval = setInterval(refreshSession, 10000); // Poll every 10 seconds
      
      return () => clearInterval(interval);
    }
  }, [activeTab, currentSession?.id, user?.id, user?.is_staff, adminMessages.length]);

  const renderTabContent = () => {
    if (activeTab === 'ai') {
      return (
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-4 h-[600px] flex flex-col`}>
          <div className="flex justify-end mb-2">
            <button
              onClick={clearAiConversation}
              className={`text-gray-500 hover:text-red-500 p-2 rounded-lg flex items-center gap-1`}
              title={t('support.clearConversation')}
            >
              <Trash2 className="w-4 h-4" />
              {t('support.clearConversation')}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto mb-4 space-y-4">
            {aiMessages.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user' 
                    ? 'bg-blue-500 text-white' 
                    : isDarkMode
                      ? 'bg-gray-700 text-gray-200'
                      : 'bg-gray-100 text-gray-900'
                }`}>
                  {message.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className={`max-w-[80%] rounded-lg p-3 ${
                  isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-900'
                }`}>
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <form onSubmit={handleAiSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder={t('support.aiPlaceholder')}
                className={`w-full p-2 pr-8 rounded-lg border ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                disabled={isAiLoading}
              />
              {isAiLoading && (
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                  <Activity className="w-5 h-5 text-gray-400 animate-spin" />
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={isAiLoading || !aiInput.trim()}
              className={`px-4 py-2 rounded-lg ${
                isDarkMode 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      );
    }

    return (
      <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-4 h-[600px] flex flex-col`}>
        <div className="flex-1 overflow-y-auto mb-4 space-y-4">
          {adminMessages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === user?.id ? 'justify-end' : 'justify-start'} mb-4`}>
              <div className={`max-w-[80%] rounded-lg p-3 ${
                message.sender === user?.id 
                  ? 'bg-blue-500 text-white' 
                  : message.highlight
                    ? isDarkMode
                      ? 'bg-blue-900 bg-opacity-20 text-gray-200 border-l-4 border-blue-500'
                      : 'bg-blue-50 text-gray-900 border-l-4 border-blue-500'
                    : isDarkMode
                      ? 'bg-gray-700 text-gray-200'
                      : 'bg-gray-100 text-gray-900'
              } transition-colors duration-300`}>
                <div className={`text-sm opacity-75 mb-1 ${
                  message.sender === user?.id 
                    ? 'text-white' 
                    : isDarkMode
                      ? 'text-gray-300'
                      : 'text-gray-600'
                }`}>
                  {message.sender === user?.id ? t('you') : message.sender_name}
                </div>
                <div className="mb-2">{message.content}</div>
                <div className={`text-xs opacity-75 text-right ${
                  message.sender === user?.id 
                    ? 'text-white' 
                    : isDarkMode
                      ? 'text-gray-400'
                      : 'text-gray-500'
                }`}>
                  {formatRelativeTime(message.timestamp || '')}
                </div>
              </div>
            </div>
          ))}
          {isAdminTyping && (
            <div className="flex justify-start">
              <div className={`max-w-[80%] rounded-lg p-3 ${
                isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-900'
              }`}>
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <form onSubmit={handleAdminSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={adminInput}
              onChange={(e) => setAdminInput(e.target.value)}
              placeholder={t('support.aiPlaceholder')}
              className={`w-full p-2 pr-8 rounded-lg border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              disabled={isAdminLoading}
            />
            {isAdminLoading && (
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                <Activity className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={isAdminLoading || !adminInput.trim()}
            className={`px-4 py-2 rounded-lg ${
              isDarkMode 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2`}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    );
  };

  return (
    <div className={`container mx-auto px-4 py-8 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        .typing-indicator {
          display: flex;
          align-items: center;
          column-gap: 4px;
        }
        
        .typing-indicator span {
          height: 8px;
          width: 8px;
          background-color: #888;
          border-radius: 50%;
          display: inline-block;
          opacity: 0.4;
        }
        
        .typing-indicator span:nth-child(1) {
          animation: pulse 1s infinite;
        }
        
        .typing-indicator span:nth-child(2) {
          animation: pulse 1s infinite 0.3s;
        }
        
        .typing-indicator span:nth-child(3) {
          animation: pulse 1s infinite 0.6s;
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 0.4;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
      `}} />
      
      {/* Main content */}
      <h1 className="text-2xl font-bold mb-6">{t('support.title')}</h1>
      
      {error && (
        <div className={`mb-4 p-3 ${isDarkMode ? 'bg-red-900 bg-opacity-20 border-red-800' : 'bg-red-50 border-red-200'} rounded-md border flex items-center`}>
          <AlertCircle className="w-5 h-5 mr-2 text-red-600" />
          {error}
        </div>
      )}

      {!user?.is_staff && (
        <div className={`flex mb-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <button
            className={`flex items-center px-4 py-2 mr-2 ${
              activeTab === 'ai' 
                ? `border-b-2 border-blue-500 text-blue-500` 
                : `${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`
            }`}
            onClick={() => setActiveTab('ai')}
          >
            <Bot className="w-5 h-5 mr-2" />
            AI Assistant
          </button>
          <button
            className={`flex items-center px-4 py-2 ${
              activeTab === 'admin' 
                ? `border-b-2 border-blue-500 text-blue-500` 
                : `${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`
            }`}
            onClick={() => setActiveTab('admin')}
          >
            <MessageSquare className="w-5 h-5 mr-2" />
            {t('support.message_support')}
          </button>
        </div>
      )}
      
      {renderTabContent()}
    </div>
  );
};

export default Support;