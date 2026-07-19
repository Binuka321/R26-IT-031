import type { SensorPackage } from './types';

export type FloodRiskLevel =
  | 'Normal'
  | 'Alert'
  | 'Minor flood'
  | 'Major flood'
  | 'High Risk'
  | 'Medium Risk'
  | 'Low Risk'
  | 'Unknown';

export type FloodRiskSeverity = 'critical' | 'warning' | 'normal' | 'unknown';

export interface FloodRiskEvaluation {
  level: FloodRiskLevel;
  severity: FloodRiskSeverity;
  message: string;
  waterLevel?: number;
  unit: 'ft' | 'm';
  thresholdLabel?: string;
  thresholdValue?: number;
  color: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
}

const SEVERITY_RANK: Record<FloodRiskSeverity, number> = {
  unknown: 0,
  normal: 1,
  warning: 2,
  critical: 3
};

const LEVEL_RANK: Record<FloodRiskLevel, number> = {
  Unknown: 0,
  Normal: 1,
  'Low Risk': 2,
  Alert: 3,
  'Medium Risk': 4,
  'Minor flood': 5,
  'High Risk': 6,
  'Major flood': 7
};

export function evaluatePackageRisk(
  readings: SensorPackage['currentReadings'] | undefined,
  waterLevelSettings?: SensorPackage['waterLevelSettings']
): FloodRiskEvaluation {
  const unit = waterLevelSettings?.unit ?? 'm';
  const waterLevel = readings?.waterLevel;

  if (waterLevel === undefined || Number.isNaN(waterLevel)) {
    return {
      level: 'Unknown',
      severity: 'unknown',
      message: 'No water level data available.',
      unit,
      color: 'gray',
      borderColor: 'border-gray-300',
      bgColor: 'bg-gray-50',
      textColor: 'text-gray-700'
    };
  }

  const wl = waterLevelSettings;
  if (wl) {
    if (waterLevel >= wl.majorFloodLevel) {
      return {
        level: 'Major flood',
        severity: 'critical',
        message: 'Water level has exceeded the major flood threshold. Immediate action recommended.',
        waterLevel,
        unit: wl.unit,
        thresholdLabel: 'Major flood level',
        thresholdValue: wl.majorFloodLevel,
        color: 'red',
        borderColor: 'border-red-500',
        bgColor: 'bg-red-50',
        textColor: 'text-red-900'
      };
    }
    if (waterLevel >= wl.minorFloodLevel) {
      return {
        level: 'Minor flood',
        severity: 'warning',
        message: 'Water level has reached minor flood conditions. Continue monitoring closely.',
        waterLevel,
        unit: wl.unit,
        thresholdLabel: 'Minor flood level',
        thresholdValue: wl.minorFloodLevel,
        color: 'orange',
        borderColor: 'border-orange-500',
        bgColor: 'bg-orange-50',
        textColor: 'text-orange-900'
      };
    }
    if (waterLevel >= wl.alertLevel) {
      return {
        level: 'Alert',
        severity: 'warning',
        message: 'Water level has reached the configured alert threshold.',
        waterLevel,
        unit: wl.unit,
        thresholdLabel: 'Alert level',
        thresholdValue: wl.alertLevel,
        color: 'amber',
        borderColor: 'border-amber-500',
        bgColor: 'bg-amber-50',
        textColor: 'text-amber-900'
      };
    }
    return {
      level: 'Normal',
      severity: 'normal',
      message: 'Water level is within normal range.',
      waterLevel,
      unit: wl.unit,
      color: 'green',
      borderColor: 'border-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-800'
    };
  }

  if (waterLevel > 3.5) {
    return {
      level: 'High Risk',
      severity: 'critical',
      message: 'Water level indicates high flood risk.',
      waterLevel,
      unit,
      thresholdLabel: 'High risk threshold',
      thresholdValue: 3.5,
      color: 'red',
      borderColor: 'border-red-500',
      bgColor: 'bg-red-50',
      textColor: 'text-red-900'
    };
  }
  if (waterLevel > 2.5) {
    return {
      level: 'Medium Risk',
      severity: 'warning',
      message: 'Water level indicates elevated flood risk.',
      waterLevel,
      unit,
      thresholdLabel: 'Medium risk threshold',
      thresholdValue: 2.5,
      color: 'orange',
      borderColor: 'border-orange-500',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-900'
    };
  }
  return {
    level: 'Low Risk',
    severity: 'normal',
    message: 'Water level is within low risk range.',
    waterLevel,
    unit,
    color: 'green',
    borderColor: 'border-green-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-800'
  };
}

export interface PackageFloodAlert {
  package: SensorPackage;
  risk: FloodRiskEvaluation;
}

const MAP_FLOOD_LEVELS = new Set<FloodRiskLevel>([
  'Minor flood',
  'Major flood',
  'Medium Risk',
  'High Risk'
]);

export function getPackageFloodAlerts(packages: SensorPackage[]): PackageFloodAlert[] {
  return packages
    .map((pkg) => ({
      package: pkg,
      risk: evaluatePackageRisk(pkg.currentReadings, pkg.waterLevelSettings)
    }))
    .filter(
      ({ package: pkg, risk }) =>
        pkg.ingestEnabled !== false &&
        (risk.severity === 'critical' || risk.severity === 'warning')
    )
    .sort((a, b) => {
      const severityDiff = SEVERITY_RANK[b.risk.severity] - SEVERITY_RANK[a.risk.severity];
      if (severityDiff !== 0) return severityDiff;
      return LEVEL_RANK[b.risk.level] - LEVEL_RANK[a.risk.level];
    });
}

/** Minor/major flood detections only — used for map circles (excludes alert-level warnings). */
export function getMapFloodAlerts(packages: SensorPackage[]): PackageFloodAlert[] {
  return packages
    .map((pkg) => ({
      package: pkg,
      risk: evaluatePackageRisk(pkg.currentReadings, pkg.waterLevelSettings)
    }))
    .filter(
      ({ package: pkg, risk }) => pkg.ingestEnabled !== false && MAP_FLOOD_LEVELS.has(risk.level)
    )
    .sort((a, b) => {
      const severityDiff = SEVERITY_RANK[b.risk.severity] - SEVERITY_RANK[a.risk.severity];
      if (severityDiff !== 0) return severityDiff;
      return LEVEL_RANK[b.risk.level] - LEVEL_RANK[a.risk.level];
    });
}

export function getAggregateFloodRisk(packages: SensorPackage[]): {
  label: string;
  className: string;
} {
  const alerts = getPackageFloodAlerts(packages);
  if (alerts.some((a) => a.risk.severity === 'critical')) {
    return { label: 'Critical', className: 'text-red-600' };
  }
  if (alerts.some((a) => a.risk.severity === 'warning')) {
    return { label: 'Elevated', className: 'text-orange-600' };
  }
  const hasData = packages.some((p) => p.currentReadings?.waterLevel !== undefined);
  if (hasData) {
    return { label: 'Normal', className: 'text-green-600' };
  }
  return { label: 'No Data', className: 'text-gray-500' };
}

export function formatCoordinates(latitude: number, longitude: number): string {
  const latSuffix = latitude >= 0 ? 'N' : 'S';
  const lngSuffix = longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(latitude).toFixed(4)}°${latSuffix}, ${Math.abs(longitude).toFixed(4)}°${lngSuffix}`;
}
