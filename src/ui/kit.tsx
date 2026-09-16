import { ChevronLeft, Loader, X } from 'lucide-react';
import { type ButtonHTMLAttributes, type ReactNode, useEffect } from 'react';
import { router } from '../app/router';
import type { FuelType } from '../domain/types';
import { useI18n } from '../i18n/i18n';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---- Button -------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'inverse' | 'soft' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  inverse: 'bg-white text-navy-800 hover:bg-teal-50',
  primary: 'bg-teal-600 text-white hover:bg-teal-700 disabled:bg-navy-200 disabled:text-navy-400',
  secondary: 'bg-navy-800 text-white hover:bg-navy-900 disabled:bg-navy-200 disabled:text-navy-400',
  soft: 'bg-teal-50 text-teal-700 hover:bg-teal-100 disabled:opacity-50',
  ghost: 'bg-transparent text-navy-700 hover:bg-navy-50 disabled:opacity-50',
  danger: 'bg-transparent text-red-700 hover:bg-red-50 disabled:opacity-50',
};

export function Button({
  variant = 'primary',
  size = 'lg',
  loading,
  block,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'md' | 'lg'; loading?: boolean; block?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-colors active:scale-[0.99] disabled:cursor-not-allowed',
        size === 'lg' ? 'min-h-14 px-5 text-base' : 'min-h-11 px-4 text-sm',
        block && 'w-full',
        variants[variant],
        className,
      )}
    >
      {loading ? <Loader className="size-5 animate-spin" aria-hidden /> : children}
    </button>
  );
}

// ---- Layout -----------------------------------------------------------------------

export function BackButton({ onClick }: { onClick?: () => void }) {
  const { s } = useI18n();
  return (
    <button
      onClick={onClick ?? router.back}
      aria-label={s.common.back}
      className="grid size-11 place-items-center rounded-full bg-white text-navy-800 shadow-card hover:bg-navy-50"
    >
      <ChevronLeft className="size-6 ltr:rotate-0 rtl:rotate-180" aria-hidden />
    </button>
  );
}

export function Screen({
  title,
  subtitle,
  back = true,
  onBack,
  actions,
  footer,
  children,
  bleed,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  back?: boolean;
  onBack?: () => void;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  bleed?: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      {(title || back) && (
        <header className="flex items-center gap-3 px-4 pb-2 pt-3">
          {back && <BackButton onClick={onBack} />}
          <div className="min-w-0 flex-1">
            {title && <h1 className="truncate text-lg font-bold text-navy-800">{title}</h1>}
            {subtitle && <p className="truncate text-xs text-navy-500">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={cx('flex-1 overflow-y-auto overscroll-contain', !bleed && 'px-4 pb-6')}>{children}</div>
      {footer && <div className="border-t border-navy-100/70 bg-warm-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>}
    </div>
  );
}

export function Card({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx('rounded-3xl shadow-card', !/(^|\s)p[xytblrse]?-\d/.test(className ?? '') && 'p-4', !/(^|\s)bg-/.test(className ?? '') && 'bg-white', className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between px-1">
      <h2 className="text-sm font-bold text-navy-700">{children}</h2>
      {action}
    </div>
  );
}

// ---- Controls -----------------------------------------------------------------

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode; disabled?: boolean }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-2xl bg-navy-50 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-11 flex-1 rounded-xl px-2 text-sm font-semibold transition-colors disabled:opacity-40',
            value === o.value ? 'bg-white text-navy-800 shadow-card' : 'text-navy-500 hover:text-navy-700',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('relative h-8 w-14 shrink-0 rounded-full transition-colors', checked ? 'bg-teal-600' : 'bg-navy-200')}
    >
      <span
        className={cx(
          'absolute top-1 size-6 rounded-full bg-white shadow transition-all',
          checked ? 'ltr:left-7 rtl:right-7' : 'ltr:left-1 rtl:right-1',
        )}
      />
    </button>
  );
}

export function Stepper({ qty, onChange, labelMinus, labelPlus }: { qty: number; onChange: (d: number) => void; labelMinus: string; labelPlus: string }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-teal-50 p-1">
      <button onClick={() => onChange(-1)} aria-label={labelMinus} className="grid size-9 place-items-center rounded-full bg-white text-lg font-bold text-teal-700 shadow-card">
        −
      </button>
      <span className="w-6 text-center text-sm font-bold tabular-nums text-navy-800">{qty}</span>
      <button onClick={() => onChange(1)} aria-label={labelPlus} className="grid size-9 place-items-center rounded-full bg-teal-600 text-lg font-bold text-white">
        +
      </button>
    </div>
  );
}

// ---- Sheet --------------------------------------------------------------------------

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode }) {
  const { s } = useI18n();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true">
      <button aria-label={s.common.close} onClick={onClose} className="animate-fade absolute inset-0 bg-navy-950/40" />
      <div className="animate-sheet relative max-h-[88%] overflow-y-auto rounded-t-[28px] bg-warm-bg px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-navy-200" />
        {title && (
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-navy-800">{title}</h2>
            <button onClick={onClose} aria-label={s.common.close} className="grid size-10 place-items-center rounded-full bg-white text-navy-600">
              <X className="size-5" aria-hidden />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ---- Domain bits --------------------------------------------------------------------

const FUEL_STYLE: Record<FuelType, string> = {
  '91': 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  '95': 'bg-rose-50 text-rose-800 ring-rose-200',
  diesel: 'bg-amber-50 text-amber-800 ring-amber-200',
};
const FUEL_DOT: Record<FuelType, string> = { '91': 'bg-fuel-91', '95': 'bg-fuel-95', diesel: 'bg-fuel-diesel' };

export function FuelBadge({ fuel, long }: { fuel: FuelType; long?: boolean }) {
  const { s } = useI18n();
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1', FUEL_STYLE[fuel])}>
      <span className={cx('size-2 rounded-full', FUEL_DOT[fuel])} />
      {long ? s.fuel[fuel] : fuel === 'diesel' ? s.fuel.shortDiesel : fuel}
    </span>
  );
}

export function Row({ label, value, strong, muted }: { label: ReactNode; value: ReactNode; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cx('flex items-baseline justify-between gap-4 py-1.5', strong ? 'text-base font-bold text-navy-800' : 'text-sm', muted ? 'text-navy-500' : 'text-navy-700')}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'teal' | 'amber' | 'navy' }) {
  const tones = {
    neutral: 'bg-navy-50 text-navy-600',
    teal: 'bg-teal-50 text-teal-700',
    amber: 'bg-amber-50 text-amber-800',
    navy: 'bg-navy-800 text-white',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', tones[tone])}>{children}</span>;
}
