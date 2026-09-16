import {
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Citrus,
  GlassWater,
  IceCreamCone,
  Milk,
  Nut,
  Popcorn,
  Sandwich,
  Amphora,
  Leaf,
  Wheat,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { FoodArt, PaymentMethod, PaymentMethodType, SaudiPlate } from '../domain/types';
import { useI18n } from '../i18n/i18n';
import { cx } from './kit';

// ---- Fuel gauge ------------------------------------------------------------------
// Semicircular E→F dial. Used for fueling progress and, smaller, for loyalty tier progress.

export function FuelGauge({
  value,
  size = 280,
  children,
  marks = ['E', 'F'],
  tone = 'teal',
  active,
}: {
  value: number;
  size?: number;
  children?: ReactNode;
  marks?: [string, string] | string[];
  tone?: 'teal' | 'light';
  active?: boolean;
}) {
  const v = Math.max(0, Math.min(1, value));
  const r = 42;
  const arc = `M ${50 - r} 52 A ${r} ${r} 0 0 1 ${50 + r} 52`;
  const ticks = Array.from({ length: 9 }, (_, i) => {
    const a = Math.PI - (i / 8) * Math.PI;
    const inner = i % 4 === 0 ? 31 : 34;
    return { x1: 50 + Math.cos(a) * inner, y1: 52 - Math.sin(a) * inner, x2: 50 + Math.cos(a) * 36, y2: 52 - Math.sin(a) * 36 };
  });
  const track = tone === 'teal' ? '#E1ECF2' : 'rgba(255,255,255,0.18)';
  const fill = tone === 'teal' ? '#0F7A72' : '#72D3CA';
  const ink = tone === 'teal' ? '#96BDD4' : 'rgba(255,255,255,0.5)';

  return (
    <div className="relative mx-auto" style={{ width: size, maxWidth: '100%' }} dir="ltr">
      <svg viewBox="0 0 100 64" className="w-full" aria-hidden>
        <path d={arc} fill="none" stroke={track} strokeWidth="7" strokeLinecap="round" />
        <path
          d={arc}
          fill="none"
          stroke={fill}
          strokeWidth="7"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${v * 100} 101`}
          opacity={v > 0 ? 1 : 0}
          className={cx('transition-[stroke-dasharray] duration-700 ease-out', active && 'animate-breathe')}
        />
        {ticks.map((t, i) => (
          <line key={i} {...t} stroke={ink} strokeWidth={i % 4 === 0 ? 1.2 : 0.7} strokeLinecap="round" />
        ))}
        <g style={{ transform: `rotate(${v * 180}deg)`, transformOrigin: '50px 52px' }} className="transition-transform duration-700 ease-out">
          <circle cx={50 - r} cy="52" r="4.6" fill={tone === 'teal' ? '#fff' : '#12324A'} stroke={fill} strokeWidth="2" />
        </g>
        <text x={50 - r} y="63" textAnchor="middle" fontSize="4.2" fontWeight="700" fill={ink}>
          {marks[0]}
        </text>
        <text x={50 + r} y="63" textAnchor="middle" fontSize="4.2" fontWeight="700" fill={ink}>
          {marks[1]}
        </text>
      </svg>
      {children && <div className="absolute inset-x-0 bottom-[14%] flex flex-col items-center" dir="auto">{children}</div>}
    </div>
  );
}

// ---- Saudi plate ---------------------------------------------------------------------

export const PLATE_LETTERS: [string, string][] = [
  ['ا', 'A'], ['ب', 'B'], ['ح', 'J'], ['د', 'D'], ['ر', 'R'], ['س', 'S'], ['ص', 'X'], ['ط', 'T'], ['ع', 'E'],
  ['ق', 'G'], ['ك', 'K'], ['ل', 'L'], ['م', 'Z'], ['ن', 'N'], ['هـ', 'H'], ['و', 'U'], ['ى', 'V'],
];
const latinOf = (ar: string) => PLATE_LETTERS.find(([a]) => a === ar)?.[1] ?? '·';
const arabicDigits = (d: string) => d.replace(/\d/g, (x) => '٠١٢٣٤٥٦٧٨٩'[Number(x)]);

export function Plate({ plate, size = 'md' }: { plate: SaudiPlate; size?: 'sm' | 'md' }) {
  const letters = [...plate.letters].reverse();
  return (
    <div
      dir="ltr"
      aria-label={`${plate.letters.join(' ')} ${plate.digits}`}
      className={cx(
        'inline-flex overflow-hidden rounded-md border-2 border-navy-800 bg-white font-bold text-navy-900',
        size === 'sm' ? 'h-9 text-[11px]' : 'h-12 text-sm',
      )}
    >
      <div className="grid grid-cols-2 grid-rows-2">
        <span className="flex items-center justify-center border-b border-e border-navy-300 px-1.5 tracking-wider">{arabicDigits(plate.digits)}</span>
        <span className="flex items-center justify-center gap-1 border-b border-navy-300 px-1.5">{letters.join(' ')}</span>
        <span className="flex items-center justify-center border-e border-navy-300 px-1.5 tracking-wider">{plate.digits}</span>
        <span className="flex items-center justify-center gap-1 px-1.5">{letters.map(latinOf).join(' ')}</span>
      </div>
      <div className={cx('flex flex-col items-center justify-center bg-navy-800 px-1 text-white', size === 'sm' ? 'text-[6px]' : 'text-[7px]')}>
        <span>السعودية</span>
        <span className="tracking-widest">KSA</span>
      </div>
    </div>
  );
}

// ---- Food art ------------------------------------------------------------------------
// Offline-friendly illustrated tiles instead of remote photos.

const FOOD: Record<FoodArt, { Icon: typeof Coffee; bg: string; fg: string }> = {
  coffee: { Icon: Coffee, bg: 'bg-[#EFE6DD]', fg: 'text-[#6B4A32]' },
  latte: { Icon: Milk, bg: 'bg-[#F3EBE2]', fg: 'text-[#8A6246]' },
  gahwa: { Icon: Amphora, bg: 'bg-[#F5EBD7]', fg: 'text-[#9A6B1F]' },
  tea: { Icon: Leaf, bg: 'bg-[#F4E7D6]', fg: 'text-[#9B5B2A]' },
  juice: { Icon: Citrus, bg: 'bg-[#FFF1DC]', fg: 'text-[#C06A12]' },
  water: { Icon: GlassWater, bg: 'bg-[#E4F1F7]', fg: 'text-[#2A6F97]' },
  soda: { Icon: CupSoda, bg: 'bg-[#FBE6E6]', fg: 'text-[#B23A3A]' },
  croissant: { Icon: Croissant, bg: 'bg-[#FBEFD9]', fg: 'text-[#B7791F]' },
  sandwich: { Icon: Sandwich, bg: 'bg-[#EEF3E2]', fg: 'text-[#5B7A2A]' },
  wrap: { Icon: Wheat, bg: 'bg-[#F6EEDC]', fg: 'text-[#8C6A2B]' },
  cookie: { Icon: Cookie, bg: 'bg-[#F2E6DA]', fg: 'text-[#7A4E2D]' },
  dates: { Icon: Nut, bg: 'bg-[#EFE3D8]', fg: 'text-[#6E3F22]' },
  chips: { Icon: Popcorn, bg: 'bg-[#FFF4D6]', fg: 'text-[#B08400]' },
  icecream: { Icon: IceCreamCone, bg: 'bg-[#FCE9F1]', fg: 'text-[#A83E6E]' },
};

export function FoodTile({ art, size = 64 }: { art: FoodArt; size?: number }) {
  const { Icon, bg, fg } = FOOD[art];
  return (
    <div className={cx('grid shrink-0 place-items-center rounded-2xl', bg)} style={{ width: size, height: size }} aria-hidden>
      <Icon className={fg} style={{ width: size * 0.46, height: size * 0.46 }} strokeWidth={1.6} />
    </div>
  );
}

// ---- Payment method mark ---------------------------------------------------------------

const PM_STYLE: Record<PaymentMethodType, { bg: string; text: string; mark: string }> = {
  apple_pay: { bg: 'bg-navy-950', text: 'text-white', mark: ' Pay' },
  mada: { bg: 'bg-white ring-1 ring-navy-100', text: 'text-[#259BD6]', mark: 'mada' },
  stc_pay: { bg: 'bg-[#4F008C]', text: 'text-white', mark: 'stc pay' },
  card: { bg: 'bg-white ring-1 ring-navy-100', text: 'text-[#1A1F71]', mark: 'VISA' },
};

export function PaymentMark({ type }: { type: PaymentMethodType }) {
  const st = PM_STYLE[type];
  return (
    <span dir="ltr" className={cx('grid h-8 w-12 shrink-0 place-items-center rounded-lg text-[10px] font-extrabold tracking-tight', st.bg, st.text)}>
      {type === 'apple_pay' ? 'Pay' : st.mark}
    </span>
  );
}

export function usePaymentLabel() {
  const { s } = useI18n();
  return (m: PaymentMethod | { type: PaymentMethodType; last4?: string }) =>
    `${s.payment[m.type]}${'last4' in m && m.last4 ? ` •••• ${m.last4}` : ''}`;
}
