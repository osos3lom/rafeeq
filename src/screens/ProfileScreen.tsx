import { ChevronLeft, CreditCard, Crown, LogOut, Plus, ReceiptText, ScanLine, Star, Trash } from 'lucide-react';
import { useState } from 'react';
import { router } from '../app/router';
import { setLang, useI18n } from '../i18n/i18n';
import { clearPersistedState, useStore } from '../lib/store';
import {
  accountStore,
  addPaymentMethod,
  isPlus,
  removePaymentMethod,
  saveVehicle,
  deleteVehicle,
  setDefaultPaymentMethod,
  setDefaultVehicle,
} from '../modules/account/accountStore';
import { formatSaudiMobile } from '../modules/auth/otpService';
import { Button, Card, FuelBadge, Pill, Screen, SectionTitle, Segmented, Sheet, cx } from '../ui/kit';
import { toast } from '../ui/toast';
import { PaymentMark, Plate, usePaymentLabel } from '../ui/visuals';
import { DemoTools } from '../app/DemoTools';
import { VehicleForm } from './VehicleForm';

export function ProfileScreen() {
  const { s, lang } = useI18n();
  const account = useStore(accountStore);
  const user = account.user!;
  const payLabel = usePaymentLabel();
  const [addCard, setAddCard] = useState(false);
  const [last4, setLast4] = useState('');
  const [network, setNetwork] = useState<'mada' | 'visa' | 'mastercard'>('mada');

  return (
    <div className="h-full overflow-y-auto px-4 pb-28 pt-4">
      <div className="flex items-center gap-4">
        <span className="grid size-16 place-items-center rounded-full bg-navy-800 text-2xl font-bold text-white">{user.name.slice(0, 1)}</span>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-navy-800">{user.name}</h1>
          <p className="text-sm text-navy-500">
            <bdi dir="ltr">{formatSaudiMobile(user.phone)}</bdi>
          </p>
          {isPlus(user) && (
            <Pill tone="navy">
              <Crown className="size-3" aria-hidden />
              {s.profile.plusMember}
            </Pill>
          )}
        </div>
      </div>

      <SectionTitle>{s.profile.language}</SectionTitle>
      <Segmented
        label={s.profile.language}
        value={lang}
        onChange={setLang}
        options={[
          { value: 'ar', label: 'العربية' },
          { value: 'en', label: 'English' },
        ]}
      />

      <SectionTitle
        action={
          <button onClick={() => router.push({ name: 'vehicle' })} className="flex min-h-10 items-center gap-1 text-sm font-semibold text-teal-700">
            <Plus className="size-4" aria-hidden />
            {s.profile.addVehicle}
          </button>
        }
      >
        {s.profile.vehicles}
      </SectionTitle>
      <div className="space-y-2">
        {account.vehicles.map((v) => (
          <Card key={v.id} className="flex items-center gap-3">
            <button onClick={() => router.push({ name: 'vehicle', vehicleId: v.id })} className="flex min-w-0 flex-1 items-center gap-3 text-start">
              <Plate plate={v.plate} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-navy-800">
                  {v.make} {v.model}
                </span>
                <span className="mt-0.5 flex items-center gap-2">
                  <FuelBadge fuel={v.fuelType} />
                  <span
                    className={cx('flex items-center', v.recognitionLinked ? 'text-teal-700' : 'text-navy-300')}
                    title={v.recognitionLinked ? s.profile.recognitionOn : s.profile.recognitionOff}
                  >
                    <ScanLine className="size-4" aria-label={v.recognitionLinked ? s.profile.recognitionOn : s.profile.recognitionOff} />
                  </span>
                </span>
              </span>
            </button>
            <button
              onClick={() => setDefaultVehicle(v.id)}
              aria-label={s.common.default}
              aria-pressed={v.isDefault}
              className="grid size-10 place-items-center"
            >
              <Star className={cx('size-5', v.isDefault ? 'fill-amber-400 text-amber-400' : 'text-navy-200')} aria-hidden />
            </button>
          </Card>
        ))}
      </div>

      <SectionTitle
        action={
          <button onClick={() => setAddCard(true)} className="flex min-h-10 items-center gap-1 text-sm font-semibold text-teal-700">
            <Plus className="size-4" aria-hidden />
            {s.payment.addCard}
          </button>
        }
      >
        {s.profile.payments}
      </SectionTitle>
      <Card className="divide-y divide-navy-50 py-1">
        {account.paymentMethods.map((m) => (
          <div key={m.id} className="flex min-h-14 items-center gap-3 py-2">
            <PaymentMark type={m.type} />
            <span className="flex-1 text-sm font-semibold text-navy-800">{payLabel(m)}</span>
            {m.isDefault ? (
              <Pill tone="teal">{s.common.default}</Pill>
            ) : (
              <button onClick={() => setDefaultPaymentMethod(m.id)} className="min-h-10 px-2 text-xs font-semibold text-navy-500">
                {s.payment.setDefault}
              </button>
            )}
            {account.paymentMethods.length > 1 && (
              <button onClick={() => removePaymentMethod(m.id)} aria-label={s.common.delete} className="grid size-10 place-items-center text-navy-300 hover:text-red-700">
                <Trash className="size-4" aria-hidden />
              </button>
            )}
          </div>
        ))}
      </Card>

      <SectionTitle>{s.profile.receipts}</SectionTitle>
      <button onClick={() => router.push({ name: 'receipts' })} className="block w-full text-start">
        <Card className="flex min-h-14 items-center gap-3">
          <ReceiptText className="size-5 text-teal-600" aria-hidden />
          <span className="flex-1 font-semibold text-navy-800">{s.receipt.history}</span>
          <ChevronLeft className="size-5 text-navy-300 ltr:rotate-180" aria-hidden />
        </Card>
      </button>

      <SectionTitle>{s.profile.demoTools}</SectionTitle>
      <DemoTools />

      <Button
        block
        variant="danger"
        className="mt-6"
        onClick={() => {
          clearPersistedState();
          location.reload();
        }}
      >
        <LogOut className="size-5" aria-hidden />
        {s.profile.signOut}
      </Button>

      <Sheet open={addCard} onClose={() => setAddCard(false)} title={s.payment.addCard}>
        <p className="rounded-2xl bg-teal-50 p-3 text-sm leading-relaxed text-teal-800">
          <CreditCard className="me-1 inline size-4" aria-hidden />
          {s.payment.addCardNote}
        </p>
        <p className="mb-1.5 mt-4 text-sm font-semibold text-navy-700">{s.payment.network}</p>
        <Segmented
          label={s.payment.network}
          value={network}
          onChange={setNetwork}
          options={[
            { value: 'mada', label: 'mada' },
            { value: 'visa', label: 'Visa' },
            { value: 'mastercard', label: 'Mastercard' },
          ]}
        />
        <label className="mt-4 block text-sm font-semibold text-navy-700">
          {s.payment.cardLast4}
          <input
            inputMode="numeric"
            dir="ltr"
            maxLength={4}
            value={last4}
            onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="mt-1.5 block min-h-12 w-full rounded-2xl border-0 bg-white px-4 text-center text-lg font-bold tracking-[0.4em] text-navy-800 shadow-card ring-1 ring-navy-100 focus:ring-2 focus:ring-teal-600"
          />
        </label>
        <Button
          block
          className="mt-4"
          disabled={last4.length !== 4}
          onClick={() => {
            addPaymentMethod({ type: network === 'mada' ? 'mada' : 'card', last4, network });
            setAddCard(false);
            setLast4('');
          }}
        >
          {s.common.save}
        </Button>
      </Sheet>
    </div>
  );
}

export function VehicleScreen({ vehicleId }: { vehicleId?: string }) {
  const { s } = useI18n();
  const { vehicles } = useStore(accountStore);
  const existing = vehicles.find((v) => v.id === vehicleId);
  return (
    <Screen title={existing ? s.vehicle.editTitle : s.vehicle.newTitle}>
      <div className="pt-2">
        <VehicleForm
          initial={existing}
          submitLabel={s.common.save}
          onSubmit={(v) => {
            saveVehicle(v);
            if (!existing && vehicles.length === 0) setDefaultVehicle(v.id);
            toast(s.vehicle.saved);
            router.back();
          }}
          secondary={
            existing && (
              <Button
                block
                variant="danger"
                onClick={() => {
                  deleteVehicle(existing.id);
                  toast(s.vehicle.deleted, 'info');
                  router.back();
                }}
              >
                <Trash className="size-4" aria-hidden />
                {s.common.delete}
              </Button>
            )
          }
        />
      </div>
    </Screen>
  );
}
