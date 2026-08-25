import React, { useState } from "react";

interface BrandLogoProps {
  compact?: boolean;
  className?: string;
  markClassName?: string;
  imageClassName?: string;
  textClassName?: string;
  surface?: "none" | "light";
}

export default function BrandLogo({
  compact = false,
  className = "",
  markClassName = "h-20 w-64",
  imageClassName = "",
  textClassName = "",
  surface = "none",
}: BrandLogoProps) {
  const [logoMissing, setLogoMissing] = useState(false);
  const surfaceClass =
    surface === "light"
      ? "rounded-lg bg-white/95 p-1.5 shadow-sm ring-1 ring-slate-200/70"
      : "overflow-visible";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {!logoMissing ? (
        <div className={`shrink-0 ${surfaceClass} ${markClassName}`}>
          <img
            src="/images/logo-transparent.png"
            alt="FloodGuard360"
            onError={() => setLogoMissing(true)}
            className={`h-full w-full object-contain drop-shadow-[0_14px_24px_rgba(0,0,0,0.22)] ${imageClassName}`}
          />
        </div>
      ) : (
        <div className={`shrink-0 rounded-lg border border-sky-300/30 bg-sky-500/10 ${markClassName}`} />
      )}

      {!compact && logoMissing && (
        <div className={`leading-none ${textClassName}`}>
          <p className="text-xl font-bold text-white sm:text-2xl">
            FloodGuard<span className="text-emerald-300">360</span>
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase text-slate-300">
            Smart drainage & flood prediction system
          </p>
        </div>
      )}
    </div>
  );
}
