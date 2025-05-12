import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Send, ArrowLeft } from 'lucide-react';
import api from '../lib/axios';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';


interface SupportMessage {
  id: number;
  content: string;
  sender: number;
  session: number;
  timestamp: string;
  is_read: boolean;
  sender_name: string;
}

interface SupportSession {
  id: number;
  user: number;
  user_name: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_resolved: boolean;
  messages: SupportMessage[];
  has_unread?: boolean; // Added to track unread status
  latest_message?: string; // Latest message for preview
  latest_timestamp?: string; // Latest message timestamp
}

const AdminChat: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<SupportSession | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Only staff/admin users should access this component
  useEffect(() => {
    if (!user?.is_staff) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Fetch all support sessions
  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/support-sessions/');
      
      // Process sessions to determine unread status and latest message
      const processedSessions = response.data.map((session: SupportSession) => {
        const messages = session.messages || [];
        const hasUnread = messages.some(
          (msg: SupportMessage) => !msg.is_read && msg.sender !== user?.id
        );
        const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;
        
        return {
          ...session,
          has_unread: hasUnread,
          latest_message: latestMessage?.content || 'No messages',
          latest_timestamp: latestMessage?.timestamp || session.created_at
        };
      });
      
      // Sort by latest timestamp descending (newest first)
      const sortedSessions = processedSessions.sort((a: SupportSession, b: SupportSession) => {
        // Prioritize unread sessions
        if (a.has_unread && !b.has_unread) return -1;
        if (!a.has_unread && b.has_unread) return 1;
        
        // Then sort by timestamp
        return new Date(b.latest_timestamp || b.updated_at).getTime() - 
               new Date(a.latest_timestamp || a.updated_at).getTime();
      });
      
      setSessions(sortedSessions);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      setError('Failed to load support sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    
    // Refresh sessions periodically
    const interval = setInterval(fetchSessions, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom of messages when selected session changes or new messages come in
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedSession]);

  const handleSessionSelect = async (session: SupportSession) => {
    setSelectedSession(session);
    
    // Mark messages as read when session is opened
    if (session.has_unread) {
      try {
        // Use the more efficient mark_session_read endpoint
        await api.post('/api/support-messages/mark_session_read/', {
          session_id: session.id
        });
        
        // Update the local state
        setSessions(prev => prev.map(s => 
          s.id === session.id 
            ? { ...s, has_unread: false, messages: s.messages.map(msg => 
                msg.sender !== user?.id ? { ...msg, is_read: true } : msg
              )} 
            : s
        ));
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedSession) return;
    
    try {
      setSendingMessage(true);
      const response = await api.post('/api/support-messages/', {
        content: newMessage.trim(),
        session: selectedSession.id
      });
      
      // Update the selected session with the new message
      setSelectedSession(prev => {
        if (!prev) return null;
        
        const updatedMessages = [...prev.messages, response.data];
        return {
          ...prev,
          messages: updatedMessages,
          latest_message: response.data.content,
          latest_timestamp: response.data.timestamp
        };
      });
      
      // Also update the session in the sessions list
      setSessions(prev => prev.map(session => 
        session.id === selectedSession.id
          ? {
              ...session,
              messages: [...session.messages, response.data],
              latest_message: response.data.content,
              latest_timestamp: response.data.timestamp
            }
          : session
      ));
      
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (e) {
      return 'Invalid date';
    }
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Generate a consistent color based on username
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    
    // Simple hash function to pick a color
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  if (!user?.is_staff) {
    return null;
  }

  return (
    <div className={`flex h-[calc(100vh-80px)] ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg overflow-hidden`}>
      {/* Left sidebar with sessions */}
      <div className={`w-80 border-r ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} ${selectedSession && 'hidden md:block'}`}>
        <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>{t('support.sessions')}</h2>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="overflow-y-auto h-full">
            {sessions.length === 0 ? (
              <div className={`p-4 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('support.noActiveSessions')}
              </div>
            ) : (
              <>
                {/* Grid view of user avatars */}
                <div className={`grid grid-cols-3 gap-4 p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                  {sessions.map(session => (
                    <div 
                      key={`avatar-${session.id}`}
                      className="flex flex-col items-center cursor-pointer"
                      onClick={() => handleSessionSelect(session)}
                    >
                      <div className="relative mb-1">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white ${getAvatarColor(session.user_name)}`}>
                          {getInitials(session.user_name)}
                        </div>
                        {session.has_unread && (
                          <div className="absolute bottom-0 right-0 w-4 h-4 bg-red-500 border-2 border-white rounded-full"></div>
                        )}
                      </div>
                      <span className={`text-xs text-center truncate w-full ${session.has_unread ? 'font-bold' : 'font-normal'} ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                        {session.user_name}
                      </span>
                    </div>
                  ))}
                </div>
                
                {/* List view of sessions */}
                <div className={`border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                  {sessions.map(session => (
                    <div
                      key={`list-${session.id}`}
                      className={`flex items-center p-3 cursor-pointer border-b
                        ${isDarkMode 
                          ? `border-gray-700 hover:bg-gray-700 ${selectedSession?.id === session.id ? 'bg-gray-700' : ''}` 
                          : `border-gray-100 hover:bg-gray-50 ${selectedSession?.id === session.id ? 'bg-blue-50' : ''}`
                        }`}
                      onClick={() => handleSessionSelect(session)}
                    >
                      <div className="relative">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${getAvatarColor(session.user_name)}`}>
                          {getInitials(session.user_name)}
                        </div>
                        {session.has_unread && (
                          <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full"></div>
                        )}
                      </div>
                      <div className="ml-3 flex-1 overflow-hidden">
                        <div className="flex justify-between items-center">
                          <h3 className={`text-sm ${session.has_unread ? 'font-bold' : 'font-medium'} ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                            {session.user_name}
                          </h3>
                          <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {formatTime(session.latest_timestamp || session.updated_at)}
                          </span>
                        </div>
                        <p className={`text-xs truncate ${
                          session.has_unread 
                            ? `font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}` 
                            : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {session.latest_message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      
      {/* Right chat area */}
      <div className={`flex-1 flex flex-col ${!selectedSession && 'hidden md:flex'}`}>
        {selectedSession ? (
          <>
            {/* Chat header */}
            <div className={`flex items-center p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <button 
                className={`md:hidden mr-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
                onClick={() => setSelectedSession(null)}
              >
                <ArrowLeft size={20} />
              </button>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${getAvatarColor(selectedSession.user_name)}`}>
                {getInitials(selectedSession.user_name)}
              </div>
              <div className="ml-3">
                <h3 className={`font-medium ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  {selectedSession.user_name}
                </h3>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {selectedSession.is_resolved ? 'Resolved' : 'Active'}
                </p>
              </div>
            </div>
            
            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto">
              {selectedSession.messages.length === 0 ? (
                <div className={`h-full flex items-center justify-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t('support.noMessagesYet')}
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedSession.messages.map(message => (
                    <div 
                      key={message.id} 
                      className={`flex ${message.sender === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      {message.sender !== user?.id && (
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white mr-2 ${getAvatarColor(message.sender_name)}`}>
                          {getInitials(message.sender_name)}
                        </div>
                      )}
                      <div>
                        <div 
                          className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-lg ${
                            message.sender === user?.id 
                              ? 'bg-blue-500 text-white rounded-br-none' 
                              : `${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800'} rounded-bl-none`
                          }`}
                        >
                          {message.content}
                        </div>
                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
                          {formatTime(message.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message input */}
            <form onSubmit={handleSendMessage} className={`p-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              {error && (
                <div className="mb-2 text-sm text-red-500">{error}</div>
              )}
              <div className="flex items-center">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={t('support.placeholder')}
                  className={`flex-1 p-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                  disabled={sendingMessage}
                />
                <button
                  type="submit"
                  disabled={sendingMessage || !newMessage.trim()}
                  className={`${
                    isDarkMode 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'bg-blue-500 hover:bg-blue-600'
                  } text-white p-2 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50`}
                >
                  <Send size={20} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className={`flex flex-col items-center justify-center h-full ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <MessageSquare size={48} className={`mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} />
            <p>{t('support.selectConversation')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminChat;