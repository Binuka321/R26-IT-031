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
    { border: string; bg: string; iconBg: string; iconText: string }
  > = {
    cyan: {
      border: "border-cyan-500",
      bg: "from-cyan-50 to-blue-50",
      iconBg: "bg-cyan-100",
      iconText: "text-cyan-600",
    },
    purple: {
      border: "border-purple-500",
      bg: "from-purple-50 to-indigo-50",
      iconBg: "bg-purple-100",
      iconText: "text-purple-600",
    },
    emerald: {
      border: "border-emerald-500",
      bg: "from-emerald-50 to-green-50",
      iconBg: "bg-emerald-100",
      iconText: "text-emerald-600",
    },
    amber: {
      border: "border-amber-500",
      bg: "from-amber-50 to-yellow-50",
      iconBg: "bg-amber-100",
      iconText: "text-amber-600",
    },
    rose: {
      border: "border-rose-500",
      bg: "from-rose-50 to-pink-50",
      iconBg: "bg-rose-100",
      iconText: "text-rose-600",
    },
    blue: {
      border: "border-blue-500",
      bg: "from-blue-50 to-indigo-50",
      iconBg: "bg-blue-100",
      iconText: "text-blue-600",
    },
    indigo: {
      border: "border-indigo-500",
      bg: "from-indigo-50 to-violet-50",
      iconBg: "bg-indigo-100",
      iconText: "text-indigo-600",
    },
  };
  const c = colors[color];
  return (
    <div
      className={`rounded-2xl p-5 border-l-4 ${c.border} bg-gradient-to-r ${c.bg} shadow-lg hover:shadow-xl transition-shadow duration-300`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-full ${c.iconBg}`}>
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
    Medium: "bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-800",
    Low: "bg-gradient-to-r from-emerald-400 to-green-500 text-white",
  };
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${config[level] || "bg-gray-200 text-gray-600"}`}
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
    <span
      className={`px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${c.cls}`}
    >
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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl ${sizes[size]} w-full max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 1200 }}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
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
  <div className="flex flex-wrap items-center gap-3 mb-6">
    <div className="relative flex-1 min-w-[200px]">
      <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
        search
      </span>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-cyan-300 focus:border-cyan-400 outline-none transition-all"
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
    <div className="w-12 h-12 border-4 border-cyan-200 border-t-cyan-500 rounded-full animate-spin mb-4"></div>
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
    <span className="material-icons text-6xl text-gray-300 mb-4">{icon}</span>
    <h3 className="text-lg font-semibold text-gray-500 mb-1">{title}</h3>
    {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
  </div>
);

// Page Header
export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  icon: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, icon, actions }) => (
  <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
    <div className="flex items-center gap-3">
      <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg">
        <span className="material-icons">{icon}</span>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
    </div>
    {actions && (
      <div className="mt-3 md:mt-0 flex flex-wrap gap-2">{actions}</div>
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
    className={`bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
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
    className={`bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-sm hover:shadow ${className}`}
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
    className="bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg"
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
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
}> = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  min,
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
      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-300 focus:border-cyan-400 outline-none transition-all bg-white"
    />
  </div>
);

// Form Select
export const FormSelect: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}> = ({ label, value, onChange, options, required }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
      {required && <span className="text-rose-500">*</span>}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-300 focus:border-cyan-400 outline-none transition-all bg-white"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </div>
);
