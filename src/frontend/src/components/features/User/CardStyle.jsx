import React from 'react';
import { Card } from '@mui/material';

export const CardStyle = ({ title, children, sx = {}, ...props }) => (
  <Card
    sx={{
      width: 400,
      p: 3,
      borderRadius: 4,
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      border: '2px solid rgba(255, 255, 255, 0.15)',
      boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)',
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
      ...sx,
    }}
    {...props}
  >
    {title && (
      <h3 className="mb-3 text-center text-2xl font-bold text-indigo-600 dark:text-indigo-400">
        {title}
      </h3>
    )}
    {children}
  </Card>
);
