/**
 * @file British → American spelling rules, shared by `scripts/us-english.ts`
 * (which rewrites files) and `tests/unit/us-english.test.ts` (which keeps new
 * British spellings out).
 *
 * Each rule is a whole-word pattern for the British forms (exact inflections,
 * so "fulfill" or "analysis" never match) and a function giving the US form,
 * keeping the original capitalization.
 */

/** One spelling rule. */
export interface SpellingRule {
  /** Whole-word, case-insensitive pattern for the British forms. */
  readonly pattern: RegExp;
  /** The American form of a matched word (case preserved by {@link toUs}). */
  readonly us: (british: string) => string;
}

/** A rule mapping each listed British word to one American word. */
function words(map: Record<string, string>): SpellingRule {
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  return {
    pattern: new RegExp(`\\b(?:${keys.join("|")})\\b`, "gi"),
    us: (w) => map[w.toLowerCase()] ?? w,
  };
}

/** A rule replacing a British stem with an American one inside listed word endings. */
function stem(british: string, american: string, endings: readonly string[]): SpellingRule {
  return {
    pattern: new RegExp(`\\b${british}(?:${endings.join("|")})\\b`, "gi"),
    us: (w) => american + w.slice(british.length).toLowerCase(),
  };
}

const OUR = [
  "",
  "s",
  "ed",
  "ing",
  "ful",
  "fully",
  "less",
  "ite",
  "ites",
  "able",
  "ably",
  "ist",
  "ists",
  "ation",
  "er",
  "ers",
];

/** `-ise` verbs and their family: realise → realize, organisation → organization. */
const ISE_ENDINGS = ["e", "es", "ed", "ing", "ation", "ations", "er", "ers", "able"];
const ISE_STEMS = [
  "optimis",
  "normalis",
  "serialis",
  "deserialis",
  "initialis",
  "recognis",
  "realis",
  "organis",
  "reorganis",
  "minimis",
  "maximis",
  "visualis",
  "summaris",
  "prioritis",
  "customis",
  "authoris",
  "capitalis",
  "categoris",
  "synchronis",
  "standardis",
  "memoris",
  "emphasis",
  "specialis",
  "generalis",
  "utilis",
  "finalis",
  "localis",
  "internationalis",
  "parallelis",
  "tokenis",
  "randomis",
  "materialis",
  "stabilis",
  "centralis",
  "decentralis",
  "amortis",
  "personalis",
  "characteris",
  "criticis",
  "apologis",
  "sanitis",
  "vectoris",
  "virtualis",
  "containeris",
  "modularis",
  "harmonis",
  "hospitalis",
  "metabolis",
  "sterilis",
  "neutralis",
  "mobilis",
  "hypothesis",
  "theoris",
  "digitalis",
  "regularis",
  "familiaris",
  "legalis",
  "globalis",
  "summaris",
  "patronis",
  "publicis",
];

