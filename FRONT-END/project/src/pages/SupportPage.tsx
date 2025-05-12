import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, TextField, Button, Typography, Paper, CircularProgress } from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SupportPage: React.FC = () => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.REACT_APP_HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: `You are a transformer expert assistant. Answer the following question about transformer measurements: ${input}`,
          parameters: {
            max_new_tokens: 250,
            temperature: 0.7,
          },
        }),
      });

      const result = await response.json();
      const assistantMessage: Message = {
        role: 'assistant',
        content: result[0]?.generated_text || 'Sorry, I could not process your request.',
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, there was an error processing your request.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ 
      p: 3, 
      maxWidth: 800, 
      mx: 'auto',
      bgcolor: isDarkMode ? 'background.default' : 'background.paper',
      color: isDarkMode ? 'text.primary' : 'inherit'
    }}>
      <Typography variant="h4" gutterBottom sx={{ color: isDarkMode ? 'text.primary' : 'inherit' }}>
        {t('support.title', 'Support Chat')}
      </Typography>
      <Paper 
        sx={{ 
          p: 2, 
          mb: 2, 
          height: '60vh', 
          overflow: 'auto',
          bgcolor: isDarkMode ? 'background.paper' : 'background.default',
          borderColor: isDarkMode ? 'divider' : undefined
        }}
      >
        {messages.map((message, index) => (
          <Box
            key={index}
            sx={{
              mb: 2,
              display: 'flex',
              justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <Paper
              sx={{
                p: 2,
                maxWidth: '70%',
                bgcolor: message.role === 'user' 
                  ? 'primary.main' 
                  : isDarkMode 
                    ? 'background.paper' 
                    : 'grey.100',
                color: message.role === 'user' 
                  ? 'primary.contrastText' 
                  : isDarkMode 
                    ? 'text.primary' 
                    : 'text.primary',
              }}
            >
              <Typography>{message.content}</Typography>
            </Paper>
          </Box>
        ))}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <CircularProgress />
          </Box>
        )}
      </Paper>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          value={input}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
          onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSend()}
          placeholder={t('support.placeholder', 'Ask about transformer measurements...')}
          disabled={loading}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: isDarkMode ? 'background.paper' : 'background.default'
            },
            '& .MuiInputBase-input': {
              color: isDarkMode ? 'text.primary' : undefined
            }
          }}
        />
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={loading || !input.trim()}
          endIcon={<SendIcon />}
          sx={{
            bgcolor: isDarkMode ? 'primary.dark' : 'primary.main',
            '&:hover': {
              bgcolor: isDarkMode ? 'primary.main' : 'primary.dark'
            }
          }}
        >
          {t('support.send', 'Send')}
        </Button>
      </Box>
    </Box>
  );
};

export default SupportPage;