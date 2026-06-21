// Canonical chapter paths for the documentation wiki. Kept dependency-free so
// both the registry (index.ts) and the content modules can import it without a
// cycle. The slugs are the URL of record — deep links and cross-references all
// route through here, so renaming a chapter is a one-line change.

export const P = {
  start: '/docs',
  principle: '/docs/principle',
  glossary: '/docs/glossary',

  hypotheses: '/docs/hypotheses',
  experiments: '/docs/experiments',
  results: '/docs/results',
  psiScore: '/docs/psi-score',

  provenance: '/docs/provenance',
  crypto: '/docs/cryptography',
  entropy: '/docs/entropy',
  witnesses: '/docs/witnesses',
  threat: '/docs/threat-model',

  verify: '/docs/verify',
  run: '/docs/run',
  architecture: '/docs/architecture',

  decisions: '/docs/decisions',
  references: '/docs/references',
} as const;

// External sources cited across the wiki, in one place so a dead link is fixed
// once. The References chapter renders the annotated list; chapters link by key.
export const REF = {
  pear: 'http://pearlab.icrl.org/',
  gcp: 'https://noosphere.princeton.edu/',
  bosch2006: 'https://pubmed.ncbi.nlm.nih.gov/16822162/',
  bem2011: 'https://pubmed.ncbi.nlm.nih.gov/21280961/',
  galak2012: 'https://pubmed.ncbi.nlm.nih.gov/22924750/',
  mossbridge2012: 'https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2012.00390/full',
  rhine: 'https://www.rhine.org/',

  drand: 'https://drand.love/',
  drandQuicknet: 'https://drand.love/docs/cryptography/',
  nistBeacon: 'https://csrc.nist.gov/projects/interoperable-randomness-beacons',
  rfc8785: 'https://www.rfc-editor.org/rfc/rfc8785',
  rfc8032: 'https://www.rfc-editor.org/rfc/rfc8032',
  rfc3161: 'https://www.rfc-editor.org/rfc/rfc3161',
  fips180: 'https://csrc.nist.gov/pubs/fips/180-4/upd1/final',
  opentimestamps: 'https://opentimestamps.org/',

  sp80022: 'https://csrc.nist.gov/pubs/sp/800/22/r1a/final',
  dieharder: 'https://webhome.phy.duke.edu/~rgb/General/dieharder.php',
  testu01: 'https://simul.iro.umontreal.ca/testu01/tu01.html',

  drng: 'https://www.intel.com/content/www/us/en/developer/articles/guide/intel-digital-random-number-generator-drng-software-implementation-guide.html',
  infnoise: 'https://github.com/leetronics/infnoise',
  onerng: 'https://onerng.info/',

  savi: 'https://arxiv.org/abs/2210.01948',
  ville: 'https://en.wikipedia.org/wiki/Ville%27s_inequality',
  deciban: 'https://en.wikipedia.org/wiki/Ban_(unit)',
  merkle: 'https://en.wikipedia.org/wiki/Merkle_tree',
  stouffer: 'https://en.wikipedia.org/wiki/Fisher%27s_method#Relation_to_Stouffer.27s_Z-score_method',
} as const;
