/**
 * Whether this device is read-only. The reader's choice, when there is one, wins. Otherwise phones
 * and tablets are read-only and desktops are not, so a device that rarely edits cannot write by
 * accident and then conflict with the device that does.
 */
export function resolveReadOnly(stored: string | null, isMobile: boolean): boolean {
  if (stored === "on") return true;
  if (stored === "off") return false;
  return isMobile;
}
