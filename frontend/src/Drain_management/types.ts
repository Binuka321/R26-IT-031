export interface SensorPackage {
  id: string;
  name: string;
  location: {
    name: string;
    basin?: string;
    river?: string;
    station?: string;
    latitude: number;
    longitude: number;
    address: string;
  };
  sensors: {
    ultrasonic: number;
    flow: number;
    rain: number;
    turbidity: number;
  };
  boards: {
    esp32: boolean;
    uno: boolean;
  };
  /** If false, device ingest is blocked server-side */
  ingestEnabled?: boolean;
  /** Required when ultrasonic sensor count > 0 */
  waterLevelSettings?: {
    unit: 'ft' | 'm';
    alertLevel: number;
    minorFloodLevel: number;
    majorFloodLevel: number;
  };
  status: 'active' | 'inactive' | 'warning';
  lastUpdate: Date;
  currentReadings: {
    waterLevel?: number;
    flowRate?: number;
    rainfall?: number;
    turbidity?: number;
  };
}

export interface SensorReading {
  id: string;
  packageId: string;
  timestamp: string;
  waterLevel?: number;
  unit: 'ft' | 'm';
  flowRate?: number;
  rainfall?: number;
  turbidity?: number;
}
