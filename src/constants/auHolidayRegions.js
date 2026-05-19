/** ISO-style region codes stored in people.public_holiday_region. */
export const PUBLIC_HOLIDAY_COUNTRY_OPTIONS = [
  { value: "None", label: "None" },
  { value: "AU", label: "Australia" },
  { value: "IN", label: "India" },
];

export const AU_PUBLIC_HOLIDAY_REGION_OPTIONS = [
  { value: "None", label: "None" },
  { value: "AU", label: "Australia - National" },
  { value: "AU-ACT", label: "Australia - ACT" },
  { value: "AU-NSW", label: "Australia - NSW" },
  { value: "AU-NT", label: "Australia - NT" },
  { value: "AU-QLD", label: "Australia - QLD" },
  { value: "AU-SA", label: "Australia - SA" },
  { value: "AU-TAS", label: "Australia - TAS" },
  { value: "AU-VIC", label: "Australia - VIC" },
  { value: "AU-WA", label: "Australia - WA" },
];

export const IN_PUBLIC_HOLIDAY_REGION_OPTIONS = [
  { value: "None", label: "None" },
  { value: "IN", label: "India - National" },
  { value: "IN-AN", label: "India - Andaman and Nicobar Islands" },
  { value: "IN-AP", label: "India - Andhra Pradesh" },
  { value: "IN-AR", label: "India - Arunachal Pradesh" },
  { value: "IN-AS", label: "India - Assam" },
  { value: "IN-BR", label: "India - Bihar" },
  { value: "IN-CH", label: "India - Chandigarh" },
  { value: "IN-CG", label: "India - Chhattisgarh" },
  { value: "IN-DH", label: "India - Dadra and Nagar Haveli and Daman and Diu" },
  { value: "IN-DL", label: "India - Delhi" },
  { value: "IN-GA", label: "India - Goa" },
  { value: "IN-GJ", label: "India - Gujarat" },
  { value: "IN-HP", label: "India - Himachal Pradesh" },
  { value: "IN-HR", label: "India - Haryana" },
  { value: "IN-JH", label: "India - Jharkhand" },
  { value: "IN-JK", label: "India - Jammu and Kashmir" },
  { value: "IN-KA", label: "India - Karnataka" },
  { value: "IN-KL", label: "India - Kerala" },
  { value: "IN-LA", label: "India - Ladakh" },
  { value: "IN-LD", label: "India - Lakshadweep" },
  { value: "IN-MH", label: "India - Maharashtra" },
  { value: "IN-ML", label: "India - Meghalaya" },
  { value: "IN-MN", label: "India - Manipur" },
  { value: "IN-MP", label: "India - Madhya Pradesh" },
  { value: "IN-MZ", label: "India - Mizoram" },
  { value: "IN-NL", label: "India - Nagaland" },
  { value: "IN-OD", label: "India - Odisha" },
  { value: "IN-PB", label: "India - Punjab" },
  { value: "IN-PY", label: "India - Puducherry" },
  { value: "IN-RJ", label: "India - Rajasthan" },
  { value: "IN-SK", label: "India - Sikkim" },
  { value: "IN-TN", label: "India - Tamil Nadu" },
  { value: "IN-TR", label: "India - Tripura" },
  { value: "IN-TS", label: "India - Telangana" },
  { value: "IN-UP", label: "India - Uttar Pradesh" },
  { value: "IN-UK", label: "India - Uttarakhand" },
  { value: "IN-WB", label: "India - West Bengal" },
];

export function inferHolidayCountry({ publicHolidayCountry, publicHolidayRegion, holidays } = {}) {
  const country = String(publicHolidayCountry ?? "").trim().toUpperCase();
  if (country && country !== "NONE") return country;
  const region = String(publicHolidayRegion ?? legacyHolidaysToRegion(holidays)).trim().toUpperCase();
  if (!region || region === "NONE") return "None";
  if (region === "AU" || region.startsWith("AU-")) return "AU";
  if (region === "IN" || region.startsWith("IN-")) return "IN";
  return "None";
}

export function normalizeHolidayRegion(region, country = "None") {
  const r = String(region ?? "").trim();
  const c = String(country ?? "None").trim().toUpperCase();
  if (r === "" || r.toLowerCase() === "none") return "None";
  if (c === "NONE") return "None";
  if (c === "AU" && (r === "AU" || r.startsWith("AU-"))) return r;
  if (c === "IN" && (r === "IN" || r.startsWith("IN-"))) return r;
  return c;
}

export function regionOptionsForCountry(country) {
  const c = String(country ?? "").trim().toUpperCase();
  if (c === "AU") return AU_PUBLIC_HOLIDAY_REGION_OPTIONS;
  if (c === "IN") return IN_PUBLIC_HOLIDAY_REGION_OPTIONS;
  return [{ value: "None", label: "None" }];
}

const LEGACY_TO_REGION = Object.fromEntries(AU_PUBLIC_HOLIDAY_REGION_OPTIONS.map((o) => [o.label, o.value]));

const REGION_TO_LEGACY = Object.fromEntries(AU_PUBLIC_HOLIDAY_REGION_OPTIONS.map((o) => [o.value, o.label]));

export function legacyHolidaysToRegion(legacyLabel) {
  if (legacyLabel == null || legacyLabel === "") return "None";
  return LEGACY_TO_REGION[legacyLabel] ?? "None";
}

export function regionToLegacyHolidays(region) {
  if (region == null || region === "") return "None";
  return REGION_TO_LEGACY[region] ?? "None";
}
