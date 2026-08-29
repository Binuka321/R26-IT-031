import { useState, useCallback } from 'react';

interface PredictionResult {
  prediction_label?: string;
  confidence?: number;
  floodDepth?: number;
  riskScore?: number;
  severity?: string;
}

interface UsePredictionReturn {
  result: PredictionResult | null;
  loading: boolean;
  error: string | null;
  predict: (features: Record<string, any>) => Promise<PredictionResult | null>;
  reset: () => void;
}

/**
 * Custom hook for managing ML flood predictions
 * Handles prediction requests and result management
 */
const ML_API_BASE = import.meta.env.VITE_ML_API_URL || 'http://localhost:5000/api';

export const usePrediction = (): UsePredictionReturn => {
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const predict = useCallback(async (features: Record<string, any>): Promise<PredictionResult | null> => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${ML_API_BASE}/ml/prediction/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const resultData = data.data || data;

      setResult(resultData);
      return resultData;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Prediction request failed';
      setError(message);
      console.error('Prediction error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    result,
    loading,
    error,
    predict,
    reset,
  };
};

export default usePrediction;
