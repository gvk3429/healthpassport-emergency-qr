
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";

type BrandLogoProps = {
  to?: string;
  compact?: boolean;
  showTagline?: boolean;
  banner?: boolean;
  className?: string;
  imageClassName?: string;
  imageStyle?: CSSProperties;
};

export default function BrandLogo({
  to = "/",
  compact = false,
  showTagline = false,
  banner = false,
  className = "",
  imageClassName = "",
  imageStyle,
}: BrandLogoProps) {
  const logoSrc = `${import.meta.env.BASE_URL}safehealthqr-logo.jpg`;

  const image = (
    <img
      src={logoSrc}
      alt="SafehealthQR — Scan. Know. Stay Safe."
      className={[
        "block h-auto max-w-full shrink-0 object-contain",
        banner
          ? "w-full max-w-[440px]"
          : compact
            ? "w-[125px] sm:w-[145px]"
            : "w-[140px] sm:w-[160px]",
        imageClassName,
      ]
        .filter(Boolean)
        .join(" ")}
      style={imageStyle}
      draggable={false}
    />
  );

  return (
    <Link
      to={to}
      aria-label="SafehealthQR home"
      className={[
        "inline-flex min-w-0 flex-col items-start justify-center",
        "rounded-lg focus-visible:outline-2",
        "focus-visible:outline-offset-4 focus-visible:outline-blue-600",
        banner ? "w-full max-w-[440px]" : "w-fit",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {image}

      {showTagline && (
        <span
          className={[
            "mt-1 text-xs font-medium tracking-wide text-slate-600",
            compact ? "text-[10px]" : "text-xs",
          ].join(" ")}
        >
          Scan. Know. Stay Safe.
        </span>
      )}
    </Link>
  );
}
