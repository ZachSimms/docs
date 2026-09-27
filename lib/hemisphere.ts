/**
 * @file Which hemisphere the reader is probably in, from their time zone alone: no
 * location prompt. The home page's sky uses it to turn the moon the way the reader
 * sees it and to name the seasons for their half of the world.
 *
 * A time zone counts as southern when the place it is named after (its principal
 * location in the tz database's `zone.tab`) is south of the equator; its old aliases
 * (`Australia/NSW`, `America/Buenos_Aires`) follow the zone they point to. Everything
 * else, including `UTC` and the `Etc/` zones, counts as northern, where most readers
 * are. Generated from tzdata 2025b; a zone added later reads as northern until it is
 * listed here.
 */

/** Northern or southern half of the world. */
export type Hemisphere = "north" | "south";

/** IANA time zones south of the equator, with their aliases. */
const SOUTHERN_ZONES: ReadonlySet<string> = new Set(
  `
  Africa/Blantyre Africa/Brazzaville Africa/Bujumbura Africa/Dar_es_Salaam Africa/Gaborone
  Africa/Harare Africa/Johannesburg Africa/Kigali Africa/Kinshasa Africa/Luanda
  Africa/Lubumbashi Africa/Lusaka Africa/Maputo Africa/Maseru Africa/Mbabane Africa/Nairobi
  Africa/Windhoek
  America/Araguaina America/Argentina/Buenos_Aires America/Argentina/Catamarca
  America/Argentina/ComodRivadavia America/Argentina/Cordoba America/Argentina/Jujuy
  America/Argentina/La_Rioja America/Argentina/Mendoza America/Argentina/Rio_Gallegos
  America/Argentina/Salta America/Argentina/San_Juan America/Argentina/San_Luis
  America/Argentina/Tucuman America/Argentina/Ushuaia America/Asuncion America/Bahia
  America/Belem America/Buenos_Aires America/Campo_Grande America/Catamarca America/Cordoba
  America/Coyhaique America/Cuiaba America/Eirunepe America/Fortaleza America/Guayaquil
  America/Jujuy America/La_Paz America/Lima America/Maceio America/Manaus America/Mendoza
  America/Montevideo America/Noronha America/Porto_Acre America/Porto_Velho
  America/Punta_Arenas America/Recife America/Rio_Branco America/Rosario America/Santarem
  America/Santiago America/Sao_Paulo
  Antarctica/Casey Antarctica/Davis Antarctica/DumontDUrville Antarctica/Macquarie
  Antarctica/Mawson Antarctica/McMurdo Antarctica/Palmer Antarctica/Rothera
  Antarctica/South_Pole Antarctica/Syowa Antarctica/Troll Antarctica/Vostok
  Asia/Dili Asia/Jakarta Asia/Jayapura Asia/Makassar Asia/Pontianak Asia/Ujung_Pandang
  Atlantic/South_Georgia Atlantic/St_Helena Atlantic/Stanley
  Australia/ACT Australia/Adelaide Australia/Brisbane Australia/Broken_Hill
  Australia/Canberra Australia/Currie Australia/Darwin Australia/Eucla Australia/Hobart
  Australia/LHI Australia/Lindeman Australia/Lord_Howe Australia/Melbourne Australia/NSW
  Australia/North Australia/Perth Australia/Queensland Australia/South Australia/Sydney
  Australia/Tasmania Australia/Victoria Australia/West Australia/Yancowinna
  Brazil/Acre Brazil/DeNoronha Brazil/East Brazil/West
  Chile/Continental Chile/EasterIsland
  Indian/Antananarivo Indian/Chagos Indian/Christmas Indian/Cocos Indian/Comoro
  Indian/Kerguelen Indian/Mahe Indian/Mauritius Indian/Mayotte Indian/Reunion
  NZ NZ-CHAT
  Pacific/Apia Pacific/Auckland Pacific/Bougainville Pacific/Chatham Pacific/Easter
  Pacific/Efate Pacific/Enderbury Pacific/Fakaofo Pacific/Fiji Pacific/Funafuti
  Pacific/Galapagos Pacific/Gambier Pacific/Guadalcanal Pacific/Kanton Pacific/Marquesas
  Pacific/Nauru Pacific/Niue Pacific/Norfolk Pacific/Noumea Pacific/Pago_Pago
  Pacific/Pitcairn Pacific/Port_Moresby Pacific/Rarotonga Pacific/Samoa Pacific/Tahiti
  Pacific/Tongatapu Pacific/Wallis
  US/Samoa
  `
    .split(/\s+/)
    .filter(Boolean),
);

/** The hemisphere for an IANA time-zone name such as `"Australia/Sydney"`. */
export function hemisphereOf(timeZone: string | undefined): Hemisphere {
  return timeZone && SOUTHERN_ZONES.has(timeZone) ? "south" : "north";
}

/** The time zone the runtime reports (the browser's, on the client), if any. */
export function localTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}
