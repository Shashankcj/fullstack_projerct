export const timeAgo = (isoTime) => {
  const now  = new Date();
  const past = new Date(isoTime);
  const diff = Math.floor((now - past) / 1000);

  if (diff < 5)        return 'Just now';
  if (diff < 60)       return `${diff} sec ago`;
  if (diff < 3_600)    return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86_400)   return `${Math.floor(diff / 3_600)} hr ago`;
  if (diff < 604_800)  return `${Math.floor(diff / 86_400)} day ago`;

  return past.toLocaleString('en-IN', {
    day:    'numeric',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
};
