// Parser for the Erasmus Without Paper registry catalogue (catalogue-v1.xml).
// Each <hei id="schac-code"> lists its Erasmus code and names; the SCHAC code is
// the institution's main internet domain.

// Country prefixes used in Erasmus institutional codes (e.g. "I  MILANO01").
const ERASMUS_PREFIX_TO_ISO = {
  A: 'AT', B: 'BE', BG: 'BG', HR: 'HR', CY: 'CY', CZ: 'CZ', DK: 'DK', EE: 'EE', SF: 'FI', F: 'FR', D: 'DE',
  G: 'GR', HU: 'HU', IRL: 'IE', I: 'IT', LV: 'LV', LT: 'LT', LUX: 'LU', MT: 'MT', NL: 'NL', PL: 'PL', P: 'PT',
  RO: 'RO', SK: 'SK', SI: 'SI', E: 'ES', S: 'SE', IS: 'IS', LI: 'LI', N: 'NO', MK: 'MK', RS: 'RS', TR: 'TR', UK: 'GB',
};

const decode = (text) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .trim();

export function countryFromErasmusCode(code) {
  const prefix = code.trim().split(/\s+/)[0]?.toUpperCase() ?? '';
  return ERASMUS_PREFIX_TO_ISO[prefix] ?? null;
}

export function parseEwpCatalogue(xml) {
  const heis = [];
  for (const match of xml.matchAll(/<hei\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/hei>/g)) {
    const [, schac, body] = match;
    const erasmus = body.match(/<other-id\b[^>]*type="erasmus"[^>]*>([^<]+)<\/other-id>/);
    if (!erasmus) continue;
    const names = [...body.matchAll(/<name\b([^>]*)>([^<]+)<\/name>/g)].map(([, attrs, name]) => ({
      lang: attrs.match(/xml:lang="([^"]+)"/)?.[1]?.toLowerCase() ?? '',
      name: decode(name),
    }));
    const name = (names.find((n) => n.lang.startsWith('en')) ?? names[0])?.name ?? '';
    const erasmusCode = decode(erasmus[1]).replace(/\s+/g, ' ');
    heis.push({ schac: decode(schac), erasmusCode, name, countryCode: countryFromErasmusCode(erasmusCode) });
  }
  return heis;
}
