// Shared formatting helpers for markdown responses

export function msToHoursMinutes(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function recoveryEmoji(score: number): string {
  if (score >= 67) return 'Green';
  if (score >= 34) return 'Yellow';
  return 'Red';
}

export function strainLevel(strain: number): string {
  if (strain >= 18) return 'Overreaching';
  if (strain >= 14) return 'High';
  if (strain >= 10) return 'Medium';
  return 'Light';
}
