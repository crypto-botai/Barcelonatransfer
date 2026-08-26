/**
 * International dialling codes for the booking form.
 *
 * The phone field was a bare <input type="tel"> and the only check on it was
 * that the string was not empty. A guest typing "612345678" left no way to tell
 * whether that was Spanish, French or a mistyped landline, and a driver who
 * cannot reach the passenger at the airport is the most expensive failure this
 * business has — the fare is lost and so is the review.
 *
 * Stored as a plain list rather than pulling in a phone library. The dependency
 * would be ~150 KB on the critical booking path to solve a problem that is, for
 * this purpose, a lookup table and a length check.
 *
 * The list is deliberately long. A missing country is not a cosmetic gap: it
 * means a real customer cannot enter their real number, which loses the booking
 * outright. Anywhere someone might fly to Barcelona from should be here.
 *
 * Flags are derived from the ISO code rather than stored — the two regional
 * indicator letters that spell a country code render as its flag.
 */

export interface DialCode {
  /** ISO 3166-1 alpha-2. */
  iso: string;
  name: string;
  /** International dialling prefix, without the plus. */
  dial: string;
}

/**
 * Countries shown first, because they are where this business's passengers
 * actually come from: Spain itself, the neighbours it drives to, and the
 * markets that fly into BCN in volume.
 */
export const PRIORITY_ISO = ["ES", "GB", "FR", "DE", "IT", "US", "NL", "IE", "AD"] as const;

