const FP_KEY = 'fuelmap_fp';

export function getUserFingerprint(): string {
  let fp = localStorage.getItem(FP_KEY);
  if (!fp) {
    fp = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    localStorage.setItem(FP_KEY, fp);
  }
  return fp;
}
