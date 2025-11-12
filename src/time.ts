const SIXTY_SECONDS_MS = 60_000;

export function normalizeForEtag(dateIso: string): string {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    return dateIso;
  }

  const normalized = Math.floor(date.getTime() / SIXTY_SECONDS_MS) * SIXTY_SECONDS_MS;
  return new Date(normalized).toISOString();
}
