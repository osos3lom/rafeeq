import { ScanLine } from 'lucide-react';
import { useState } from 'react';
import type { FuelType, Vehicle } from '../domain/types';
import { useI18n } from '../i18n/i18n';
import { uid } from '../lib/store';
import { Button, Segmented, Toggle, cx } from '../ui/kit';
import { PLATE_LETTERS, Plate } from '../ui/visuals';

const MAKES = ['Toyota', 'Hyundai', 'Nissan', 'Kia', 'Lexus', 'Chevrolet', 'GMC', 'Ford', 'Honda', 'Mazda', 'Mercedes-Benz', 'BMW', 'Changan', 'Geely', 'MG'];
const TANKS = { small: 45, medium: 60, large: 85 };

export type VehicleDraft = Omit<Vehicle, 'userId' | 'isDefault'>;

export function VehicleForm({
  initial,
  onSubmit,
  submitLabel,
  secondary,
}: {
  initial?: Vehicle;
  onSubmit: (v: VehicleDraft) => void;
  submitLabel: string;
  secondary?: React.ReactNode;
}) {
  const { s } = useI18n();
  const [letters, setLetters] = useState<string[]>(initial?.plate.letters ?? ['', '', '']);
  const [digits, setDigits] = useState(initial?.plate.digits ?? '');
  const [make, setMake] = useState(initial?.make ?? 'Toyota');
  const [model, setModel] = useState(initial?.model ?? '');
  const [fuelType, setFuelType] = useState<FuelType>(initial?.fuelType ?? '91');
  const [tank, setTank] = useState<keyof typeof TANKS>(
    initial ? (initial.tankLiters <= 50 ? 'small' : initial.tankLiters <= 70 ? 'medium' : 'large') : 'medium',
  );
  const [recognition, setRecognition] = useState(initial?.recognitionLinked ?? true);
  const [showError, setShowError] = useState(false);

  const valid = letters.every(Boolean) && /^\d{1,4}$/.test(digits) && model.trim().length > 0;

  const submit = () => {
    if (!valid) return setShowError(true);
    onSubmit({
      id: initial?.id ?? uid('veh'),
      plate: { letters, digits },
      make,
      model: model.trim(),
      fuelType,
      tankLiters: TANKS[tank],
      recognitionLinked: recognition,
    });
  };

  const field = 'mt-1.5 block min-h-12 w-full rounded-2xl border-0 bg-white px-4 text-base text-navy-800 shadow-card ring-1 ring-navy-100 focus:ring-2 focus:ring-teal-600';
  const plateField = 'block min-h-12 w-full min-w-0 rounded-2xl border-0 bg-white px-1 text-center font-bold text-navy-800 shadow-card ring-1 ring-navy-100 focus:ring-2 focus:ring-teal-600';

  return (
    <div className="space-y-5">
      <div className="flex justify-center py-2">
        <Plate plate={{ letters: letters.map((l) => l || '·'), digits: digits || '····' }} />
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-navy-700">{s.vehicle.plate}</legend>
        <div className="mt-1.5 grid grid-cols-[1fr_1fr_1fr_5.5rem] gap-2" dir="rtl">
          {letters.map((l, i) => (
            <select
              key={i}
              aria-label={`${s.vehicle.letters} ${i + 1}`}
              value={l}
              onChange={(e) => setLetters((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
              className={cx(plateField, 'appearance-none text-lg')}
            >
              <option value="">—</option>
              {PLATE_LETTERS.map(([ar, en]) => (
                <option key={ar} value={ar}>
                  {ar} · {en}
                </option>
              ))}
            </select>
          ))}
          <input
            aria-label={s.vehicle.digits}
            inputMode="numeric"
            maxLength={4}
            dir="ltr"
            placeholder="1234"
            value={digits}
            onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className={cx(plateField, 'text-lg tracking-widest')}
          />
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-semibold text-navy-700">
          {s.vehicle.make}
          <select value={make} onChange={(e) => setMake(e.target.value)} className={field}>
            {MAKES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-navy-700">
          {s.vehicle.model}
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder={s.vehicle.modelPlaceholder} className={field} />
        </label>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-semibold text-navy-700">{s.vehicle.fuelType}</p>
        <Segmented
          label={s.vehicle.fuelType}
          value={fuelType}
          onChange={setFuelType}
          options={(['91', '95', 'diesel'] as FuelType[]).map((f) => ({ value: f, label: s.fuel[f] }))}
        />
      </div>

      <div>
        <p className="mb-1.5 text-sm font-semibold text-navy-700">{s.vehicle.tank}</p>
        <Segmented
          label={s.vehicle.tank}
          value={tank}
          onChange={setTank}
          options={[
            { value: 'small', label: `${s.vehicle.tankSmall} · ${TANKS.small}${s.common.litersShort}` },
            { value: 'medium', label: `${s.vehicle.tankMedium} · ${TANKS.medium}${s.common.litersShort}` },
            { value: 'large', label: `${s.vehicle.tankLarge} · ${TANKS.large}${s.common.litersShort}` },
          ]}
        />
      </div>

      <div className="flex gap-3 rounded-3xl bg-white p-4 shadow-card">
        <ScanLine className="mt-0.5 size-6 shrink-0 text-teal-600" aria-hidden />
        <div className="flex-1">
          <p className="font-semibold text-navy-800">{s.vehicle.recognition}</p>
          <p className="mt-1 text-xs leading-relaxed text-navy-500">{s.vehicle.recognitionBody}</p>
        </div>
        <Toggle checked={recognition} onChange={setRecognition} label={s.vehicle.recognition} />
      </div>

      {showError && !valid && (
        <p className="text-sm font-medium text-red-700" role="alert">
          {s.vehicle.invalid}
        </p>
      )}

      <div className="space-y-2 pt-1">
        <Button block onClick={submit}>
          {submitLabel}
        </Button>
        {secondary}
      </div>
    </div>
  );
}