/** Every rule, longest words first within each rule. */
export const SPELLING_RULES: readonly SpellingRule[] = [
  stem("colour", "color", [...OUR, "ise", "ize", "ised", "ized", "way", "ways"]),
  stem("behaviour", "behavior", ["", "s", "al", "ally"]),
  stem("favour", "favor", OUR),
  stem("flavour", "flavor", OUR),
  stem("honour", "honor", OUR),
  stem("labour", "labor", OUR),
  stem("neighbour", "neighbor", ["", "s", "ing", "hood", "hoods"]),
  stem("harbour", "harbor", ["", "s"]),
  stem("rumour", "rumor", ["", "s"]),
  stem("humour", "humor", ["", "s"]),
  stem("vapour", "vapor", ["", "s"]),
  stem("odour", "odor", ["", "s"]),
  stem("armour", "armor", ["", "s", "ed"]),
  stem("endeavour", "endeavor", ["", "s", "ed", "ing"]),
  stem("savour", "savor", ["", "s", "y"]),
  stem("parlour", "parlor", ["", "s"]),
  stem("vigour", "vigor", [""]),
  stem("tumour", "tumor", ["", "s"]),
  ...ISE_STEMS.filter((s, i, all) => all.indexOf(s) === i && s !== "hypothesis").map((s) =>
    stem(
      s,
      `${s.slice(0, -1)}z`,
      ISE_ENDINGS.filter((e) => !(s === "emphasis" && e === "es")),
    ),
  ),
  stem("hypothesis", "hypothesiz", ["e", "es", "ed", "ing"]),
  words({
    centre: "center",
    centres: "centers",
    centred: "centered",
    centring: "centering",
    analyse: "analyze",
    analysed: "analyzed",
    analysing: "analyzing",
    analyser: "analyzer",
    analysers: "analyzers",
    paralyse: "paralyze",
    catalogue: "catalog",
    catalogues: "catalogs",
    catalogued: "cataloged",
    grey: "gray",
    greys: "grays",
    greyed: "grayed",
    greyish: "grayish",
    greyscale: "grayscale",
    metre: "meter",
    metres: "meters",
    kilometre: "kilometer",
    kilometres: "kilometers",
    centimetre: "centimeter",
    centimetres: "centimeters",
    millimetre: "millimeter",
    millimetres: "millimeters",
    litre: "liter",
    litres: "liters",
    millilitre: "milliliter",
    millilitres: "milliliters",
    fibre: "fiber",
    fibres: "fibers",
    programme: "program",
    programmes: "programs",
    travelled: "traveled",
    travelling: "traveling",
    traveller: "traveler",
    travellers: "travelers",
    modelled: "modeled",
    modelling: "modeling",
    modeller: "modeler",
    cancelled: "canceled",
    cancelling: "canceling",
    labelled: "labeled",
    labelling: "labeling",
    signalled: "signaled",
    signalling: "signaling",
    channelled: "channeled",
    fuelled: "fueled",
    fuelling: "fueling",
    levelled: "leveled",
    totalled: "totaled",
    tunnelling: "tunneling",
    marshalled: "marshaled",
    marshalling: "marshaling",
    counselling: "counseling",
    licence: "license",
    licences: "licenses",
    licenced: "licensed",
    defence: "defense",
    defences: "defenses",
    offence: "offense",
    offences: "offenses",
    pretence: "pretense",
    whilst: "while",
    amongst: "among",
    ageing: "aging",
    judgement: "judgment",
    judgements: "judgments",
    artefact: "artifact",
    artefacts: "artifacts",
    enrol: "enroll",
    enrols: "enrolls",
    enrolment: "enrollment",
    enrolments: "enrollments",
    fulfil: "fulfill",
    fulfils: "fulfills",
    fulfilment: "fulfillment",
    instalment: "installment",
    skilful: "skillful",
    sceptical: "skeptical",
    manoeuvre: "maneuver",
    manoeuvres: "maneuvers",
    manoeuvring: "maneuvering",
    aluminium: "aluminum",
    sulphur: "sulfur",
    anaemia: "anemia",
    anaemic: "anemic",
    haemoglobin: "hemoglobin",
    haemorrhage: "hemorrhage",
    haematocrit: "hematocrit",
    haem: "heme",
    diarrhoea: "diarrhea",
    oesophagus: "esophagus",
    oedema: "edema",
    oestrogen: "estrogen",
    paediatric: "pediatric",
    orthopaedic: "orthopedic",
    foetus: "fetus",
    leukaemia: "leukemia",
    anaesthesia: "anesthesia",
    anaesthetic: "anesthetic",
    tyre: "tire",
    tyres: "tires",
    plough: "plow",
    cheque: "check",
    cheques: "checks",
    storey: "story",
    mould: "mold",
    moult: "molt",
    speciality: "specialty",
    practise: "practice",
    practised: "practiced",
    practising: "practicing",
    towards: "toward",
    afterwards: "afterward",
    learnt: "learned",
    spelt: "spelled",
    dreamt: "dreamed",
    burnt: "burned",
    maths: "math",
  }),
];

/**
 * Words and phrases never changed: real API names that use British spelling,
 * proper nouns, and quoted titles. Matched case-sensitively against the text
 * around a hit.
 */
export const KEEP: readonly RegExp[] = [
  /CancelledError/, // Python asyncio / concurrent.futures
  /\.cancelled\(\)/, // asyncio.Future.cancelled(), Task.cancelled()
  /\bcancelled\(\)/,
  /\bcancelling\(\)/, // asyncio.Task.cancelling()
  /https?:\/\/[^\s)"'>\]]*/, // external URLs keep their spelling
  /"\/maths\/[^"]*"/, // the redirect from the old topic URL (next.config.ts)
  /`\/maths\/[^`]*`/, // the old URL, named in the README
  /from "Maths"/,
  /Behavioural Public Policy/, // a journal's name
];

/** Replace a word keeping its capitalization pattern (Word, WORD, word). */
export function matchCase(original: string, replacement: string): string {
  if (original === original.toUpperCase() && original.length > 1) return replacement.toUpperCase();
  if (original[0] === original[0]?.toUpperCase())
    return replacement[0]!.toUpperCase() + replacement.slice(1);
  return replacement;
}

/** The US form of one British word, or `null` if no rule matches it. */
export function toUs(word: string): string | null {
  for (const rule of SPELLING_RULES) {
    rule.pattern.lastIndex = 0;
    const full = new RegExp(`^(?:${rule.pattern.source})$`, "i");
    if (full.test(word)) {
      const us = rule.us(word);
      return us.toLowerCase() === word.toLowerCase() ? null : matchCase(word, us);
    }
  }
  return null;
}
