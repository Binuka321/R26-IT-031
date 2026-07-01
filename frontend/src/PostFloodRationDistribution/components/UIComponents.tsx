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
      border: "border-cyan-200",
      bg: "bg-white",
      iconBg: "bg-cyan-100",
      iconText: "text-cyan-600",
      accent: "bg-cyan-500",
    },
    purple: {
      border: "border-violet-200",
      bg: "bg-white",
      iconBg: "bg-purple-100",
      iconText: "text-purple-600",
      accent: "bg-violet-500",
    },
    emerald: {
      border: "border-emerald-200",
      bg: "bg-white",
      iconBg: "bg-emerald-100",
      iconText: "text-emerald-600",
      accent: "bg-emerald-500",
    },
    amber: {
      border: "border-amber-200",
      bg: "bg-white",
      iconBg: "bg-amber-100",
      iconText: "text-amber-600",
      accent: "bg-amber-500",
    },
    rose: {
      border: "border-rose-200",
      bg: "bg-white",
      iconBg: "bg-rose-100",
      iconText: "text-rose-600",
      accent: "bg-rose-500",
    },
    blue: {
      border: "border-blue-200",
      bg: "bg-white",
      iconBg: "bg-blue-100",
      iconText: "text-blue-600",
      accent: "bg-blue-500",
    },
    indigo: {
      border: "border-indigo-200",
      bg: "bg-white",
      iconBg: "bg-indigo-100",
      iconText: "text-indigo-600",
      accent: "bg-indigo-500",
    },
  };
  const c = colors[color];
  return (
    <div
      className={`relative overflow-hidden rounded-lg border ${c.border} ${c.bg} p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${c.accent}`} />
      <div className="flex items-center justify-between">
        <div className="min-w-0 pr-3">
          <p className="mb-1 truncate text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
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
    High: "bg-gradient-to-r from-rose-500 to-pink-600 text-white",
    Medium: "bg-amber-100 text-amber-800 border border-amber-200",
    Low: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold ${config[level] || "bg-gray-100 text-gray-600"}`}
    >
      <span className="material-icons text-xs">
        {level === "High"
          ? "warning"
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
    if (s >= 70) return { text: "Critical", cls: "text-rose-600" };
    if (s >= 45) return { text: "Moderate", cls: "text-amber-600" };
    return { text: "Stable", cls: "text-emerald-600" };
  };
  const label = getLabel(clamped);
  return (
    <div className="w-full">
      <div className={`relative w-full ${height} overflow-hidden rounded-full bg-slate-100`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${getColor(clamped)} transition-all duration-700 ease-out`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 flex items-center justify-between">
          <span className={`text-xs font-bold ${label.cls}`}>{label.text}</span>
          <span className="text-xs font-bold text-slate-700">{clamped}/100</span>
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
          : "bg-slate-100 text-slate-600";
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
      cls: "bg-amber-100 text-amber-800 border border-amber-200",
      icon: "schedule",
    },
    "On the Way": {
      cls: "bg-blue-100 text-blue-800 border border-blue-200",
      icon: "local_shipping",
    },
    Delivered: {
      cls: "bg-emerald-100 text-emerald-800 border border-emerald-200",
      icon: "check_circle",
    },
    Failed: {
      cls: "bg-rose-100 text-rose-800 border border-rose-200",
      icon: "cancel",
    },
    Active: {
      cls: "bg-emerald-100 text-emerald-800 border border-emerald-200",
      icon: "check_circle",
    },
    Inactive: {
      cls: "bg-gray-100 text-gray-600 border border-gray-200",
      icon: "pause_circle",
    },
    Safe: {
      cls: "bg-emerald-100 text-emerald-800 border border-emerald-200",
      icon: "verified_user",
    },
    "At Risk": {
      cls: "bg-amber-100 text-amber-800 border border-amber-200",
      icon: "warning",
    },
    Compromised: {
      cls: "bg-rose-100 text-rose-800 border border-rose-200",
      icon: "dangerous",
    },
  };
  const c = config[status] || {
    cls: "bg-gray-100 text-gray-600",
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
        className={`max-h-[90vh] w-full overflow-y-auto rounded-lg bg-white shadow-2xl ${sizes[size]}`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 1200 }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
          >
            <span className="material-icons text-gray-400">close</span>
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
  <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
    <div className="relative flex-1 min-w-[200px]">
      <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
        search
      </span>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100"
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
    <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-cyan-100 border-t-cyan-600"></div>
    <p className="text-gray-500 text-sm">{message}</p>
  </div>
);

// Empty State
export const EmptyState: React.FC<{
  icon: string;
  title: string;
  subtitle?: string;
}> = ({ icon, title, subtitle }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <span className="material-icons mb-4 text-6xl text-gray-300">{icon}</span>
    <h3 className="mb-1 text-lg font-semibold text-gray-600">{title}</h3>
    {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
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
    <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800">
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
  <div className="mb-6 flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center">
    <div className="flex items-center gap-3">
      <div className="grid h-12 w-12 place-items-center rounded-lg bg-slate-900 text-white shadow-sm">
        <span className="material-icons">{icon}</span>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
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
    className={`flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 font-medium text-white shadow-sm transition-all hover:bg-cyan-700 hover:shadow disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
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
    className={`flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow ${className}`}
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
    <label className="block text-sm font-medium text-gray-700 mb-1">
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
      className={`w-full rounded-lg border px-4 py-2.5 ${
        error ? "border-rose-500 focus:ring-rose-200" : "border-gray-200 focus:ring-cyan-300"
      } focus:border-cyan-400 outline-none transition-all bg-white`}
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
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
      {required && <span className="text-rose-500">*</span>}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className={`w-full rounded-lg border px-4 py-2.5 ${
        error ? "border-rose-500 focus:ring-rose-200" : "border-gray-200 focus:ring-cyan-300"
      } focus:border-cyan-400 outline-none transition-all bg-white`}
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
