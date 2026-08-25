import React from "react";
import { createPortal } from "react-dom";

// Shared UI Components for Post-Flood System

// Stat Card
export const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: string;
  color: "cyan" | "purple" | "emerald" | "amber" | "rose" | "blue" | "indigo";
  subtitle?: string;
}> = ({ title, value, icon, color, subtitle }) => {
  const colors: Record<
    string,
    { border: string; bg: string; iconBg: string; iconText: string; accent: string }
  > = {
    cyan: {
      border: "border-cyan-400/35",
      bg: "bg-slate-900/80",
      iconBg: "bg-cyan-500/15",
      iconText: "text-cyan-200",
      accent: "bg-cyan-500",
    },
    purple: {
      border: "border-sky-400/35",
      bg: "bg-slate-900/80",
      iconBg: "bg-sky-500/15",
      iconText: "text-sky-200",
      accent: "bg-sky-500",
    },
    emerald: {
      border: "border-emerald-400/35",
      bg: "bg-slate-900/80",
      iconBg: "bg-emerald-500/15",
      iconText: "text-emerald-200",
      accent: "bg-emerald-500",
    },
    amber: {
      border: "border-amber-400/35",
      bg: "bg-slate-900/80",
      iconBg: "bg-amber-500/15",
      iconText: "text-amber-200",
      accent: "bg-amber-500",
    },
    rose: {
      border: "border-rose-400/35",
      bg: "bg-slate-900/80",
      iconBg: "bg-rose-500/15",
      iconText: "text-rose-200",
      accent: "bg-rose-500",
    },
    blue: {
      border: "border-blue-400/35",
      bg: "bg-slate-900/80",
      iconBg: "bg-blue-500/15",
      iconText: "text-blue-200",
      accent: "bg-blue-500",
    },
    indigo: {
      border: "border-teal-400/35",
      bg: "bg-slate-900/80",
      iconBg: "bg-teal-500/15",
      iconText: "text-teal-200",
      accent: "bg-teal-500",
    },
  };
  const c = colors[color];
  return (
    <div
      className={`pf-card relative overflow-hidden rounded-lg border ${c.border} ${c.bg} p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${c.accent}`} />
    <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 pr-2">
          <p className="mb-1 truncate text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
        </div>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${c.iconBg}`}>
          <span className={`material-icons ${c.iconText}`}>{icon}</span>
        </div>
      </div>
    </div>
  );
};

// Priority Badge
export const PriorityBadge: React.FC<{ level: string }> = ({ level }) => {
  const config: Record<string, string> = {
    Emergency: "bg-rose-700 text-white",
    Critical: "bg-gradient-to-r from-rose-500 to-red-600 text-white",
    High: "bg-gradient-to-r from-rose-500 to-pink-600 text-white",
    Medium: "bg-amber-50 text-amber-700 border border-amber-300",
    Low: "bg-emerald-50 text-emerald-700 border border-emerald-300",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold ${config[level] || "bg-slate-700 text-slate-200"}`}
    >
      <span className="material-icons text-xs">
        {level === "High"
          ? "warning"
          : level === "Critical" || level === "Emergency"
            ? "emergency"
          : level === "Medium"
            ? "priority_high"
            : "check_circle"}
      </span>
      {level}
    </span>
  );
};

// Urgency Score Bar — continuous 0-100 gradient bar
export const UrgencyScoreBar: React.FC<{
  score: number;
  showLabel?: boolean;
  height?: string;
}> = ({ score, showLabel = true, height = "h-3" }) => {
  const clamped = Math.max(0, Math.min(100, score));
  const getColor = (s: number) => {
    if (s >= 70) return "from-rose-500 to-red-600";
    if (s >= 45) return "from-amber-400 to-orange-500";
    return "from-emerald-400 to-teal-500";
  };
  const getLabel = (s: number) => {
    if (s >= 70) return { text: "Critical", cls: "text-rose-500" };
    if (s >= 45) return { text: "Moderate", cls: "text-amber-500" };
    return { text: "Stable", cls: "text-emerald-500" };
  };
  const label = getLabel(clamped);
  return (
    <div className="w-full">
      <div className={`relative w-full ${height} overflow-hidden rounded-full bg-slate-700`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${getColor(clamped)} transition-all duration-700 ease-out`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 flex items-center justify-between">
          <span className={`text-xs font-bold ${label.cls}`}>{label.text}</span>
          <span className="text-xs font-bold text-slate-500">{clamped}/100</span>
        </div>
      )}
    </div>
  );
};

// Urgency Rank Badge — show camp's rank number
export const UrgencyRankBadge: React.FC<{ rank: number }> = ({ rank }) => {
  const colors =
    rank === 1
      ? "bg-rose-600 text-white shadow-rose-200 shadow-md"
      : rank === 2
        ? "bg-orange-500 text-white shadow-orange-200 shadow"
        : rank === 3
          ? "bg-amber-500 text-white"
          : "bg-slate-700 text-slate-200";
  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${colors}`}
    >
      #{rank}
    </span>
  );
};