export const DIAL_CODES: DialCode[] = [
  { iso: "AD", name: "Andorra", dial: "376" },
  { iso: "AE", name: "United Arab Emirates", dial: "971" },
  { iso: "AF", name: "Afghanistan", dial: "93" },
  { iso: "AG", name: "Antigua and Barbuda", dial: "1268" },
  { iso: "AL", name: "Albania", dial: "355" },
  { iso: "AM", name: "Armenia", dial: "374" },
  { iso: "AO", name: "Angola", dial: "244" },
  { iso: "AR", name: "Argentina", dial: "54" },
  { iso: "AT", name: "Austria", dial: "43" },
  { iso: "AU", name: "Australia", dial: "61" },
  { iso: "AZ", name: "Azerbaijan", dial: "994" },
  { iso: "BA", name: "Bosnia and Herzegovina", dial: "387" },
  { iso: "BB", name: "Barbados", dial: "1246" },
  { iso: "BD", name: "Bangladesh", dial: "880" },
  { iso: "BE", name: "Belgium", dial: "32" },
  { iso: "BF", name: "Burkina Faso", dial: "226" },
  { iso: "BG", name: "Bulgaria", dial: "359" },
  { iso: "BH", name: "Bahrain", dial: "973" },
  { iso: "BJ", name: "Benin", dial: "229" },
  { iso: "BM", name: "Bermuda", dial: "1441" },
  { iso: "BN", name: "Brunei", dial: "673" },
  { iso: "BO", name: "Bolivia", dial: "591" },
  { iso: "BR", name: "Brazil", dial: "55" },
  { iso: "BS", name: "Bahamas", dial: "1242" },
  { iso: "BW", name: "Botswana", dial: "267" },
  { iso: "BY", name: "Belarus", dial: "375" },
  { iso: "BZ", name: "Belize", dial: "501" },
  { iso: "CA", name: "Canada", dial: "1" },
  { iso: "CD", name: "DR Congo", dial: "243" },
  { iso: "CG", name: "Congo", dial: "242" },
  { iso: "CH", name: "Switzerland", dial: "41" },
  { iso: "CI", name: "Côte d'Ivoire", dial: "225" },
  { iso: "CL", name: "Chile", dial: "56" },
  { iso: "CM", name: "Cameroon", dial: "237" },
  { iso: "CN", name: "China", dial: "86" },
  { iso: "CO", name: "Colombia", dial: "57" },
  { iso: "CR", name: "Costa Rica", dial: "506" },
  { iso: "CU", name: "Cuba", dial: "53" },
  { iso: "CV", name: "Cape Verde", dial: "238" },
  { iso: "CY", name: "Cyprus", dial: "357" },
  { iso: "CZ", name: "Czechia", dial: "420" },
  { iso: "DE", name: "Germany", dial: "49" },
  { iso: "DK", name: "Denmark", dial: "45" },
  { iso: "DO", name: "Dominican Republic", dial: "1809" },
  { iso: "DZ", name: "Algeria", dial: "213" },
  { iso: "EC", name: "Ecuador", dial: "593" },
  { iso: "EE", name: "Estonia", dial: "372" },
  { iso: "EG", name: "Egypt", dial: "20" },
  { iso: "ES", name: "Spain", dial: "34" },
  { iso: "ET", name: "Ethiopia", dial: "251" },
  { iso: "FI", name: "Finland", dial: "358" },
  { iso: "FJ", name: "Fiji", dial: "679" },
  { iso: "FR", name: "France", dial: "33" },
  { iso: "GB", name: "United Kingdom", dial: "44" },
  { iso: "GE", name: "Georgia", dial: "995" },
  { iso: "GH", name: "Ghana", dial: "233" },
  { iso: "GI", name: "Gibraltar", dial: "350" },
  { iso: "GR", name: "Greece", dial: "30" },
  { iso: "GT", name: "Guatemala", dial: "502" },
  { iso: "HK", name: "Hong Kong", dial: "852" },
  { iso: "HN", name: "Honduras", dial: "504" },
  { iso: "HR", name: "Croatia", dial: "385" },
  { iso: "HU", name: "Hungary", dial: "36" },
  { iso: "ID", name: "Indonesia", dial: "62" },
  { iso: "IE", name: "Ireland", dial: "353" },
  { iso: "IL", name: "Israel", dial: "972" },
  { iso: "IN", name: "India", dial: "91" },
  { iso: "IQ", name: "Iraq", dial: "964" },
  { iso: "IR", name: "Iran", dial: "98" },
  { iso: "IS", name: "Iceland", dial: "354" },
  { iso: "IT", name: "Italy", dial: "39" },
  { iso: "JM", name: "Jamaica", dial: "1876" },
  { iso: "JO", name: "Jordan", dial: "962" },
  { iso: "JP", name: "Japan", dial: "81" },
  { iso: "KE", name: "Kenya", dial: "254" },
  { iso: "KG", name: "Kyrgyzstan", dial: "996" },
  { iso: "KH", name: "Cambodia", dial: "855" },
  { iso: "KR", name: "South Korea", dial: "82" },
  { iso: "KW", name: "Kuwait", dial: "965" },
  { iso: "KZ", name: "Kazakhstan", dial: "7" },
  { iso: "LB", name: "Lebanon", dial: "961" },
  { iso: "LK", name: "Sri Lanka", dial: "94" },
  { iso: "LT", name: "Lithuania", dial: "370" },
  { iso: "LU", name: "Luxembourg", dial: "352" },
  { iso: "LV", name: "Latvia", dial: "371" },
  { iso: "LY", name: "Libya", dial: "218" },
  { iso: "MA", name: "Morocco", dial: "212" },
  { iso: "MC", name: "Monaco", dial: "377" },
  { iso: "MD", name: "Moldova", dial: "373" },
  { iso: "ME", name: "Montenegro", dial: "382" },
  { iso: "MK", name: "North Macedonia", dial: "389" },
  { iso: "MT", name: "Malta", dial: "356" },
  { iso: "MU", name: "Mauritius", dial: "230" },
  { iso: "MV", name: "Maldives", dial: "960" },
  { iso: "MX", name: "Mexico", dial: "52" },
  { iso: "MY", name: "Malaysia", dial: "60" },
  { iso: "MZ", name: "Mozambique", dial: "258" },
  { iso: "NA", name: "Namibia", dial: "264" },
  { iso: "NG", name: "Nigeria", dial: "234" },
  { iso: "NI", name: "Nicaragua", dial: "505" },
  { iso: "NL", name: "Netherlands", dial: "31" },
  { iso: "NO", name: "Norway", dial: "47" },
  { iso: "NP", name: "Nepal", dial: "977" },
  { iso: "NZ", name: "New Zealand", dial: "64" },
  { iso: "OM", name: "Oman", dial: "968" },
  { iso: "PA", name: "Panama", dial: "507" },
  { iso: "PE", name: "Peru", dial: "51" },
  { iso: "PH", name: "Philippines", dial: "63" },
  { iso: "PK", name: "Pakistan", dial: "92" },
  { iso: "PL", name: "Poland", dial: "48" },
  { iso: "PT", name: "Portugal", dial: "351" },
  { iso: "PY", name: "Paraguay", dial: "595" },
  { iso: "QA", name: "Qatar", dial: "974" },
  { iso: "RO", name: "Romania", dial: "40" },
  { iso: "RS", name: "Serbia", dial: "381" },
  { iso: "RU", name: "Russia", dial: "7" },
  { iso: "RW", name: "Rwanda", dial: "250" },
  { iso: "SA", name: "Saudi Arabia", dial: "966" },
  { iso: "SE", name: "Sweden", dial: "46" },
  { iso: "SG", name: "Singapore", dial: "65" },
  { iso: "SI", name: "Slovenia", dial: "386" },
  { iso: "SK", name: "Slovakia", dial: "421" },
  { iso: "SM", name: "San Marino", dial: "378" },
  { iso: "SN", name: "Senegal", dial: "221" },
  { iso: "SV", name: "El Salvador", dial: "503" },
  { iso: "SY", name: "Syria", dial: "963" },
  { iso: "TH", name: "Thailand", dial: "66" },
  { iso: "TN", name: "Tunisia", dial: "216" },
  { iso: "TR", name: "Türkiye", dial: "90" },
  { iso: "TT", name: "Trinidad and Tobago", dial: "1868" },
  { iso: "TW", name: "Taiwan", dial: "886" },
  { iso: "TZ", name: "Tanzania", dial: "255" },
  { iso: "UA", name: "Ukraine", dial: "380" },
  { iso: "UG", name: "Uganda", dial: "256" },
  { iso: "US", name: "United States", dial: "1" },
  { iso: "UY", name: "Uruguay", dial: "598" },
  { iso: "UZ", name: "Uzbekistan", dial: "998" },
  { iso: "VE", name: "Venezuela", dial: "58" },
  { iso: "VN", name: "Vietnam", dial: "84" },
  { iso: "ZA", name: "South Africa", dial: "27" },
  { iso: "ZM", name: "Zambia", dial: "260" },
  { iso: "ZW", name: "Zimbabwe", dial: "263" },
];

