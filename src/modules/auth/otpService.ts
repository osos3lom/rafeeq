import { wait } from '../../lib/store';

// Stub for an SMS OTP provider (e.g. Unifonic / Taqnyat). Swap `send`/`verify`
// for real API calls; the UI only depends on this interface.

export interface OtpService {
  send(phoneE164: string): Promise<{ requestId: string; resendAfterSec: number }>;
  verify(requestId: string, code: string): Promise<boolean>;
}

export const DEMO_OTP = '1234';

export const otpService: OtpService = {
  async send() {
    await wait(600);
    return { requestId: `otp_${Date.now()}`, resendAfterSec: 30 };
  },
  async verify(_requestId, code) {
    await wait(500);
    return code === DEMO_OTP;
  },
};

/** Accepts 5XXXXXXXX, 05XXXXXXXX, 9665XXXXXXXX or +9665XXXXXXXX. */
export function normalizeSaudiMobile(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const local = digits.replace(/^(00966|966|0)/, '');
  return /^5\d{8}$/.test(local) ? `+966${local}` : null;
}

export const formatSaudiMobile = (e164: string) => {
  const d = e164.replace('+966', '');
  return `+966 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
};
