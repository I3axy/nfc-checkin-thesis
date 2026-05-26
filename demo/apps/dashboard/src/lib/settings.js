export const DEFAULT_SETTINGS = {
  startHour: 8,
  startMinute: 0,
  lateThresholdMinutes: 15,
  autoCheckoutHour: 23,
  theme: 'blue',
}

export function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('nfc_settings') ?? '{}') } }
  catch { return { ...DEFAULT_SETTINGS } }
}

export function saveSettings(s) {
  localStorage.setItem('nfc_settings', JSON.stringify(s))
}
