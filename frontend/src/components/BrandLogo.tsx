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
  markClassName = "h-24 w-80",
  imageClassName = "",
  textClassName = "",
  surface = "none",
}: BrandLogoProps) {
  const [logoMissing, setLogoMissing] = useState(false);
  const surfaceClass =
    surface === "light"
      ? "rounded-lg bg-white/95 p-2 shadow-md ring-1 ring-slate-200/80"
      : "";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {!logoMissing ? (
        <div className={`flex shrink-0 items-center overflow-visible ${markClassName}`}>
          <span className={`inline-flex h-full max-w-full items-center ${surfaceClass}`}>
            <img
              src="/images/logo-transparent.png"
              alt="FloodGuard360"
              onError={() => setLogoMissing(true)}
              className={`h-full w-auto max-w-full object-contain drop-shadow-[0_14px_24px_rgba(0,0,0,0.22)] ${imageClassName}`}
            />
          </span>
        </div>
      ) : (
        <div className={`shrink-0 rounded-lg border border-sky-300/30 bg-sky-500/10 ${markClassName}`} />
      )}

      {!compact && logoMissing && (
        <div className={`leading-none ${textClassName}`}>
          <p className="text-2xl font-bold text-white sm:text-3xl">
            FloodGuard<span className="text-emerald-300">360</span>
          </p>
          <p className="mt-1 text-xs font-semibold uppercase text-slate-300">
            Smart drainage & flood prediction system
          </p>
        </div>
      )}
    </div>
  );
}
