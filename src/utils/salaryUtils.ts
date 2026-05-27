export function computeGross(basicPay: number, daPercent: number, hraPercent: number): number {
  const da = Math.round((basicPay * daPercent) / 100);
  const hra = Math.round((basicPay * hraPercent) / 100);
  return basicPay + da + hra;
}

export function computeNet(gross: number, nps: number, pt: number, otherDed = 0): number {
  return gross - nps - pt - otherDed;
}

export function computeDAAmount(basicPay: number, daPercent: number): number {
  return Math.round((basicPay * daPercent) / 100);
}

export function computeHRAAmount(basicPay: number, hraPercent: number): number {
  return Math.round((basicPay * hraPercent) / 100);
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
