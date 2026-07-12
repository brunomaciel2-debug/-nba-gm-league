// ISO 3166-1 alpha-2 code for every nationality string currently stored on
// players.nationality — covers real-world variant spellings already present
// in the DB (e.g. 'Dominican Rep.' and 'Dominican Republic' both exist,
// 'England'/'United Kingdom'/'Great Britain' all map to the GB flag since
// Unicode's separate England flag has poor font support).
const COUNTRY_ISO: Record<string, string> = {
  USA: 'US', Spain: 'ES', France: 'FR', Serbia: 'RS', Israel: 'IL', Sudan: 'SD',
  China: 'CN', Netherlands: 'NL', Turkey: 'TR', Canada: 'CA', Chile: 'CL',
  Nigeria: 'NG', Senegal: 'SN', Croatia: 'HR', Italy: 'IT', Germany: 'DE',
  Albania: 'AL', Brazil: 'BR', Greece: 'GR', 'Dominican Rep.': 'DO',
  England: 'GB', Bahamas: 'BS', Latvia: 'LV', 'United Kingdom': 'GB',
  Guinea: 'GN', Denmark: 'DK', Colombia: 'CO', Argentina: 'AR', Australia: 'AU',
  HK: 'HK', 'Czech Republic': 'CZ', Lithuania: 'LT', Bosnia: 'BA',
  'Bosnia and Herzegovina': 'BA', Haiti: 'HT', Georgia: 'GE', 'South Sudan': 'SS',
  'Dominican Republic': 'DO', Finland: 'FI', 'Puerto Rico': 'PR',
  'New Zealand': 'NZ', Bulgaria: 'BG', Angola: 'AO', Russia: 'RU',
  Switzerland: 'CH', Ukraine: 'UA', Cameroon: 'CM', Congo: 'CD',
  'DR Congo': 'CD', Slovenia: 'SI', Japan: 'JP', Mali: 'ML',
  'North Macedonia': 'MK', Egypt: 'EG', Venezuela: 'VE', 'Great Britain': 'GB',
  'Cape Verde': 'CV', Montenegro: 'ME', Belgium: 'BE', 'S. Africa': 'ZA',
  'South Africa': 'ZA', Portugal: 'PT', Jamaica: 'JM', Panama: 'PA',
  Sweden: 'SE', Mexico: 'MX', 'Trinidad and Tobago': 'TT', Poland: 'PL',
  Hungary: 'HU', Romania: 'RO', Belarus: 'BY', Norway: 'NO', Austria: 'AT',
  Slovakia: 'SK', Kosovo: 'XK', Iceland: 'IS', Estonia: 'EE', Moldova: 'MD',
  'Ivory Coast': 'CI', "Côte d'Ivoire": 'CI', Morocco: 'MA', Tunisia: 'TN',
  Algeria: 'DZ', Kenya: 'KE', Ghana: 'GH', Tanzania: 'TZ', Ethiopia: 'ET',
  Gabon: 'GA', Mozambique: 'MZ', Rwanda: 'RW', Uganda: 'UG', Zimbabwe: 'ZW',
  'South Korea': 'KR', Philippines: 'PH', Iran: 'IR', Lebanon: 'LB',
  Jordan: 'JO', 'Saudi Arabia': 'SA', Qatar: 'QA', UAE: 'AE', India: 'IN',
  Taiwan: 'TW', Indonesia: 'ID', Mongolia: 'MN',
}

/** Unicode regional-indicator flag emoji for a stored nationality string, or '' if unknown. */
export function countryFlag(nationality: string | null | undefined): string {
  if (!nationality) return ''
  const iso = COUNTRY_ISO[nationality]
  if (!iso || iso.length !== 2) return ''
  const codePoints = iso.toUpperCase().split('').map(c => 0x1f1e6 + (c.charCodeAt(0) - 65))
  return String.fromCodePoint(codePoints[0], codePoints[1])
}
