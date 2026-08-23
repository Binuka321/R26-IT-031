interface StatusBadgeProps {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'info';
}

const toneClasses: Record<StatusBadgeProps['tone'], string> = {
  success: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/20',
  warning: 'bg-amber-500/15 text-amber-300 ring-amber-400/20',
  danger: 'bg-rose-500/15 text-rose-300 ring-rose-400/20',
  info: 'bg-cyan-500/15 text-cyan-300 ring-cyan-400/20'
};

export function StatusBadge({ label, tone }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ${toneClasses[tone]}`}>
      <span className="mr-2 h-2 w-2 rounded-full bg-current" />
      {label}
    </span>
  );
}
