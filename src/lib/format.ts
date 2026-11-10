export function fmtDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(m >= 10_000 ? 0 : 1)} km` : `${Math.round(m)} m`;
}

export function fmtDuration(hours: number): string {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const min = total % 60;
  if (h === 0) return `${min} min`;
  return min === 0 ? `${h} h` : `${h} h ${min} min`;
}

export function fmtLatLon([lon, lat]: [number, number]): string {
  return `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}, ${lon.toFixed(4)}°E`;
}
