import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';

interface StatusCardProps {
  title: string;
  status: 'critical' | 'warning' | 'normal' | 'info';
  value?: string | number;
  description?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

const statusConfig = {
  critical: {
    bgGradient: 'from-red-900/20 to-red-800/10',
    borderColor: 'border-red-500/50',
    textColor: 'text-red-300',
    icon: AlertCircle,
  },
  warning: {
    bgGradient: 'from-amber-900/20 to-amber-800/10',
    borderColor: 'border-amber-500/50',
    textColor: 'text-amber-300',
    icon: AlertTriangle,
  },
  normal: {
    bgGradient: 'from-green-900/20 to-green-800/10',
    borderColor: 'border-green-500/50',
    textColor: 'text-green-300',
    icon: CheckCircle,
  },
  info: {
    bgGradient: 'from-blue-900/20 to-blue-800/10',
    borderColor: 'border-blue-500/50',
    textColor: 'text-blue-300',
    icon: Info,
  },
};

export const StatusCard: React.FC<StatusCardProps> = ({
  title,
  status,
  value,
  description,
  icon,
  onClick,
}) => {
  const config = statusConfig[status];
  const DefaultIcon = config.icon;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-br ${config.bgGradient} border ${config.borderColor} rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-${status === 'critical' ? 'red' : status === 'warning' ? 'amber' : status === 'normal' ? 'green' : 'blue'}-500/20`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={`text-sm font-semibold ${config.textColor} mb-2`}>{title}</p>
          {value && <p className="text-2xl font-bold text-white mb-1">{value}</p>}
          {description && <p className="text-xs text-gray-400">{description}</p>}
        </div>
        <div className={`${config.textColor} opacity-60`}>
          {icon || <DefaultIcon size={24} />}
        </div>
      </div>
    </motion.div>
  );
};

export default StatusCard;
