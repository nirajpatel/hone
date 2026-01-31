// Custom brewer icon (espresso machine/pour-over)
export function BrewEquipmentIcon({ className = "w-5 h-5" }: { className?: string }) {
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
      {/* Pour-over dripper base */}
      <path d="M7 8L5 18C4.5 19 5 20 6 20H18C19 20 19.5 19 19 18L17 8" />
      {/* Dripper top opening */}
      <path d="M7 8V6C7 5.5 7.5 5 8 5H16C16.5 5 17 5.5 17 6V8" />
      {/* Cup below */}
      <path d="M10 20V21C10 22 10.5 22.5 11 22.5H13C13.5 22.5 14 22 14 21V20" />
    </svg>
  );
}