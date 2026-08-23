import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Map, Grid2x2, Layers } from 'lucide-react';
// @ts-ignore
import FloodMapApp from '../../FloodMap/FloodMapApp';

interface MapContainerProps {
  authToken: string;
  isExpanded?: boolean;
}

export const MapContainer: React.FC<MapContainerProps> = ({
  authToken,
  isExpanded = false,
}) => {
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [mapMode, setMapMode] = useState<'heatmap' | 'sensors' | 'predictions'>('heatmap');
  const [layersVisible, setLayersVisible] = useState({
    sensors: true,
    predictions: true,
    heatmap: true,
    districts: true,
  });

  if (showFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full h-full"
        >
          <FloodMapApp
            authToken={authToken}
            onBack={() => setShowFullscreen(false)}
          />
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden flex flex-col h-full"
    >
      {/* Map Toolbar */}
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between bg-slate-900/80">
        <div className="flex items-center gap-2">
          <Map size={20} className="text-cyan-400" />
          <h3 className="font-semibold text-white">Flood Risk Visualization</h3>
        </div>

        <div className="flex items-center gap-3">
          {/* Map Mode Selector */}
          <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setMapMode('heatmap')}
              className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
                mapMode === 'heatmap'
                  ? 'bg-cyan-600/40 text-cyan-200 border border-cyan-500/50'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Heatmap
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setMapMode('sensors')}
              className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
                mapMode === 'sensors'
                  ? 'bg-cyan-600/40 text-cyan-200 border border-cyan-500/50'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sensors
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setMapMode('predictions')}
              className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
                mapMode === 'predictions'
                  ? 'bg-cyan-600/40 text-cyan-200 border border-cyan-500/50'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              ML Predictions
            </motion.button>
          </div>

          {/* Layers Toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setLayersVisible(!layersVisible.heatmap)}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            title="Toggle layers"
          >
            <Layers size={18} className="text-gray-400 hover:text-cyan-400" />
          </motion.button>

          {/* Fullscreen Toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowFullscreen(true)}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            title="Fullscreen"
          >
            <Grid2x2 size={18} className="text-gray-400 hover:text-cyan-400" />
          </motion.button>
        </div>
      </div>

      {/* Map Content */}
      <div className="flex-1 overflow-hidden bg-slate-950/50">
        <motion.div
          key={`${mapMode}-${layersVisible.heatmap}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full h-full"
        >
          <FloodMapApp authToken={authToken} onBack={() => {}} />
        </motion.div>
      </div>

      {/* Map Info Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="px-4 py-2 border-t border-slate-700/50 bg-slate-900/80 text-xs text-gray-400"
      >
        <div className="flex items-center justify-between">
          <span>Mode: {mapMode.charAt(0).toUpperCase() + mapMode.slice(1)}</span>
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MapContainer;
