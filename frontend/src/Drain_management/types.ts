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
  status: 'active' | 'inactive' | 'warning';
  lastUpdate: Date;
  currentReadings: {
    waterLevel?: number;
    flowRate?: number;
    rainfall?: number;
    turbidity?: number;
  };
}
