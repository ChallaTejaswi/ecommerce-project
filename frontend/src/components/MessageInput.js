import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  IconButton,
  InputAdornment,
  Chip
} from '@mui/material';
import { Send, Mic, MicOff } from '@mui/icons-material';

const MessageInput = ({ onSendMessage, isListening, transcript }) => {
  const [message, setMessage] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (transcript) {
      setMessage(transcript);
    }
  }, [transcript]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} className="message-input">
      {isListening && (
        <Box className="listening-indicator">
          <Chip 
            label="Listening..." 
            color="primary" 
            size="small"
            icon={<Mic />}
          />
        </Box>
      )}
      
      <TextField
        ref={inputRef}
        fullWidth
        variant="outlined"
        placeholder={isListening ? "Speak now..." : "Type your message..."}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        multiline
        maxRows={4}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                type="submit"
                color="primary"
                disabled={!message.trim()}
                edge="end"
              >
                <Send />
              </IconButton>
            </InputAdornment>
          ),
          style: {
            borderRadius: 25,
            backgroundColor: isListening ? '#f3e5f5' : 'white'
          }
        }}
      />
    </Box>
  );
};

export default MessageInput;
