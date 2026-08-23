import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: 'blue' | 'emerald' | 'amber' | 'rose' | 'violet';
}

const toneClasses: Record<MetricCardProps['tone'], string> = {
  blue: 'from-cyan-500/20 to-blue-500/10 text-cyan-200 ring-cyan-400/20',
  emerald: 'from-emerald-500/20 to-teal-500/10 text-emerald-200 ring-emerald-400/20',
  amber: 'from-amber-500/20 to-orange-500/10 text-amber-200 ring-amber-400/20',
  rose: 'from-rose-500/20 to-red-500/10 text-rose-200 ring-rose-400/20',
  violet: 'from-violet-500/20 to-fuchsia-500/10 text-violet-200 ring-violet-400/20'
};

export function MetricCard({ label, value, detail, icon: Icon, tone }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`rounded-2xl border border-white/10 bg-gradient-to-br ${toneClasses[tone]} p-5 shadow-[0_20px_80px_rgba(15,23,42,0.25)] ring-1`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-300">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
          <p className="mt-2 text-sm text-slate-400">{detail}</p>
        </div>
        <div className="rounded-xl bg-slate-950/50 p-2.5">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}
