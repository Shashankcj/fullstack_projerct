export const formatDurationString = (durationStr, minutesToSubtract = 1) => {
  if (!durationStr) return 'N/A';
 
  const [hours, minutes, seconds] = durationStr.split(':');
  const h = parseInt(hours, 10);
  const m = parseInt(minutes, 10);
  const s = parseFloat(seconds);
 
  // Convert everything to total minutes
  let totalMinutes = (h * 60) + m + Math.floor(s / 60);
 
  // Subtract the specified minutes (default 1 minute)
  totalMinutes = Math.max(0, totalMinutes - minutesToSubtract);
 
  // Convert back to days, hours, minutes
  const days = Math.floor(totalMinutes / (24 * 60));
  const remainingMinutes = totalMinutes % (24 * 60);
  const finalHours = Math.floor(remainingMinutes / 60);
  const finalMinutes = remainingMinutes % 60;
 
  const parts = [];
 
  if (days > 0) {
    parts.push(`${days} day${days > 1 ? 's' : ''}`);
  }
 
  if (finalHours > 0) {
    parts.push(`${finalHours} hr${finalHours > 1 ? 's' : ''}`);
  }
 
  if (finalMinutes > 0) {
    parts.push(`${finalMinutes} min`);
  }
 
  // If less than 1 minute after subtraction
  if (parts.length === 0) {
    parts.push('< 1 min');
  }
 
  return parts.join(' ');
};