/** The two regional indicator letters for an ISO code render as its flag. */
export function flagFor(iso: string): string {
  return String.fromCodePoint(
    ...iso.toUpperCase().split("").map((c) => 0x1f1a5 + c.charCodeAt(0)),
  );
}

/** Priority countries first, then the rest alphabetically. */
export const ORDERED_DIAL_CODES: DialCode[] = [
  ...PRIORITY_ISO.map((iso) => DIAL_CODES.find((c) => c.iso === iso)!).filter(Boolean),
  ...DIAL_CODES.filter((c) => !PRIORITY_ISO.includes(c.iso as never)),
];

export function dialCodeFor(iso: string): DialCode | undefined {
  return DIAL_CODES.find((c) => c.iso === iso.toUpperCase());
}

/**
 * Match against country name and dial code both, with or without the plus, so
 * "port", "351" and "+351" all find Portugal.
 */
export function searchDialCodes(query: string): DialCode[] {
  const q = query.trim().toLowerCase().replace(/^\+/, "");
  if (!q) return ORDERED_DIAL_CODES;
  return ORDERED_DIAL_CODES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.dial.startsWith(q) ||
      c.iso.toLowerCase() === q,
  );
}

/**
 * The guest's browser region, when we recognise it.
 *
 * Most passengers are flying in, so defaulting everyone to Spain would be wrong
 * for the majority — but leaving it blank makes every guest hunt through a list
 * before they can type. The browser already knows, and it is right far more
 * often than any fixed default.
 */
export function guessIsoFromBrowser(): string | null {
  if (typeof navigator === "undefined") return null;
  const tags = [navigator.language, ...(navigator.languages ?? [])];
  for (const tag of tags) {
    const region = tag?.split("-")[1]?.toUpperCase();
    if (region && DIAL_CODES.some((c) => c.iso === region)) return region;
  }
  return null;
}

/**
 * Split a stored E.164 number back into a country and a national number, so
 * returning to the form — or restoring an abandoned session — shows what the
 * guest actually typed rather than an empty field.
 *
 * Longest dial code wins: 1868 (Trinidad) must beat 1 (US) or every Caribbean
 * number resolves to the wrong country.
 *
 * +1 itself stays ambiguous — the United States, Canada and a dozen Caribbean
 * states share it, and telling them apart needs area-code tables this does not
 * carry. Ties break toward the priority list, so a bare +1 shows as the US.
 * That is a cosmetic wrongness for a Canadian guest and nothing more: the
 * number stored and dialled is identical either way.
 */
export function splitE164(value: string): { iso: string | null; national: string } {
  const digits = value.replace(/[^\d+]/g, "");
  if (!digits.startsWith("+")) return { iso: null, national: digits };
  const bare = digits.slice(1);
  const priority = (iso: string) => {
    const i = (PRIORITY_ISO as readonly string[]).indexOf(iso);
    return i === -1 ? PRIORITY_ISO.length : i;
  };
  const match = [...DIAL_CODES]
    .sort((a, b) => b.dial.length - a.dial.length || priority(a.iso) - priority(b.iso))
    .find((c) => bare.startsWith(c.dial));
  if (!match) return { iso: null, national: bare };
  return { iso: match.iso, national: bare.slice(match.dial.length) };
}

/**
 * A number is usable if it has a country and enough digits to dial.
 *
 * Six is the shortest national number in real use; fifteen is the E.164 ceiling
 * including the country code. This rejects an empty field and a stray digit,
 * which is what the old check missed, without pretending to know every national
 * numbering plan.
 */
export function isUsablePhone(iso: string | null, national: string): boolean {
  if (!iso) return false;
  const code = dialCodeFor(iso);
  if (!code) return false;
  const digits = national.replace(/\D/g, "");
  if (digits.length < 6) return false;
  return code.dial.length + digits.length <= 15;
}

/** Country + national number as a single E.164 string, which is what we store. */
export function toE164(iso: string, national: string): string {
  const code = dialCodeFor(iso);
  const digits = national.replace(/\D/g, "").replace(/^0+/, "");
  if (!code) return digits;
  return `+${code.dial}${digits}`;
}
