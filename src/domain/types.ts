// Core data model for Rafeeq. Kept framework-free so it can be shared with a
// backend or a native client later.

export type Lang = 'ar' | 'en';
export type FuelType = '91' | '95' | 'diesel';
export type SubscriptionTier = 'none' | 'plus_monthly' | 'plus_annual';

export interface User {
  id: string;
  phone: string; // E.164, e.g. +966501234567
  name: string;
  preferredLanguage: Lang;
  subscriptionTier: SubscriptionTier;
  subscriptionRenewsAt: string | null;
  pointsBalance: number;
  /** Points earned in the trailing 12 months — drives tier. */
  tierPoints: number;
  referralCode: string;
  referralsJoined: number;
  createdAt: string;
}

export interface SaudiPlate {
  /** Three Arabic plate letters, e.g. ['ر', 'س', 'ع'] */
  letters: string[];
  /** 1–4 digits */
  digits: string;
}

export interface Vehicle {
  id: string;
  userId: string;
  plate: SaudiPlate;
  make: string;
  model: string;
  fuelType: FuelType;
  tankLiters: number;
  /** Plate is linked to the station's computer-vision recognition. */
  recognitionLinked: boolean;
  isDefault: boolean;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export type PumpStatus = 'available' | 'busy' | 'offline';

export interface Pump {
  number: number;
  fuels: FuelType[];
  robotic: boolean;
  status: PumpStatus;
}

export type Amenity = 'cafe' | 'store' | 'prayer' | 'restroom' | 'air' | 'wash';

export interface Station {
  id: string;
  nameAr: string;
  nameEn: string;
  districtAr: string;
  districtEn: string;
  location: LatLng;
  hasRafeeq: boolean;
  menuId: string | null;
  pumps: Pump[];
  prices: Record<FuelType, number>;
  open24h: boolean;
  amenities: Amenity[];
}

export interface StationLiveStatus {
  stationId: string;
  availablePumps: number;
  queueLength: number;
  pumpStatus: Record<number, PumpStatus>;
  updatedAt: number;
}

export type MenuCategory = 'coffee' | 'cold' | 'bakery' | 'meals' | 'snacks';

export type FoodArt =
  | 'coffee'
  | 'latte'
  | 'gahwa'
  | 'tea'
  | 'juice'
  | 'water'
  | 'soda'
  | 'croissant'
  | 'sandwich'
  | 'wrap'
  | 'cookie'
  | 'dates'
  | 'chips'
  | 'icecream';

export interface MenuItem {
  id: string;
  menuId: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  price: number;
  category: MenuCategory;
  image: FoodArt;
  prepMinutes: number;
  calories: number;
  popular?: boolean;
}

export type PickupMode = 'pump' | 'counter';

export type PaymentMethodType = 'apple_pay' | 'mada' | 'stc_pay' | 'card';

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  last4?: string;
  network?: 'mada' | 'visa' | 'mastercard';
  isDefault: boolean;
}

export type FuelRequest =
  | { mode: 'amount'; sar: number }
  | { mode: 'liters'; liters: number }
  | { mode: 'full' };

export interface FnbLine {
  itemId: string;
  nameAr: string;
  nameEn: string;
  category: MenuCategory;
  unitPrice: number;
  qty: number;
}

export type DiscountCode = 'plus_liter' | 'plus_coffee' | 'plus_fee' | 'voucher' | 'points';

export interface DiscountLine {
  code: DiscountCode;
  labelAr: string;
  labelEn: string;
  amount: number; // positive number, subtracted from total
}

export type OrderStatus = 'pending' | 'fueling' | 'complete' | 'cancelled';

export interface Order {
  id: string;
  invoiceNo: string;
  userId: string;
  stationId: string;
  vehicleId: string | null;
  pumpNumber: number | null;
  /** Fuel part — null for an F&B-only order. */
  fuelType: FuelType | null;
  fuelRequest: FuelRequest | null;
  pricePerLiter: number | null;
  fuelAmount: number; // liters actually dispensed
  fuelCost: number;
  fnbItems: FnbLine[];
  fnbCost: number;
  fnbPlacedAt: number | null;
  pickupMode: PickupMode | null;
  serviceFee: number;
  discounts: DiscountLine[];
  pointsToRedeem: number;
  voucherId: string | null;
  total: number;
  vat: number;
  paymentMethod: PaymentMethodType;
  paymentAuthId: string;
  authorizedAmount: number;
  paymentRef: string | null;
  pumpSessionId: string | null;
  status: OrderStatus;
  pointsEarned: number;
  pointsRedeemed: number;
  createdAt: number;
  completedAt: number | null;
}

export type LedgerReason = 'order' | 'referral' | 'reward' | 'plus_bonus' | 'welcome';

export interface LoyaltyLedgerEntry {
  id: string;
  userId: string;
  orderId: string | null;
  pointsEarned: number;
  pointsRedeemed: number;
  reason: LedgerReason;
  noteAr: string;
  noteEn: string;
  createdAt: number;
}

export type VoucherKind = 'free_coffee' | 'free_snack' | 'fuel_credit';

export interface Voucher {
  id: string;
  kind: VoucherKind;
  value: number; // SAR value for fuel_credit, 0 otherwise
  titleAr: string;
  titleEn: string;
  createdAt: number;
  usedOrderId: string | null;
}
