import { cn } from '@/lib/utils';
import { initials } from '@/lib/format';

/** The amber ticket mark. ScamReport's own mark; no bank trademarks. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-7', className)}>
      <path d="M6 7h20a2 2 0 0 1 2 2v4a3 3 0 0 0 0 6v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4a3 3 0 0 0 0-6V9a2 2 0 0 1 2-2z" fill="#F4B740" />
      <path d="M11.5 16.2l3 3 6-6" fill="none" stroke="#2B1B00" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-[Noto_Sans] text-[1.0625rem] font-bold tracking-[-0.01em]', className)}>
      <BrandMark />ScamReport
    </span>
  );
}

// Fictional partner marks: rice-gold and navy, never a real bank's colour or logo. The colour comes
// from the organization ID so one organization looks the same in the citizen app and the console.
const markColors = ['bg-[#7A5A12]', 'bg-[#26405f]'];
export function OrgMark({ name, id, className }: { name: string; id: string; className?: string }) {
  const tone = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % markColors.length;
  return (
    <span aria-hidden="true" className={cn('grid size-12 flex-none place-items-center rounded-md font-heading text-lg font-bold text-white', markColors[tone], className)}>
      {initials(name)}
    </span>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('grid size-10 flex-none place-items-center rounded-full bg-accent font-heading text-base font-semibold text-accent-foreground', className)}>
      {initials(name)}
    </span>
  );
}
