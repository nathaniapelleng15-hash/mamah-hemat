// Shared PIN utilities — dipisah dari AdminLogin agar HMR tidak crash

const STORAGE_PIN_KEY = 'mh_admin_pin';
const DEFAULT_PIN = '123456';

export function hashPin(pin: string): string {
  return btoa(pin.split('').reverse().join('') + '_mhcatering');
}

export function getStoredPin(): string {
  return localStorage.getItem(STORAGE_PIN_KEY) || hashPin(DEFAULT_PIN);
}

export function savePin(pin: string): void {
  localStorage.setItem(STORAGE_PIN_KEY, hashPin(pin));
}
