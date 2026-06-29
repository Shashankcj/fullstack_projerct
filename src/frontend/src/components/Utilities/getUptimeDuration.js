export function getUptimeDuration(startTime) {
  if (!startTime) return '';

  const start = new Date(startTime);
  const now = new Date();

  let diffMs = now - start;

  if (diffMs < 60 * 1000) return 'Just now'; 

  const minutes = Math.floor(diffMs / (1000 * 60)) % 60;
  const hours = Math.floor(diffMs / (1000 * 60 * 60)) % 24;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const parts = [];

  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hr${hours > 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} min${minutes > 1 ? 's' : ''}`);

  return parts.join(' ');
}

import { format } from 'date-fns';

export const formatDateTime = (date) => {
  if (!date) return '-';
  return format(new Date(date), 'yyyy-MM-dd HH:mm:ss'); // e.g., 2025-08-05 14:35:20
};