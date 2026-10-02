/** Rain-drop boards report wetness. We map that to an estimated mm/hr (not a true rain gauge). */

export const FULL_WET_MM_PER_HOUR = 12;
const WETNESS_CURVE = 1.35;
const WETNESS_VALUES = new Set([0, 1, 100]);

export function isWetnessFlagValue(value: number | undefined): boolean {
  return typeof value === 'number' && !Number.isNaN(value) && WETNESS_VALUES.has(value);
}

export function wetnessFromReading(
  rainfall?: number,
  rainDetected?: boolean,
  wetness?: number
): number {
  if (typeof wetness === 'number' && !Number.isNaN(wetness)) {
    return Math.min(1, Math.max(0, wetness));
  }
  if (typeof rainfall !== 'number' || Number.isNaN(rainfall)) {
    return rainDetected ? 1 : 0;
  }
  if (rainfall === 0) return 0;
  if (rainfall === 1 || rainfall === 100) return 1;
  if (rainfall > 1 && rainfall <= 100) return rainfall / 100;
  if (rainfall > 100 && rainfall <= 1023) return Math.min(1, Math.max(0, 1 - rainfall / 1023));
  if (rainfall > 1023 && rainfall <= 4095) return Math.min(1, Math.max(0, 1 - rainfall / 4095));
  if (typeof rainDetected === 'boolean') return rainDetected ? 1 : 0;
  return 0;
}

export function estimatedMmPerHour(wetness: number): number {
  const clamped = Math.min(1, Math.max(0, wetness));
  return Number((FULL_WET_MM_PER_HOUR * clamped ** WETNESS_CURVE).toFixed(2));
}

export function isRainDetected(value: number | undefined, rainDetected?: boolean, wetness?: number): boolean {
  if (typeof rainDetected === 'boolean') return rainDetected;
  return wetnessFromReading(value, rainDetected, wetness) >= 0.15;
}

export function seriesLooksLikeWetnessSensor(
  values: Array<number | undefined>,
  rainDetectedFlags: Array<boolean | undefined> = [],
  rainTips: Array<number | undefined> = []
): boolean {
  if (rainTips.some((tips) => typeof tips === 'number' && tips >= 0 && !Number.isNaN(tips))) {
    return false;
  }
  if (rainDetectedFlags.some((flag) => typeof flag === 'boolean')) return true;
  const nums = values.filter((value): value is number => typeof value === 'number' && !Number.isNaN(value));
  if (!nums.length) return false;
  return nums.every((value) => value >= 0 && value <= 4095);
}

export function rainPlotValue(
  rainfall?: number,
  rainDetected?: boolean,
  wetnessMode = true,
  wetness?: number
): number {
  if (!wetnessMode) return typeof rainfall === 'number' && !Number.isNaN(rainfall) ? rainfall : 0;
  if (typeof wetness === 'number' && typeof rainfall === 'number' && rainfall <= FULL_WET_MM_PER_HOUR + 0.5) {
    return rainfall;
  }
  return estimatedMmPerHour(wetnessFromReading(rainfall, rainDetected, wetness));
}

export function estimatedMmInWindow(
  rows: Array<{ timestamp: string; rainPlot?: number }>
): number {
  if (rows.length < 2) return 0;
  let mm = 0;
  for (let i = 1; i < rows.length; i += 1) {
    const intensity = rows[i - 1].rainPlot ?? 0;
    const deltaHours =
      (new Date(rows[i].timestamp).getTime() - new Date(rows[i - 1].timestamp).getTime()) / 3600000;
    if (deltaHours <= 0 || deltaHours > 0.05) continue;
    mm += intensity * deltaHours;
  }
  return Number(mm.toFixed(2));
}

export function wetDurationMinutes(
  rows: Array<{ timestamp: string; rainfall?: number; rainDetected?: boolean; wetness?: number }>
): number {
  if (rows.length < 2) return 0;
  let minutes = 0;
  for (let i = 1; i < rows.length; i += 1) {
    const previous = rows[i - 1];
    if (!isRainDetected(previous.rainfall, previous.rainDetected, previous.wetness)) continue;
    const deltaMin =
      (new Date(rows[i].timestamp).getTime() - new Date(previous.timestamp).getTime()) / 60000;
    if (deltaMin > 0 && deltaMin <= 15) minutes += deltaMin;
  }
  return minutes;
}
