import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Activity, Gauge } from 'lucide-react';

interface PredictionResult {
  prediction_label?: string;
  confidence?: number;
  floodDepth?: number;
  riskScore?: number;
  severity?: string;
}

interface PredictionPanelProps {
  authToken: string;
  onPredictionResult?: (result: PredictionResult) => void;
  loading?: boolean;
}

const DISTRICT_COORDS = {
  Colombo: [6.9271, 79.8612],
  Gampaha: [7.0917, 79.9997],
  Kalutara: [6.5854, 79.9607],
  Kandy: [7.2906, 80.6337],
  Matara: [5.9549, 80.5550],
  Galle: [6.0535, 80.2210],
  Ratnapura: [6.6828, 80.3992],
  Kegalle: [7.2513, 80.3464],
  Kurunegala: [7.4863, 80.3647],
  Puttalam: [8.0362, 79.8283],
  Matale: [7.4675, 80.6234],
  'Nuwara Eliya': [6.9497, 80.7891],
  Badulla: [6.9895, 81.0550],
  Moneragala: [6.8728, 81.3507],
  Ampara: [7.2975, 81.6820],
  Batticaloa: [7.7102, 81.6924],
  Trincomalee: [8.5874, 81.2152],
  Jaffna: [9.6615, 80.0255],
  'Mullaitivu': [9.2671, 80.8142],
  Vavuniya: [8.7514, 80.4971],
  Anuradhapura: [8.3114, 80.4037],
  Polonnaruwa: [7.9403, 81.0188],
  Kilinochchi: [9.3803, 80.3770],
  Mannar: [8.9800, 79.9040],
  Hambantota: [6.1241, 81.1185],
};

export const PredictionPanel: React.FC<PredictionPanelProps> = ({
  authToken,
  onPredictionResult,
  loading = false,
}) => {
  const [selectedDistrict, setSelectedDistrict] = useState('Colombo');
  const [rainfall, setRainfall] = useState(30);
  const [waterLevel, setWaterLevel] = useState(2.5);
  const [humidity, setHumidity] = useState(75);
  const [predictionDate, setPredictionDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [period, setPeriod] = useState('Any');
  const [predicting, setPredicting] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePredict = async () => {
    setError(null);
    setPredicting(true);

    try {
      const coords = DISTRICT_COORDS[selectedDistrict as keyof typeof DISTRICT_COORDS] || [
        6.9271, 79.8612,
      ];

      const response = await fetch('http://localhost:5000/api/ml/prediction/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          features: {
            rainfall: Number(rainfall),
            latitude: coords[0],
            longitude: coords[1],
            elevation: 0,
            elevation_m: 0,
            water_level: Number(waterLevel),
            humidity: Number(humidity),
            date: predictionDate,
            period: period || 'Any',
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Prediction failed');
      }

      const resultData = data.data || data;
      setResult(resultData);
      onPredictionResult?.(resultData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prediction error');
    } finally {
      setPredicting(false);
    }
  };

  const getPredictionColor = () => {
    if (!result) return 'gray';
    const label = result.prediction_label?.toLowerCase() || '';
    if (label.includes('high')) return 'red';
    if (label.includes('moderate')) return 'amber';
    return 'green';
  };

  const colorMap = {
    red: 'from-red-900/30 to-red-800/10 border-red-500/50',
    amber: 'from-amber-900/30 to-amber-800/10 border-amber-500/50',
    green: 'from-green-900/30 to-green-800/10 border-green-500/50',
    gray: 'from-slate-900/30 to-slate-800/10 border-slate-500/50',
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">ML Flood Prediction</h3>

      <div className="grid gap-3">
        {/* District Selection */}
        <div>
          <label className="text-sm text-gray-400 mb-1 block">Location</label>
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:border-cyan-500 focus:outline-none"
          >
            {Object.keys(DISTRICT_COORDS).map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
        </div>

        {/* Input Controls */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Rainfall (mm)</label>
            <input
              type="number"
              value={rainfall}
              onChange={(e) => setRainfall(Number(e.target.value))}
              className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Water Level (m)</label>
            <input
              type="number"
              value={waterLevel}
              onChange={(e) => setWaterLevel(Number(e.target.value))}
              step="0.1"
              className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Humidity (%)</label>
            <input
              type="number"
              value={humidity}
              onChange={(e) => setHumidity(Number(e.target.value))}
              max="100"
              className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:border-cyan-500 focus:outline-none"
            >
              <option>Any</option>
              <option>Morning</option>
              <option>Afternoon</option>
              <option>Evening</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Prediction Date</label>
          <input
            type="date"
            value={predictionDate}
            onChange={(e) => setPredictionDate(e.target.value)}
            className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Predict Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handlePredict}
          disabled={predicting || loading}
          className="w-full py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 rounded text-white font-semibold flex items-center justify-center gap-2"
        >
          <Zap size={16} />
          {predicting ? 'Predicting...' : 'Run Prediction'}
        </motion.button>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-red-900/30 border border-red-500/50 rounded p-3 text-sm text-red-300"
          >
            {error}
          </motion.div>
        )}

        {/* Result Display */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-gradient-to-br ${colorMap[getPredictionColor() as keyof typeof colorMap]} border rounded-lg p-4`}
          >
            <div className="flex items-center gap-2 mb-3">
              <Activity
                size={18}
                className={`text-${getPredictionColor()}-400`}
              />
              <h4 className="font-semibold text-white">Prediction Result</h4>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Risk Level:</span>
                <span className="text-white font-semibold">
                  {result.prediction_label || result.severity || 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Confidence:</span>
                <span className="text-white font-semibold">
                  {((result.confidence || 0) * 100).toFixed(1)}%
                </span>
              </div>
              {result.floodDepth !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Est. Flood Depth:</span>
                  <span className="text-white font-semibold">
                    {result.floodDepth.toFixed(2)} m
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default PredictionPanel;
