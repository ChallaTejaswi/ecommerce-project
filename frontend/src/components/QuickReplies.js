import React from 'react';
import { Box, Chip } from '@mui/material';

const QuickReplies = ({ replies, onReplyClick }) => {
  if (!replies || replies.length === 0) return null;

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: 1, 
        mt: 1,
        maxWidth: '100%'
      }}
    >
      {replies.map((reply, index) => (
        <Chip
          key={index}
          label={reply}
          variant="outlined"
          clickable
          onClick={() => onReplyClick(reply)}
          sx={{
            borderRadius: 15,
            fontSize: '0.8rem',
            '&:hover': {
              backgroundColor: 'primary.main',
              color: 'white'
            }
          }}
        />
      ))}
    </Box>
  );
};

export default QuickReplies;