// Status Badge
export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config: Record<string, { cls: string; icon: string }> = {
    Pending: {
      cls: "bg-amber-50 text-amber-700 border border-amber-300",
      icon: "schedule",
    },
    Unassigned: {
      cls: "bg-slate-700 text-slate-200 border border-slate-600",
      icon: "person_off",
    },
    Assigned: {
      cls: "bg-blue-50 text-blue-700 border border-blue-300",
      icon: "assignment_ind",
    },
    "En Route": {
      cls: "bg-cyan-50 text-cyan-700 border border-cyan-300",
      icon: "directions_car",
    },
    Rescuing: {
      cls: "bg-amber-50 text-amber-700 border border-amber-300",
      icon: "emergency_share",
    },
    Rescued: {
      cls: "bg-emerald-50 text-emerald-700 border border-emerald-300",
      icon: "health_and_safety",
    },
    Closed: {
      cls: "bg-slate-700 text-white border border-slate-600",
      icon: "task_alt",
    },
    "On the Way": {
      cls: "bg-blue-50 text-blue-700 border border-blue-300",
      icon: "local_shipping",
    },
    Delivered: {
      cls: "bg-emerald-50 text-emerald-700 border border-emerald-300",
      icon: "check_circle",
    },
    Failed: {
      cls: "bg-rose-50 text-rose-700 border border-rose-300",
      icon: "cancel",
    },
    Active: {
      cls: "bg-emerald-50 text-emerald-700 border border-emerald-300",
      icon: "check_circle",
    },
    Inactive: {
      cls: "bg-slate-700 text-slate-200 border border-slate-600",
      icon: "pause_circle",
    },
    Safe: {
      cls: "bg-emerald-50 text-emerald-700 border border-emerald-300",
      icon: "verified_user",
    },
    "At Risk": {
      cls: "bg-amber-50 text-amber-700 border border-amber-300",
      icon: "warning",
    },
    Compromised: {
      cls: "bg-rose-50 text-rose-700 border border-rose-300",
      icon: "dangerous",
    },
  };
  const c = config[status] || {
    cls: "bg-slate-700 text-slate-200",
    icon: "info",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${c.cls}`}>
      <span className="material-icons text-xs">{c.icon}</span>
      {status}
    </span>
  );
};

// Modal
export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}> = ({ isOpen, onClose, title, children, size = "md" }) => {
  React.useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return;
  }, [isOpen]);

  if (!isOpen) return null;
  const sizes = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
  };

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`pf-modal max-h-[90vh] w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl ${sizes[size]}`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 1200 }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700 bg-slate-900 px-5 py-4">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <span className="material-icons text-slate-400">close</span>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

// Search Filter Bar
export const SearchFilter: React.FC<{
  searchTerm: string;
  onSearch: (v: string) => void;
  placeholder?: string;
  children?: React.ReactNode;
}> = ({ searchTerm, onSearch, placeholder = "Search...", children }) => (
  <div className="pf-search-filter mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/80 p-3 shadow-sm">
    <div className="relative min-w-full flex-1 sm:min-w-[200px]">
      <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
        search
      </span>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-600 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25"
      />
    </div>
    {children}
  </div>
);

// Loading Spinner
export const Loading: React.FC<{ message?: string }> = ({
  message = "Loading...",
}) => (
  <div className="flex flex-col items-center justify-center py-20">
    <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-cyan-500/20 border-t-cyan-400"></div>
    <p className="text-slate-300 text-sm">{message}</p>
  </div>
);

// Empty State
export const EmptyState: React.FC<{
  icon: string;
  title: string;
  subtitle?: string;
}> = ({ icon, title, subtitle }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <span className="material-icons mb-4 text-6xl text-slate-500">{icon}</span>
    <h3 className="mb-1 text-lg font-semibold text-slate-200">{title}</h3>
    {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
  </div>
);

// Form Error Summary
export const FormErrorSummary: React.FC<{
  message?: string;
  errors?: Record<string, string>;
}> = ({ message, errors = {} }) => {
  const errorList = Object.values(errors).filter(Boolean);
  if (!message && errorList.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-rose-400/40 bg-rose-500/10 p-4 text-rose-100">
      <div className="flex items-start gap-3">
        <span className="material-icons text-rose-500">error</span>
        <div>
          <p className="text-sm font-bold">
            {message || "Please fix the highlighted fields before saving."}
          </p>
          {errorList.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs space-y-1">
              {errorList.map((error, index) => (
                <li key={`${error}-${index}`}>{error}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

// Page Header
export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  icon: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, icon, actions }) => (
  <div className="pf-page-header mb-6 flex flex-col justify-between gap-4 rounded-lg border border-slate-700 bg-slate-900/80 p-4 shadow-sm sm:p-5 md:flex-row md:items-center">
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid h-12 w-12 place-items-center rounded-lg bg-cyan-500/15 text-cyan-200 shadow-sm">
        <span className="material-icons">{icon}</span>
      </div>
      <div>
        <h1 className="text-xl font-bold text-white sm:text-2xl">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
      </div>
    </div>
    {actions && (
      <div className="flex flex-wrap gap-2">{actions}</div>
    )}
  </div>
);

// Primary Button
export const PrimaryButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  icon?: string;
  disabled?: boolean;
  className?: string;
}> = ({ onClick, children, icon, disabled, className = "" }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`pf-primary-button flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 font-medium text-white shadow-sm transition-all hover:bg-cyan-700 hover:shadow disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
  >
    {icon && <span className="material-icons text-lg">{icon}</span>}
    {children}
  </button>
);

