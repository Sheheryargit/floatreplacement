/** ISO-style codes stored in people.public_holiday_region (synced with legacy holidays label). */
export const AU_PUBLIC_HOLIDAY_REGION_OPTIONS = [
  { value: "None", label: "None" },
  { value: "AU", label: "Australia — National" },
  { value: "AU-ACT", label: "Australia — ACT" },
  { value: "AU-NSW", label: "Australia — NSW" },
  { value: "AU-NT", label: "Australia — NT" },
  { value: "AU-QLD", label: "Australia — QLD" },
  { value: "AU-SA", label: "Australia — SA" },
  { value: "AU-TAS", label: "Australia — TAS" },
  { value: "AU-VIC", label: "Australia — VIC" },
  { value: "AU-WA", label: "Australia — WA" },
];

const LEGACY_TO_REGION = Object.fromEntries(
  AU_PUBLIC_HOLIDAY_REGION_OPTIONS.map((o) => [o.label, o.value])
);

const REGION_TO_LEGACY = Object.fromEntries(
  AU_PUBLIC_HOLIDAY_REGION_OPTIONS.map((o) => [o.value, o.label])
);

export function legacyHolidaysToRegion(legacyLabel) {
  if (legacyLabel == null || legacyLabel === "") return "None";
  return LEGACY_TO_REGION[legacyLabel] ?? "None";
}

export function regionToLegacyHolidays(region) {
  if (region == null || region === "") return "None";
  return REGION_TO_LEGACY[region] ?? "None";
}
