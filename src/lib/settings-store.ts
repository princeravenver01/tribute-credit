export interface CoopSettings {
  coopName: string;
  cdaRegistrationNo: string;
  branchName: string;
  officeAddress: string;
  contactNumber: string;
  officialEmail: string;
  loanIdPrefix: string;
  mcidPrefix: string;
  currencySymbol: string;
  defaultTermMonths: number;
  defaultRepaymentFrequency: 'Weekly' | 'Monthly' | 'Daily' | 'Semi-Monthly';
  maxReconsiderationRounds: number;
  emailAlertsEnabled: boolean;
}

export const DEFAULT_COOP_SETTINGS: CoopSettings = {
  coopName: 'Tribute Credit Cooperative',
  cdaRegistrationNo: 'NCR-COOP-88219',
  branchName: 'Main Operations Branch',
  officeAddress: 'Commonwealth Ave., Quezon City, Metro Manila',
  contactNumber: '+63 2 8920 1234',
  officialEmail: 'compliance@tribute.coop',
  loanIdPrefix: 'TC-LN',
  mcidPrefix: 'TCID',
  currencySymbol: '₱',
  defaultTermMonths: 3,
  defaultRepaymentFrequency: 'Weekly',
  maxReconsiderationRounds: 3,
  emailAlertsEnabled: true,
};

const SETTINGS_KEY = 'tribute_coop_settings_v1';

let memorySettings: CoopSettings = { ...DEFAULT_COOP_SETTINGS };

export async function getCoopSettings(): Promise<CoopSettings> {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_COOP_SETTINGS, ...parsed };
      }
    } catch {
      // Fall back
    }
  }
  return memorySettings;
}

export async function saveCoopSettings(
  settings: Partial<CoopSettings>
): Promise<{ ok: boolean; settings?: CoopSettings; error?: string }> {
  if (settings.coopName !== undefined && !settings.coopName.trim()) {
    return { ok: false, error: 'Cooperative name cannot be empty' };
  }
  if (settings.cdaRegistrationNo !== undefined && !settings.cdaRegistrationNo.trim()) {
    return { ok: false, error: 'CDA Registration number cannot be empty' };
  }

  const current = await getCoopSettings();
  const merged: CoopSettings = {
    ...current,
    ...settings,
    maxReconsiderationRounds: 3, // Invariant: max 3 rounds
  };

  memorySettings = merged;

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
      window.dispatchEvent(new Event('tribute_settings_updated'));
    } catch {
      // Ignore localStorage error
    }
  }

  return { ok: true, settings: merged };
}
