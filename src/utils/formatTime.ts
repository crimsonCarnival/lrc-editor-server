export function formatTime(s: number | string | null | undefined): string {
  if (!s || isNaN(Number(s))) return '0:00.00';
  const num = Number(s);
  const m = Math.floor(num / 60);
  const sec = Math.floor(num % 60);
  const ms = Math.floor(parseFloat((num % 1).toFixed(3)) * 100);
  return `${m}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}