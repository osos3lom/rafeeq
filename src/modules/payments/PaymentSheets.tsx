import { CircleCheck, ScanFace, Smartphone } from 'lucide-react';
import { useState } from 'react';
import type { PaymentMethod } from '../../domain/types';
import { useI18n } from '../../i18n/i18n';
import { useOnline } from '../../lib/connectivity';
import { Button, Sheet, cx } from '../../ui/kit';
import { PaymentMark, usePaymentLabel } from '../../ui/visuals';
import { PaymentError, adapterFor } from './gateway';

/** Method-specific confirmation step (Apple Pay biometric, STC Pay push approval, saved card). */
export function PaymentConfirmSheet({
  open,
  method,
  amount,
  isHold,
  onConfirm,
  onClose,
}: {
  open: boolean;
  method: PaymentMethod;
  amount: number;
  isHold?: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const { s, money } = useI18n();
  const label = usePaymentLabel();
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmation = adapterFor(method.type).confirmation;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof PaymentError && e.code === 'offline' ? s.common.offlinePay : s.payment.failed);
    } finally {
      setBusy(false);
    }
  };

  const cta =
    confirmation === 'biometric' ? s.payment.confirmBiometric : confirmation === 'push_approval' ? s.payment.confirmStc : s.payment.confirmCard;
  const CtaIcon = confirmation === 'biometric' ? ScanFace : confirmation === 'push_approval' ? Smartphone : CircleCheck;

  return (
    <Sheet open={open} onClose={busy ? () => {} : onClose} title={s.payment.confirmTitle}>
      <div className="rounded-3xl bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PaymentMark type={method.type} />
            <span className="text-sm font-semibold text-navy-700">{label(method)}</span>
          </div>
          <span className="text-sm text-navy-500">{s.payment.merchant}</span>
        </div>
        <div className="mt-5 text-center">
          {isHold && <p className="text-xs font-medium text-navy-500">{s.payment.holdNote}</p>}
          <p className="text-4xl font-bold tabular-nums text-navy-800">{money(amount)}</p>
        </div>
        {confirmation === 'push_approval' && busy && (
          <p className="mt-4 rounded-2xl bg-[#F3E8FA] p-3 text-center text-sm text-[#4F008C]">{s.payment.stcNote}</p>
        )}
      </div>
      {error && <p className="mt-3 text-center text-sm font-medium text-red-700" role="alert">{error}</p>}
      <Button block className="mt-4" onClick={confirm} loading={busy} disabled={!online}>
        <CtaIcon className="size-5" aria-hidden />
        {online ? cta : s.common.offlinePay}
      </Button>
      <p className="mt-3 text-center text-xs text-navy-400">{s.payment.demoNote}</p>
    </Sheet>
  );
}

export function PaymentMethodPicker({
  open,
  methods,
  selectedId,
  onSelect,
  onClose,
}: {
  open: boolean;
  methods: PaymentMethod[];
  selectedId: string | null;
  onSelect: (m: PaymentMethod) => void;
  onClose: () => void;
}) {
  const { s } = useI18n();
  const label = usePaymentLabel();
  return (
    <Sheet open={open} onClose={onClose} title={s.fuelSelect.choosePayment}>
      <div className="space-y-2" role="radiogroup">
        {methods.map((m) => (
          <button
            key={m.id}
            role="radio"
            aria-checked={m.id === selectedId}
            onClick={() => {
              onSelect(m);
              onClose();
            }}
            className={cx(
              'flex min-h-16 w-full items-center gap-3 rounded-2xl bg-white px-4 text-start shadow-card ring-2',
              m.id === selectedId ? 'ring-teal-600' : 'ring-transparent',
            )}
          >
            <PaymentMark type={m.type} />
            <span className="flex-1 font-semibold text-navy-800">{label(m)}</span>
            {m.id === selectedId && <CircleCheck className="size-5 text-teal-600" aria-hidden />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
