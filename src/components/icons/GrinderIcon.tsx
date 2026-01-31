// Custom coffee grinder icon
export function GrinderIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Hopper (top funnel shape) */}
      <path d="M8 3L6 8H18L16 3H8Z" />
      {/* Grinder body (main cylinder) */}
      <rect x="6" y="8" width="12" height="10" rx="1" />
      {/* Grind adjustment dial */}
      <circle cx="14" cy="13" r="1.5" />
      {/* Bottom collection drawer */}
      <rect x="7" y="18" width="10" height="4" rx="0.5" />
      {/* Base */}
      <line x1="5" y1="22" x2="19" y2="22" />
    </svg>
  );
}