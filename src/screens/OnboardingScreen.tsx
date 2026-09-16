import { Coffee, Fuel, Loader, ScanLine } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DEMO_PHONE, accountStore, createNewAccount, saveVehicle, seedDemoAccount } from '../modules/account/accountStore';
import { formatSaudiMobile, normalizeSaudiMobile, otpService } from '../modules/auth/otpService';
import { seedDemoLoyalty } from '../modules/loyalty/loyalty';
import { setLang, useI18n } from '../i18n/i18n';
import { router } from '../app/router';
import { BackButton, Button, Segmented } from '../ui/kit';
import { FuelGauge } from '../ui/visuals';
import { VehicleForm } from './VehicleForm';

type Step = 'welcome' | 'phone' | 'otp' | 'name' | 'vehicle';

export function OnboardingScreen() {
  const { s, lang } = useI18n();
  const [step, setStep] = useState<Step>('welcome');
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState(false);
  const [requestId, setRequestId] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [code, setCode] = useState('');
  const [otpError, setOtpError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (step === 'otp') codeRef.current?.focus();
  }, [step]);

  const sendCode = async (raw = phoneInput) => {
    const normalized = normalizeSaudiMobile(raw);
    if (!normalized) return setPhoneError(true);
    setPhoneError(false);
    setBusy(true);
    const res = await otpService.send(normalized);
    setBusy(false);
    setPhone(normalized);
    setRequestId(res.requestId);
    setResendIn(res.resendAfterSec);
    setCode('');
    setStep('otp');
  };

  const verify = async (value: string) => {
    setBusy(true);
    const ok = await otpService.verify(requestId, value);
    setBusy(false);
    if (!ok) {
      setOtpError(true);
      setCode('');
      return;
    }
    if (phone === DEMO_PHONE) {
      seedDemoAccount(lang);
      seedDemoLoyalty(accountStore.get().user!.id);
      router.tab('home');
    } else {
      setStep('name');
    }
  };

  const onCode = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    setCode(digits);
    setOtpError(false);
    if (digits.length === 4) verify(digits);
  };

  const back = ({ phone: 'welcome', otp: 'phone', name: 'otp', vehicle: 'name', welcome: null } as const)[step];

  return (
    <div className="flex h-full flex-col overflow-y-auto px-5 pb-6 pt-3">
      <div className="flex min-h-11 items-center justify-between">
        {back ? <BackButton onClick={() => setStep(back)} /> : <span />}
        <div className="w-44">
          <Segmented
            label={s.profile.language}
            value={lang}
            onChange={setLang}
            options={[
              { value: 'ar', label: 'العربية' },
              { value: 'en', label: 'English' },
            ]}
          />
        </div>
      </div>

      {step === 'welcome' && (
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="w-full rounded-[32px] bg-navy-800 px-6 pb-6 pt-8 text-white">
              <FuelGauge value={0.72} size={220} tone="light" marks={['E', 'F']}>
                <span className="text-4xl font-bold">{s.brand}</span>
              </FuelGauge>
              <div className="mt-4 flex justify-center gap-6 text-teal-200">
                <ScanLine className="size-6" aria-hidden />
                <Fuel className="size-6" aria-hidden />
                <Coffee className="size-6" aria-hidden />
              </div>
            </div>
            <h1 className="mt-8 text-2xl font-bold leading-snug text-navy-800">{s.onboarding.welcomeTitle}</h1>
            <p className="mt-3 text-base leading-relaxed text-navy-500">{s.onboarding.welcomeBody}</p>
          </div>
          <Button block className="mt-6" onClick={() => setStep('phone')}>
            {s.onboarding.start}
          </Button>
        </div>
      )}

      {step === 'phone' && (
        <div className="flex flex-1 flex-col">
          <h1 className="mt-6 text-2xl font-bold text-navy-800">{s.onboarding.phoneTitle}</h1>
          <p className="mt-2 text-navy-500">{s.onboarding.phoneBody}</p>
          <div dir="ltr" className="mt-6 flex min-h-14 items-center overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-navy-100 focus-within:ring-2 focus-within:ring-teal-600">
            <span className="flex h-14 shrink-0 items-center gap-2 border-e border-navy-100 px-4 font-semibold text-navy-600">+966</span>
            <input
              autoFocus
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="5X XXX XXXX"
              aria-label={s.onboarding.phoneTitle}
              value={phoneInput}
              onChange={(e) => {
                setPhoneInput(e.target.value.replace(/[^\d\s]/g, '').slice(0, 12));
                setPhoneError(false);
              }}
              onKeyDown={(e) => e.key === 'Enter' && sendCode()}
              className="h-14 min-w-0 flex-1 border-0 bg-transparent px-4 text-lg font-semibold tracking-wide text-navy-800 focus:ring-0"
            />
          </div>
          {phoneError && <p className="mt-2 text-sm font-medium text-red-700" role="alert">{s.onboarding.phoneInvalid}</p>}
          <div className="flex-1" />
          <Button block onClick={() => sendCode()} loading={busy}>
            {s.onboarding.sendCode}
          </Button>
          <Button
            block
            variant="ghost"
            className="mt-2"
            onClick={() => {
              setPhoneInput('50 123 4567');
              sendCode('501234567');
            }}
          >
            {s.onboarding.demoAccount}
          </Button>
        </div>
      )}

      {step === 'otp' && phone && (
        <div className="flex flex-1 flex-col">
          <h1 className="mt-6 text-2xl font-bold text-navy-800">{s.onboarding.otpTitle}</h1>
          <p className="mt-2 text-navy-500">
            {s.onboarding.otpBody}{' '}
            <bdi dir="ltr" className="font-semibold text-navy-700">{formatSaudiMobile(phone)}</bdi>
          </p>
          <label className="relative mt-8 block" dir="ltr">
            <span className="sr-only">{s.onboarding.otpTitle}</span>
            <input
              ref={codeRef}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => onCode(e.target.value)}
              className="absolute inset-0 h-full w-full opacity-0"
              maxLength={4}
            />
            <div className="grid grid-cols-4 gap-3" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`grid h-16 place-items-center rounded-2xl bg-white text-2xl font-bold text-navy-800 shadow-card ring-2 ${
                    otpError ? 'ring-red-300' : code.length === i ? 'ring-teal-600' : 'ring-transparent'
                  }`}
                >
                  {code[i] ?? ''}
                </div>
              ))}
            </div>
          </label>
          {otpError && <p className="mt-3 text-sm font-medium text-red-700" role="alert">{s.onboarding.otpWrong}</p>}
          <p className="mt-4 rounded-2xl bg-teal-50 px-4 py-3 text-center text-sm font-medium text-teal-800">{s.onboarding.otpHint}</p>
          <div className="mt-4 flex items-center justify-between text-sm">
            <button className="min-h-11 font-semibold text-navy-600" onClick={() => setStep('phone')}>
              {s.onboarding.editPhone}
            </button>
            {resendIn > 0 ? (
              <span className="text-navy-400">{s.onboarding.resendIn(resendIn)}</span>
            ) : (
              <button className="min-h-11 font-semibold text-teal-700" onClick={() => sendCode(phone)}>
                {s.onboarding.resend}
              </button>
            )}
          </div>
          <div className="flex-1" />
          {busy && <Loader className="mx-auto size-7 animate-spin text-teal-600" aria-hidden />}
        </div>
      )}

      {step === 'name' && (
        <div className="flex flex-1 flex-col">
          <h1 className="mt-6 text-2xl font-bold text-navy-800">{s.onboarding.nameTitle}</h1>
          <input
            autoFocus
            autoComplete="given-name"
            placeholder={s.onboarding.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-6 min-h-14 rounded-2xl border-0 bg-white px-4 text-lg text-navy-800 shadow-card ring-1 ring-navy-100 focus:ring-2 focus:ring-teal-600"
          />
          <div className="flex-1" />
          <Button
            block
            disabled={!name.trim()}
            onClick={() => setStep('vehicle')}
          >
            {s.common.continue}
          </Button>
        </div>
      )}

      {step === 'vehicle' && (
        <div className="flex-1">
          <h1 className="mt-4 text-2xl font-bold text-navy-800">{s.onboarding.vehicleTitle}</h1>
          <p className="mb-4 mt-2 text-navy-500">{s.onboarding.vehicleBody}</p>
          <VehicleForm
            submitLabel={s.common.save}
            onSubmit={(v) => {
              createNewAccount(phone!, name.trim(), lang);
              saveVehicle({ ...v, isDefault: true });
              router.tab('home');
            }}
            secondary={
              <Button
                block
                variant="ghost"
                onClick={() => {
                  createNewAccount(phone!, name.trim(), lang);
                  router.tab('home');
                }}
              >
                {s.onboarding.skipVehicle}
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}
