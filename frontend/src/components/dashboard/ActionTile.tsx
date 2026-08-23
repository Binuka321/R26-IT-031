import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface ActionTileProps {
  title: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
  accent: 'cyan' | 'emerald' | 'amber' | 'violet';
}

const accentClasses: Record<ActionTileProps['accent'], string> = {
  cyan: 'from-cyan-500/20 to-blue-500/10 hover:border-cyan-400/30',
  emerald: 'from-emerald-500/20 to-teal-500/10 hover:border-emerald-400/30',
  amber: 'from-amber-500/20 to-orange-500/10 hover:border-amber-400/30',
  violet: 'from-violet-500/20 to-fuchsia-500/10 hover:border-violet-400/30'
};

export function ActionTile({ title, description, icon: Icon, onClick, accent }: ActionTileProps) {
  return (
    <motion.button
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`rounded-2xl border border-white/10 bg-gradient-to-br ${accentClasses[accent]} p-4 text-left shadow-[0_20px_80px_rgba(15,23,42,0.2)]`}
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950/50">
        <Icon className="h-5 w-5 text-white" />
      </div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </motion.button>
  );
}