// Secondary Button
export const SecondaryButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  icon?: string;
  className?: string;
}> = ({ onClick, children, icon, className = "" }) => (
  <button
    onClick={onClick}
    className={`pf-secondary-button flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 font-medium text-slate-100 shadow-sm transition-all hover:bg-slate-700 hover:shadow ${className}`}
  >
    {icon && <span className="material-icons text-lg">{icon}</span>}
    {children}
  </button>
);

// Danger Button
export const DangerButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  icon?: string;
}> = ({ onClick, children, icon }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 font-medium text-white shadow-sm transition-all hover:bg-rose-700"
  >
    {icon && <span className="material-icons text-lg">{icon}</span>}
    {children}
  </button>
);

// Form Input
export const FormInput: React.FC<{
  label: string;
  value: string | number;
  onChange: (v: any) => void;
  placeholder?: string;
  required?: boolean;
  min?: number;
  error?: string;
  type?: string;
}> = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  min,
  error,
}) => (
  <div>
      <label className="pf-field-label block text-sm font-medium text-slate-700 mb-1">
      {label}
      {required && <span className="text-rose-500">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) =>
        onChange(type === "number" ? Number(e.target.value) : e.target.value)
      }
      placeholder={placeholder}
      required={required}
      min={min}
        className={`pf-field-control w-full rounded-lg border px-4 py-2.5 ${
          error ? "border-rose-500 focus:ring-rose-500/25" : "border-slate-300 focus:ring-cyan-500/25"
        } focus:border-cyan-400 outline-none transition-all bg-white text-slate-900 placeholder:text-slate-400`}
    />
    {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
  </div>
);

// Form Select
export const FormSelect: React.FC<{
  label: string;
  value: string;
   onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  error?: string;
}> = ({ label, value, onChange, options, required, error }) => (
  <div>
      <label className="pf-field-label block text-sm font-medium text-slate-700 mb-1">
      {label}
      {required && <span className="text-rose-500">*</span>}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
        className={`pf-field-control w-full rounded-lg border px-4 py-2.5 ${
          error ? "border-rose-500 focus:ring-rose-500/25" : "border-slate-300 focus:ring-cyan-500/25"
        } focus:border-cyan-400 outline-none transition-all bg-white text-slate-900`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
  </div>
);
