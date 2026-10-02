const WETNESS_VALUES = new Set([0, 1, 100]);
const DEFAULT_MM_PER_TIP = 0.2;
const FULL_WET_MM_PER_HOUR = 12;
const WETNESS_CURVE = 1.35;

export function wetnessFromRaw(value, rainDetected) {
  if (typeof rainDetected === 'boolean' && (value === undefined || Number.isNaN(Number(value)))) {
    return rainDetected ? 1 : 0;
  }
  if (value === undefined || Number.isNaN(Number(value))) return 0;
  const rainfall = Number(value);
  if (rainfall === 0) return 0;
  if (rainfall === 1 || rainfall === 100) return 1;
  if (rainfall > 1 && rainfall <= 100) return rainfall / 100;
  if (rainfall > 100 && rainfall <= 1023) return Math.min(1, Math.max(0, 1 - rainfall / 1023));
  if (rainfall > 1023 && rainfall <= 4095) return Math.min(1, Math.max(0, 1 - rainfall / 4095));
  if (typeof rainDetected === 'boolean') return rainDetected ? 1 : 0;
  return 0;
}

export function estimatedMmPerHour(wetness) {
  const clamped = Math.min(1, Math.max(0, Number(wetness) || 0));
  return Number((FULL_WET_MM_PER_HOUR * clamped ** WETNESS_CURVE).toFixed(2));
}

export function interpretRainInput(body = {}) {
  const explicitDetected = body.rainDetected;
  const tipsRaw = body.rainTips;
  const mmPerTipRaw = body.mmPerTip;
  const rainfallRaw = body.rainfall;
  const wetnessRaw = body.wetness;

  let rainDetected = typeof explicitDetected === 'boolean' ? explicitDetected : undefined;
  let rainTips = tipsRaw === undefined ? undefined : Number(tipsRaw);
  if (rainTips !== undefined && Number.isNaN(rainTips)) rainTips = undefined;

  const mmPerTip = mmPerTipRaw === undefined ? DEFAULT_MM_PER_TIP : Number(mmPerTipRaw);
  const tipSize = Number.isNaN(mmPerTip) || mmPerTip <= 0 ? DEFAULT_MM_PER_TIP : mmPerTip;

  if (rainTips !== undefined && rainTips >= 0) {
    return {
      rainfall: rainTips * tipSize,
      rainDetected: rainDetected ?? rainTips > 0,
      rainTips,
      wetness: rainTips > 0 ? 1 : 0
    };
  }

  if (wetnessRaw !== undefined && !Number.isNaN(Number(wetnessRaw))) {
    const wetness = Math.min(1, Math.max(0, Number(wetnessRaw)));
    return {
      wetness,
      rainDetected: rainDetected ?? wetness >= 0.15,
      rainfall: estimatedMmPerHour(wetness),
      rainTips: undefined
    };
  }

  let rainfall = rainfallRaw === undefined ? undefined : Number(rainfallRaw);
  if (rainfall !== undefined && Number.isNaN(rainfall)) rainfall = undefined;

  if (rainfall === undefined && rainDetected === undefined) {
    return { rainfall: undefined, rainDetected: undefined, rainTips: undefined, wetness: undefined };
  }

  const wetness = wetnessFromRaw(rainfall, rainDetected);
  rainDetected = rainDetected ?? wetness >= 0.15;

  return {
    wetness,
    rainDetected,
    rainfall: estimatedMmPerHour(wetness),
    rainTips: undefined
  };
}

export { WETNESS_VALUES };
