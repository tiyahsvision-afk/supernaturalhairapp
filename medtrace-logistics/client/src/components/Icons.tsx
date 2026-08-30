type IconProps = { size?: number; className?: string };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function TruckIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <rect x="1.5" y="7" width="12.5" height="10" />
      <path d="M14 10.5h3.6l3.4 3v3.5H14z" />
      <circle cx="6" cy="18.7" r="1.7" />
      <circle cx="17.3" cy="18.7" r="1.7" />
    </svg>
  );
}
export function UsersIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.3 20c0-3.4 3-6.1 6.7-6.1s6.7 2.7 6.7 6.1" />
      <circle cx="17.7" cy="9" r="2.4" />
      <path d="M16.3 14.1c2.7.5 4.6 2.5 5.1 6" />
    </svg>
  );
}
export function BuildingIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <rect x="4" y="3" width="16" height="18" />
      <path d="M9 21v-4.5h6V21" />
      <path d="M8 7.2h2M14 7.2h2M8 11h2M14 11h2M8 14.8h2M14 14.8h2" />
    </svg>
  );
}
export function ChatIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M4 4.5h16v12H8.3L4 20.5z" />
    </svg>
  );
}
export function ClipboardIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <rect x="5" y="4" width="14" height="17" rx="2.3" />
      <rect x="9" y="2" width="6" height="4" rx="1.1" />
      <path d="M8.3 12.3l2.2 2.2 4.3-4.7" />
    </svg>
  );
}
export function PlusIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
export function ClockIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.2v5l3.6 2" />
    </svg>
  );
}
export function CheckIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M7.8 12.6l2.7 2.7L16.3 9.2" />
    </svg>
  );
}
export function SnowIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M12 2.5v19M4.6 6.7l14.8 10.6M19.4 6.7L4.6 17.3" />
    </svg>
  );
}
export function BoltIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}
export function AlertIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M11 3.2 2.2 19.5a1 1 0 0 0 .9 1.5h17.8a1 1 0 0 0 .9-1.5L13 3.2a1 1 0 0 0-2 0z" />
      <path d="M12 9.5v4.2M12 17h.01" />
    </svg>
  );
}
export function IdIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <circle cx="8.3" cy="12" r="2" />
      <path d="M6 16.2c.4-1.3 1.4-2 2.3-2s1.9.7 2.3 2M13.5 9.5h5.3M13.5 12.7h5.3M13.5 15.9h3.4" />
    </svg>
  );
}
export function CloseIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
