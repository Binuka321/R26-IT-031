import React from 'react';
import { motion } from 'framer-motion';
import { Zap, MapPin, Users, Settings } from 'lucide-react';
import BrandLogo from '../BrandLogo';

interface HeaderProps {
  title?: string;
  status?: 'active' | 'warning' | 'critical';
  userRole?: string;
  onLogout?: () => void;
}

const statusConfig = {
  active: { color: 'from-green-600/30 to-green-500/10 border-green-500/50', label: 'System Active' },
  warning: { color: 'from-amber-600/30 to-amber-500/10 border-amber-500/50', label: 'System Warning' },
  critical: { color: 'from-red-600/30 to-red-500/10 border-red-500/50', label: 'Critical Alert' },
};

export const OperationsHeader: React.FC<HeaderProps> = ({
  title = 'Emergency Operations Center',
  status = 'active',
  userRole = 'Operator',
  onLogout,
}) => {
  const config = statusConfig[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-r ${config.color} border-b border-slate-700 px-6 py-4`}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left Section - Title & Status */}
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-3">
            <BrandLogo compact surface="light" markClassName="hidden h-14 w-44 sm:block" />
            <div className="p-2 bg-cyan-600/20 border border-cyan-500/50 rounded-lg">
              <Zap size={24} className="text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{title}</h1>
              <p className="text-sm text-gray-400">Real-time flood monitoring & response</p>
            </div>
          </div>
        </div>

        {/* Center Section - Status Info */}
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-sm text-gray-300">{config.label}</span>
        </div>

        {/* Right Section - User & Actions */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-semibold text-white">{userRole}</p>
            <p className="text-xs text-gray-400">{new Date().toLocaleTimeString()}</p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings size={20} className="text-gray-400 hover:text-white" />
            </motion.button>
            {onLogout && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onLogout}
                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 rounded text-sm text-red-300 font-semibold transition-colors"
              >
                Logout
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default OperationsHeader;
