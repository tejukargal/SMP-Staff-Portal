export function maskAadhaar(aadhar: string, reveal = false): string {
  if (reveal) {
    const d = aadhar.replace(/\D/g, '');
    return `${d.slice(0, 4)} ${d.slice(4, 8)} ${d.slice(8, 12)}`;
  }
  const d = aadhar.replace(/\D/g, '');
  return `XXXX XXXX ${d.slice(-4)}`;
}

export function maskPAN(pan: string, reveal = false): string {
  if (reveal || pan.length < 10) return pan;
  return `${pan.slice(0, 5)}****${pan.slice(-1)}`;
}

export function maskBankAccount(account: string, reveal = false): string {
  if (reveal) return account;
  const clean = account.replace(/\s/g, '');
  return `••••${clean.slice(-4)}`;
}
