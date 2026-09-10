import type { SupportedLocale } from '@/lib/i18n/locales';

const zoneLabels: Record<string, Record<SupportedLocale, string>> = {
  'Méditerranée': { fr: 'Méditerranée', en: 'Mediterranean', es: 'Mediterráneo', it: 'Mediterraneo', de: 'Mittelmeer', pt: 'Mediterrâneo', nl: 'Middellandse Zee', el: 'Μεσόγειος', no: 'Middelhavet', da: 'Middelhavet' },
  Atlantique: { fr: 'Atlantique', en: 'Atlantic', es: 'Atlántico', it: 'Atlantico', de: 'Atlantik', pt: 'Atlântico', nl: 'Atlantische Oceaan', el: 'Ατλαντικός', no: 'Atlanteren', da: 'Atlanterhavet' },
  'Caraïbes': { fr: 'Caraïbes', en: 'Caribbean', es: 'Caribe', it: 'Caraibi', de: 'Karibik', pt: 'Caraíbas', nl: 'Caraïben', el: 'Καραϊβική', no: 'Karibia', da: 'Caribien' },
  Pacifique: { fr: 'Pacifique', en: 'Pacific', es: 'Pacífico', it: 'Pacifico', de: 'Pazifik', pt: 'Pacífico', nl: 'Stille Oceaan', el: 'Ειρηνικός', no: 'Stillehavet', da: 'Stillehavet' },
  'Océan Indien': { fr: 'Océan Indien', en: 'Indian Ocean', es: 'Océano Índico', it: 'Oceano Indiano', de: 'Indischer Ozean', pt: 'Oceano Índico', nl: 'Indische Oceaan', el: 'Ινδικός Ωκεανός', no: 'Det indiske hav', da: 'Det Indiske Ocean' },
  'Mer Rouge': { fr: 'Mer Rouge', en: 'Red Sea', es: 'Mar Rojo', it: 'Mar Rosso', de: 'Rotes Meer', pt: 'Mar Vermelho', nl: 'Rode Zee', el: 'Ερυθρά Θάλασσα', no: 'Rødehavet', da: 'Det Røde Hav' },
  'Manche / Mer du Nord': { fr: 'Manche / Mer du Nord', en: 'Channel / North Sea', es: 'Canal / Mar del Norte', it: 'Canale / Mare del Nord', de: 'Kanal / Nordsee', pt: 'Canal / Mar do Norte', nl: 'Kanaal / Noordzee', el: 'Μάγχη / Βόρεια Θάλασσα', no: 'Kanalen / Nordsjøen', da: 'Kanalen / Nordsøen' },
  Bretagne: { fr: 'Bretagne', en: 'Brittany', es: 'Bretaña', it: 'Bretagna', de: 'Bretagne', pt: 'Bretanha', nl: 'Bretagne', el: 'Βρετάνη', no: 'Bretagne', da: 'Bretagne' },
  'Outre-mer': { fr: 'Outre-mer', en: 'Overseas', es: 'Ultramar', it: 'Oltremare', de: 'Übersee', pt: 'Ultramar', nl: 'Overzee', el: 'Υπερπόντια', no: 'Oversjøisk', da: 'Oversøisk' },
};

const boatLabels: Record<string, Record<SupportedLocale, string>> = {
  Voilier: { fr: 'Voilier', en: 'Sailboat', es: 'Velero', it: 'Barca a vela', de: 'Segelboot', pt: 'Veleiro', nl: 'Zeilboot', el: 'Ιστιοπλοϊκό', no: 'Seilbåt', da: 'Sejlbåd' },
  Moteur: { fr: 'Moteur', en: 'Motorboat', es: 'Lancha', it: 'Barca a motore', de: 'Motorboot', pt: 'Barco a motor', nl: 'Motorboot', el: 'Μηχανοκίνητο', no: 'Motorbåt', da: 'Motorbåd' },
  Catamaran: { fr: 'Catamaran', en: 'Catamaran', es: 'Catamarán', it: 'Catamarano', de: 'Katamaran', pt: 'Catamarã', nl: 'Catamaran', el: 'Καταμαράν', no: 'Katamaran', da: 'Katamaran' },
  'Grande unité (+20m)': { fr: 'Grande unité (+20m)', en: 'Large yacht (+20m)', es: 'Gran unidad (+20m)', it: 'Grande unità (+20m)', de: 'Große Einheit (+20m)', pt: 'Grande embarcação (+20m)', nl: 'Grote eenheid (+20m)', el: 'Μεγάλο σκάφος (+20m)', no: 'Stor yacht (+20m)', da: 'Stor yacht (+20m)' },
};

const missionTypeLabels: Record<string, Record<SupportedLocale, string>> = {
  'À la journée': { fr: 'À la journée', en: 'Daily', es: 'Por día', it: 'Giornaliera', de: 'Tagesweise', pt: 'Diária', nl: 'Per dag', el: 'Ημερήσια', no: 'Daglig', da: 'Daglig' },
  'À la semaine': { fr: 'À la semaine', en: 'Weekly', es: 'Semanal', it: 'Settimanale', de: 'Wöchentlich', pt: 'Semanal', nl: 'Per week', el: 'Εβδομαδιαία', no: 'Ukentlig', da: 'Ugentlig' },
  Saisonnier: { fr: 'Saisonnier', en: 'Seasonal', es: 'Estacional', it: 'Stagionale', de: 'Saisonal', pt: 'Sazonal', nl: 'Seizoensgebonden', el: 'Εποχική', no: 'Sesongbasert', da: 'Sæson' },
  Convoyage: { fr: 'Convoyage', en: 'Delivery', es: 'Traslado', it: 'Trasferimento', de: 'Überführung', pt: 'Delivery', nl: 'Overtocht', el: 'Μεταφορά', no: 'Delivery', da: 'Delivery' },
};

const roleLabels: Record<string, Record<SupportedLocale, string>> = {
  skipper: { fr: 'Skipper', en: 'Skipper', es: 'Patrón', it: 'Skipper', de: 'Skipper', pt: 'Skipper', nl: 'Skipper', el: 'Skipper', no: 'Skipper', da: 'Skipper' },
  owner: { fr: 'Propriétaire', en: 'Owner', es: 'Propietario', it: 'Proprietario', de: 'Eigner', pt: 'Proprietário', nl: 'Eigenaar', el: 'Ιδιοκτήτης', no: 'Eier', da: 'Ejer' },
  broker: { fr: 'Broker', en: 'Broker', es: 'Broker', it: 'Broker', de: 'Broker', pt: 'Broker', nl: 'Broker', el: 'Broker', no: 'Broker', da: 'Broker' },
  charter_company: { fr: 'Société de charter', en: 'Charter company', es: 'Empresa de charter', it: 'Società charter', de: 'Charterfirma', pt: 'Empresa de charter', nl: 'Charterbedrijf', el: 'Εταιρεία charter', no: 'Charterselskap', da: 'Charterselskab' },
};

export function localizeZone(zone: string, locale: SupportedLocale) {
  return zoneLabels[zone]?.[locale] || zone;
}

export function localizeBoatType(boatType: string, locale: SupportedLocale) {
  return boatLabels[boatType]?.[locale] || boatType;
}

export function localizeMissionType(missionType: string, locale: SupportedLocale) {
  return missionTypeLabels[missionType]?.[locale] || missionType;
}

export function localizeRole(role: string, locale: SupportedLocale) {
  return roleLabels[role]?.[locale] || role;
}
