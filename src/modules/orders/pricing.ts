import type { DiscountLine, FnbLine, PickupMode, Voucher } from '../../domain/types';
import { round2 } from '../../lib/store';
import {
  PLUS_PER_LITER_DISCOUNT,
  POINTS_BLOCK,
  PUMP_DELIVERY_FEE,
  SAR_PER_BLOCK,
  pointsEarnedFor,
} from '../loyalty/loyalty';

// Pure bill computation shared by the fuel screen (estimate), the cart
// (preview) and settlement (final capture). All prices are VAT-inclusive.

export interface BillInput {
  liters: number;
  pricePerLiter: number | null;
  /** Cap for amount-based requests so rounding never exceeds what the driver chose. */
  maxFuelCost?: number;
  fnbItems: FnbLine[];
  pickupMode: PickupMode | null;
  plus: boolean;
  vouchers: Voucher[];
  pointsBalance: number;
  usePoints: boolean;
}

export interface Bill {
  fuelCost: number;
  fnbCost: number;
  serviceFee: number;
  discounts: DiscountLine[];
  total: number;
  vat: number;
  pointsRedeemed: number;
  voucherId: string | null;
  pointsEarned: number;
}

const COFFEE = new Set(['coffee']);
const SNACK = new Set(['bakery', 'snacks']);

const cheapestUnit = (items: FnbLine[], cats: Set<string>, skip = 0) => {
  const units = items.filter((i) => cats.has(i.category)).flatMap((i) => Array(i.qty).fill(i.unitPrice) as number[]);
  units.sort((a, b) => a - b);
  return units[skip] ?? 0;
};

export function computeBill(input: BillInput): Bill {
  const hasFuel = input.pricePerLiter !== null && input.liters > 0;
  let fuelCost = hasFuel ? round2(input.liters * input.pricePerLiter!) : 0;
  if (input.maxFuelCost !== undefined) fuelCost = Math.min(fuelCost, input.maxFuelCost);

  const fnbCost = round2(input.fnbItems.reduce((s, l) => s + l.unitPrice * l.qty, 0));
  const serviceFee = input.pickupMode === 'pump' && fnbCost > 0 ? PUMP_DELIVERY_FEE : 0;

  const discounts: DiscountLine[] = [];
  let fuelDiscount = 0;
  let fnbDiscount = 0;
  let freeCoffees = 0;

  if (input.plus && hasFuel) {
    const amt = round2(input.liters * PLUS_PER_LITER_DISCOUNT);
    fuelDiscount += amt;
    discounts.push({ code: 'plus_liter', labelAr: 'رفيق+ · 5 هللات/لتر', labelEn: 'Rafeeq+ · 5 halalas/L', amount: amt });

    const coffee = cheapestUnit(input.fnbItems, COFFEE);
    if (coffee > 0) {
      freeCoffees = 1;
      fnbDiscount += coffee;
      discounts.push({ code: 'plus_coffee', labelAr: 'رفيق+ · قهوة مجانية', labelEn: 'Rafeeq+ · free coffee', amount: coffee });
    }
  }
  if (input.plus && serviceFee > 0) {
    discounts.push({ code: 'plus_fee', labelAr: 'رفيق+ · توصيل مجاني', labelEn: 'Rafeeq+ · free delivery', amount: serviceFee });
  }

  // Apply at most one voucher — the first one that fits this order.
  let voucherId: string | null = null;
  for (const v of input.vouchers) {
    let amt = 0;
    if (v.kind === 'fuel_credit' && hasFuel) {
      amt = Math.min(v.value, fuelCost - fuelDiscount);
      fuelDiscount += amt;
    } else if (v.kind === 'free_coffee') {
      amt = cheapestUnit(input.fnbItems, COFFEE, freeCoffees);
      fnbDiscount += amt;
    } else if (v.kind === 'free_snack') {
      amt = cheapestUnit(input.fnbItems, SNACK);
      fnbDiscount += amt;
    }
    if (amt > 0) {
      voucherId = v.id;
      discounts.push({ code: 'voucher', labelAr: `قسيمة · ${v.titleAr}`, labelEn: `Voucher · ${v.titleEn}`, amount: round2(amt) });
      break;
    }
  }

  const subtotal = fuelCost + fnbCost + serviceFee - discounts.reduce((s, d) => s + d.amount, 0);

  let pointsRedeemed = 0;
  if (input.usePoints && subtotal > 0) {
    const blocks = Math.min(Math.floor(input.pointsBalance / POINTS_BLOCK), Math.floor(subtotal / SAR_PER_BLOCK));
    if (blocks > 0) {
      pointsRedeemed = blocks * POINTS_BLOCK;
      const amt = blocks * SAR_PER_BLOCK;
      discounts.push({ code: 'points', labelAr: `${pointsRedeemed} نقطة`, labelEn: `${pointsRedeemed} points`, amount: amt });
    }
  }

  const total = round2(Math.max(0, fuelCost + fnbCost + serviceFee - discounts.reduce((s, d) => s + d.amount, 0)));
  const vat = round2((total * 15) / 115);

  const pointsSar = (pointsRedeemed / POINTS_BLOCK) * SAR_PER_BLOCK;
  const fuelPaid = Math.max(0, fuelCost - fuelDiscount - pointsSar);
  const fnbPaid = Math.max(0, fnbCost - fnbDiscount - Math.max(0, pointsSar - (fuelCost - fuelDiscount)));

  return {
    fuelCost,
    fnbCost,
    serviceFee,
    discounts,
    total,
    vat,
    pointsRedeemed,
    voucherId,
    pointsEarned: pointsEarnedFor(fuelPaid, fnbPaid, input.plus),
  };
}
