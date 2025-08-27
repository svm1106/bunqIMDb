// Utilitaires
const normKey = (s: string) =>
	s.trim().toLowerCase().replace(/-/g, '_').replace(/\s+/g, ''); // garde les underscores !
  
  // ===== LANGUES =====
  const ALLOWED_LANGUAGES = new Set([
	'Afrikaans','Albanian','Amharic','Arabic','Armenian','Azerbaijani','Bengali','Bosnian','Bulgarian','Catalan',
	'Chinese (Mandarin)','Chinese (Cantonese)','Croatian','Czech','Danish','Dari','Dutch','English','Estonian',
	'Farsi (Persian)','Filipino, Tagalog','Finnish','French','French (Canada)','Georgian','German','Greek',
	'Gujarati','Haitian Creole','Hausa','Hebrew','Hindi','Hungarian','Icelandic','Indonesian','Irish','Italian',
	'Japanese','Kannada','Kazakh','Korean','Latvian','Lithuanian','Macedonian','Malay','Malayalam','Maltese',
	'Marathi','Mongolian','Norwegian (Bokmål)','Pashto','Polish','Portuguese (Brazil)','Portuguese (Portugal)',
	'Punjabi','Romanian','Russian','Serbian','Sinhala','Slovak','Slovenian','Somali','Spanish','Spanish (Mexico)',
	'Swahili','Swedish','Tamil','Telugu','Thai','Turkish','Ukrainian','Urdu','Uzbek','Vietnamese','Welsh'
  ]);
  
  export const normalizeLanguage = (codeOrName: string): string => {
	if (!codeOrName) return 'Unknown';
	const k = normKey(codeOrName);
  
	// alias (codes + noms IMDb fréquents)
	const map: Record<string, string> = {
	  // ISO & variantes
	  af: 'Afrikaans', sq: 'Albanian', am: 'Amharic', ar: 'Arabic', hy: 'Armenian', az: 'Azerbaijani',
	  bn: 'Bengali', bs: 'Bosnian', bg: 'Bulgarian', ca: 'Catalan',
	  zh: 'Chinese (Mandarin)', zh_cn: 'Chinese (Mandarin)', zh_tw: 'Chinese (Cantonese)',
	  hr: 'Croatian', cs: 'Czech', da: 'Danish', nl: 'Dutch', en: 'English', et: 'Estonian',
	  fa: 'Farsi (Persian)', fi: 'Finnish', fr: 'French', fr_ca: 'French (Canada)', ka: 'Georgian',
	  de: 'German', el: 'Greek', gu: 'Gujarati', ht: 'Haitian Creole', ha: 'Hausa', he: 'Hebrew',
	  hi: 'Hindi', hu: 'Hungarian', is: 'Icelandic', id: 'Indonesian', ga: 'Irish', it: 'Italian',
	  ja: 'Japanese', kn: 'Kannada', kk: 'Kazakh', ko: 'Korean', lv: 'Latvian', lt: 'Lithuanian',
	  mk: 'Macedonian', ms: 'Malay', ml: 'Malayalam', mt: 'Maltese', mr: 'Marathi', mn: 'Mongolian',
	  nb: 'Norwegian (Bokmål)', no: 'Norwegian (Bokmål)',  // IMDb renvoie parfois "Norwegian"
	  ps: 'Pashto', pl: 'Polish', pt: 'Portuguese (Portugal)', pt_br: 'Portuguese (Brazil)',
	  ro: 'Romanian', ru: 'Russian', sr: 'Serbian', si: 'Sinhala', sk: 'Slovak', sl: 'Slovenian',
	  so: 'Somali', es: 'Spanish', es_mx: 'Spanish (Mexico)', sw: 'Swahili', sv: 'Swedish',
	  ta: 'Tamil', te: 'Telugu', th: 'Thai', tr: 'Turkish', uk: 'Ukrainian', ur: 'Urdu',
	  uz: 'Uzbek', vi: 'Vietnamese', cy: 'Welsh', dar: 'Dari', dari: 'Dari', prs: 'Dari',
  
	  // noms “pleins” IMDb fréquents → labels stricts
	  filipino: 'Filipino, Tagalog',
	  tagalog: 'Filipino, Tagalog',
	  'filipino,tagalog': 'Filipino, Tagalog', // si déjà combiné sans espace
	  mandarin: 'Chinese (Mandarin)',
	  cantonese: 'Chinese (Cantonese)',
	  norwegian: 'Norwegian (Bokmål)',
	  persian: 'Farsi (Persian)'
	};
  
	const out = map[k] || null;
	return out && ALLOWED_LANGUAGES.has(out) ? out : 'Unknown';
  };
  
  // ===== GENRES =====
  const ALLOWED_GENRES = new Set([
	'ACTION','ADVENTURE','ART','BIOPIC','BUSINESS','CHARM','COMEDY','CRIME','DRAMA','EDUCATION','FANTASY','FOOD',
	'GAME','HISTORICAL','HORROR','KIDS','LIFESTYLE','MUSIC','NATURE','ROMANCE','SCIENCE','SCIENCE-FICTION',
	'SOCIETAL','SPORT','TECH','THRILLER / SUSPENSE','TRAVEL','WAR','WEB FORMAT','WESTERN'
  ]);
  
  export const normalizeGenre = (imdbGenre: string): string => {
	if (!imdbGenre) return 'DRAMA';
	const g = imdbGenre.trim().toLowerCase();
  
	const map: Record<string, string> = {
	  action: 'ACTION',
	  adventure: 'ADVENTURE',
	  animation: 'ANIMATION', // ATTENTION : ANIMATION n'est pas dans la liste des genres ? --> dans ta liste, OUI (KIDS, etc.)
	  biography: 'BIOPIC',
	  comedy: 'COMEDY',
	  crime: 'CRIME',
	  documentary: 'DOCUMENTARY & TV REPORT', // genre interne autorisé ? -> OUI dans catégories, mais aussi présent dans genres. Tu l'as listé comme genre ? NON. → on mappe vers 'DOCUMENTARY & TV REPORT' si tu veux l’avoir en genre. Si tu préfères garder un genre "DOCUMENTARY & TV REPORT", laisse comme ici.
	  drama: 'DRAMA',
	  family: 'KIDS',
	  fantasy: 'FANTASY',
	  history: 'HISTORICAL',
	  horror: 'HORROR',
	  music: 'MUSIC',
	  musical: 'MUSIC',
	  mystery: 'THRILLER / SUSPENSE',
	  romance: 'ROMANCE',
	  'science fiction': 'SCIENCE-FICTION', 'sci-fi': 'SCIENCE-FICTION', scifi: 'SCIENCE-FICTION',
	  short: 'WEB FORMAT',
	  sport: 'SPORT',
	  thriller: 'THRILLER / SUSPENSE',
	  war: 'WAR',
	  western: 'WESTERN',
	  gameshow: 'GAME',
	  'game-show': 'GAME',
	  reality: 'LIFESTYLE',      // choix métier : reality → lifestyle (sinon 'TV SHOW' est plutôt une catégorie)
	  'reality-tv': 'LIFESTYLE',
	  talkshow: 'SOCIETAL',
	  'talk-show': 'SOCIETAL',
	  news: 'SOCIETAL',
	  educational: 'EDUCATION', education: 'EDUCATION',
	  nature: 'NATURE',
	  travel: 'TRAVEL',
	  science: 'SCIENCE',
	  technology: 'TECH',
	  business: 'BUSINESS',
	  food: 'FOOD',
	  lifestyle: 'LIFESTYLE',
	  charm: 'CHARM'
	};
  
	const val = map[g] || imdbGenre.toUpperCase();
	return ALLOWED_GENRES.has(val) ? val : 'DRAMA';
  };
  
  // ===== PAYS =====
  const ALLOWED_COUNTRIES = new Set([
	'Albania','Algeria','Andorra','Angola','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas',
	'Bahrain','Bangladesh','Barbados','Belarus','Belgium','Benin','Bhutan','Bolivia','Bosnia and Herzegovina',
	'Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cabo Verde','Cambodia','Cameroon','Canada',
	'Chad','Chile','China','Colombia','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic',
	'Democratic Republic of the Congo','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt',
	'El Salvador','Equatorial Guinea','Estonia','Ethiopia','Finland','France','Gabon','Gambia','Georgia','Germany',
	'Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland',
	'India','Indonesia','Iran','Iraq','Ireland','Israel','Italy',"Ivory Coast (Côte d'Ivoire)",'Jamaica','Japan',
	'Jordan','Kazakhstan','Kenya','Korea (South)','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia',
	'Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Mali','Malta','Mauritania',
	'Mauritius','Mexico','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Namibia','Nepal',
	'Netherlands','New Zealand','Nicaragua','Niger','Nigeria','Norway','Oman','Pakistan','Panama','Papua New Guinea',
	'Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Saudi Arabia','Senegal',
	'Serbia','Sierra Leone','Singapore','Slovakia','Slovenia','South Africa','Spain','Sri Lanka','Suriname','Sweden',
	'Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Togo','Tunisia','Turkey','Turkmenistan',
	'Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vatican City',
	'Venezuela','Vietnam','Zambia','Zimbabwe'
  ]);
  
  export const normalizeCountry = (country: string): string => {
	if (!country) return 'Unknown';
	const c = country.trim();
  
	const map: Record<string,string> = {
	  // normalisations & alias IMDb → libellé strict
	  USA: 'United States', 'United States of America': 'United States', US: 'United States',
	  UK: 'United Kingdom', 'Great Britain': 'United Kingdom', England: 'United Kingdom',
  
	  'Republic of Korea': 'Korea (South)', 'South Korea': 'Korea (South)', 'Korea, Republic of': 'Korea (South)',
  
	  'Russian Federation': 'Russia', 'Viet Nam': 'Vietnam',
	  'Iran, Islamic Republic of': 'Iran', 'Syria Arab Republic': 'Syria', 'Iraq, Republic of': 'Iraq',
	  'Bolivia (Plurinational State of)': 'Bolivia', 'Moldova, Republic of': 'Moldova',
	  'Tanzania, United Republic of': 'Tanzania', 'Venezuela, Bolivarian Republic of': 'Venezuela',
	  'Czechia': 'Czech Republic',
  
	  // ⚠️ Labels NON autorisés dans ta liste → on NE mappe PAS (laisser à Unknown)
	  // 'Hong Kong' / 'Macau' / 'Palestine' / 'Korea (North)' -> absents de la liste autorisée
  
	  // Pass-through pour tous les labels stricts (si IMDb renvoie déjà le bon)
	  // (voir ta liste exhaustive ci-dessus)
	};
  
	const out = map[c] || c;
	return ALLOWED_COUNTRIES.has(out) ? out : 'Unknown';
  };
  
  // ===== CATEGORIES =====
  const ALLOWED_CATEGORIES = new Set([
	'ANIMATION','CINEMA','DOCUMENTARY & TV REPORT','MUSIC & LIVE',
	'SERIE & TELENOVELAS','SPORT','TV MOVIE','TV SHOW','EDUTAINMENT'
  ]);
  
  export const deduceCategory = (
	mediaType: string,         // si utile ailleurs
	genre?: string,
	titleTypeId?: string
  ): string => {
	const tt = (titleTypeId || '').toLowerCase().trim();
	const g  = (genre || '').toLowerCase().trim();
  
	// 1) Règle déterministe par titleType IMDb
	let cat: string | null = null;
	const ttMap: Record<string,string> = {
	  movie: 'CINEMA',
	  tvmovie: 'TV MOVIE',
	  tvseries: 'SERIE & TELENOVELAS',
	  tvminiseries: 'SERIE & TELENOVELAS',
	  tvepisode: 'SERIE & TELENOVELAS', // on classe l'épisode dans la famille série
	  tvspecial: 'TV SHOW',             // choix métier, sinon CINEMA ?
	  short: 'CINEMA',                  // la granularité “short” relève du genre WEB FORMAT
	  video: 'CINEMA'
	};
	for (const k of Object.keys(ttMap)) {
	  if (tt.includes(k)) { cat = ttMap[k]; break; }
	}
  
	// 2) Overrides par genres “forts”
	const strong = [
	  { test: ['documentary'], to: 'DOCUMENTARY & TV REPORT' },
	  { test: ['animation'],   to: 'ANIMATION' },
	  { test: ['music','musical'], to: 'MUSIC & LIVE' },
	  { test: ['sport'],       to: 'SPORT' },
	  { test: ['game','gameshow','game-show','reality','reality-tv','talkshow','talk-show','news'], to: 'TV SHOW' },
	  { test: ['educational','education','edutainment'], to: 'EDUTAINMENT' }
	];
	for (const s of strong) {
	  if (s.test.some(t => g.includes(t))) { cat = s.to; break; }
	}
  
	const finalCat = cat || 'CINEMA';
	return ALLOWED_CATEGORIES.has(finalCat) ? finalCat : 'CINEMA';
  };
  
  // ===== Saison ===== (ok)
  export const extractSeasonFromTitle = (title: string): string | null => {
	const seasonMatch = title.match(/(saison\s*\d+|season\s*\d+|s\s*\d+)/i);
	if (!seasonMatch) return null;
	const numberMatch = seasonMatch[0].match(/\d+/);
	if (!numberMatch) return null;
	return `(Saison ${parseInt(numberMatch[0])})`;
  };
  