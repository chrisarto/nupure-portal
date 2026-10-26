import shared from '@/app/(portal)/shared.module.css';

type BadgeVariant = 'green' | 'amber' | 'red' | 'blue' | 'gray';

const VARIANT_MAP: Record<BadgeVariant, string> = {
  green: shared.badgeGreen,
  amber: shared.badgeAmber,
  red: shared.badgeRed,
  blue: shared.badgeBlue,
  gray: shared.badgeGray,
};

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  /** Auto-detect variant from label text if variant not provided */
  autoDetect?: boolean;
}

function detectVariant(label: string): BadgeVariant {
  const l = label.toLowerCase();
  if (l.includes('complet') || l.includes('current') || l.includes('good') || l.includes('pass') || l.includes('active') || l.includes('control')) return 'green';
  if (l.includes('progress') || l.includes('fair') || l.includes('review') || l.includes('pending') || l.includes('scheduled')) return 'blue';
  if (l.includes('overdue') || l.includes('poor') || l.includes('terminat') || l.includes('out of date') || l.includes('fail')) return 'red';
  if (l.includes('warning') || l.includes('amber') || l.includes('soon')) return 'amber';
  return 'gray';
}

export function StatusBadge({ label, variant, autoDetect = true }: StatusBadgeProps) {
  const v = variant ?? (autoDetect ? detectVariant(label) : 'gray');
  return (
    <span className={`${shared.badge} ${VARIANT_MAP[v]}`}>
      {label}
    </span>
  );
}
