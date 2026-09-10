import ISO6391 from 'iso-639-1';

export interface CertificationOptionGroup {
  label: string;
  options: string[];
}

export const CERTIFICATION_GROUPS: CertificationOptionGroup[] = [
  {
    label: 'France',
    options: [
      'Permis côtier',
      'Permis hauturier',
      'Permis eaux intérieures',
      'Extension grande plaisance eaux intérieures',
      'Capitaine 200',
      'Capitaine 200 Yacht',
      'Capitaine 200 Voile',
      'Capitaine 500',
      'Capitaine 500 Yacht',
      'Capitaine 3000',
      'Capitaine 3000 Yacht',
    ],
  },
  {
    label: 'RYA',
    options: [
      'RYA Powerboat Level 2',
      'RYA Advanced Powerboat',
      'RYA Day Skipper Power',
      'RYA Day Skipper Sail',
      'RYA Coastal Skipper Power',
      'RYA Coastal Skipper Sail',
      'RYA Yachtmaster Coastal',
      'RYA Yachtmaster Offshore',
      'RYA Yachtmaster Ocean',
    ],
  },
];

export const CERTIFICATION_OPTIONS = CERTIFICATION_GROUPS.flatMap((group) => group.options);

export const LANGUAGE_OPTIONS = ISO6391.getAllNames().sort((left, right) => left.localeCompare(right, 'fr'));

export const SKIPPER_BOAT_TYPES = ['Voilier', 'Moteur', 'Catamaran', 'Grande unité (+20m)'];
export const NAVIGATION_ZONES = [
  'Méditerranée',
  'Atlantique',
  'Caraïbes',
  'Pacifique',
  'Océan Indien',
  'Mer Rouge',
  'Manche / Mer du Nord',
  'Bretagne',
  'Outre-mer',
];

export const DEFAULT_INDICATIVE_RATE = '350 €';

export const RATE_FILTER_OPTIONS = [
  { value: '<200', min: null, max: 200 },
  { value: '200-400', min: 200, max: 400 },
  { value: '400+', min: 400, max: null },
];
