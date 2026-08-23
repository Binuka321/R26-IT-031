import { motion } from 'framer-motion';
import { BellRing, ChevronRight } from 'lucide-react';

interface AlertFeedProps {
  items: Array<{ title: string; detail: string; time: string; tone: 'success' | 'warning' | 'danger' | 'info' }>;
}

const toneClasses: Record<AlertFeedProps['items'][number]['tone'], string> = {
  success: 'border-emerald-400/20 bg-emerald-500/10',
  warning: 'border-amber-400/20 bg-amber-500/10',
  danger: 'border-rose-400/20 bg-rose-500/10',
  info: 'border-cyan-400/20 bg-cyan-500/10'
};

export function AlertFeed({ items }: AlertFeedProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 shadow-[0_20px_80px_rgba(15,23,42,0.25)]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BellRing className="h-4 w-4 text-cyan-300" />
          <h3 className="text-sm font-semibold text-white">Mission updates</h3>
        </div>
        <button className="text-sm text-slate-400 transition hover:text-white">View all</button>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-3 ${toneClasses[item.tone]}`}
          >
            <div>
              <p className="text-sm font-medium text-white">{item.title}</p>
              <p className="mt-1 text-sm text-slate-400">{item.detail}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{item.time}</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
