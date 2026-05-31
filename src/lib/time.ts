/**
 * Human-friendly relative time for "last updated" style labels.
 * Dates are treated as UTC calendar days (the pipeline stamps by date).
 */
export function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'recently';
  const diffMs = Date.now() - new Date(dateStr + 'T00:00:00Z').getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
