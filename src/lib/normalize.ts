
export const normalizeLanguage = (code: string): string => {
	const map: Record<string, string> = {
		af: 'Afrikaans',
		sq: 'Albanian',
		am: 'Amharic',
		ar: 'Arabic',
		hy: 'Armenian',
		az: 'Azerbaijani',
		bn: 'Bengali',
		bs: 'Bosnian',
		bg: 'Bulgarian',
		ca: 'Catalan',
		zh: 'Chinese (Mandarin)',
		zh_cn: 'Chinese (Mandarin)',
		zh_tw: 'Chinese (Cantonese)',
		hr: 'Croatian',
		cs: 'Czech',
		da: 'Danish',
		nl: 'Dutch',
		en: 'English',
		et: 'Estonian',
		fa: 'Farsi (Persian)',
		tl: 'Filipino, Tagalog',
		fi: 'Finnish',
		fr: 'French',
		fr_ca: 'French (Canada)',
		ka: 'Georgian',
		de: 'German',
		el: 'Greek',
		gu: 'Gujarati',
		ht: 'Haitian Creole',
		ha: 'Hausa',
		he: 'Hebrew',
		hi: 'Hindi',
		hu: 'Hungarian',
		is: 'Icelandic',
		id: 'Indonesian',
		ga: 'Irish',
		it: 'Italian',
		ja: 'Japanese',
		kn: 'Kannada',
		kk: 'Kazakh',
		ko: 'Korean',
		lv: 'Latvian',
		lt: 'Lithuanian',
		mk: 'Macedonian',
		ms: 'Malay',
		ml: 'Malayalam',
		mt: 'Maltese',
		mr: 'Marathi',
		mn: 'Mongolian',
		no: 'Norwegian (Bokmål)',
		ps: 'Pashto',
		pl: 'Polish',
		pt_br: 'Portuguese (Brazil)',
		pt: 'Portuguese (Portugal)',
		pa: 'Punjabi',
		ro: 'Romanian',
		ru: 'Russian',
		sr: 'Serbian',
		si: 'Sinhala',
		sk: 'Slovak',
		sl: 'Slovenian',
		so: 'Somali',
		es: 'Spanish',
		es_mx: 'Spanish (Mexico)',
		sw: 'Swahili',
		sv: 'Swedish',
		ta: 'Tamil',
		te: 'Telugu',
		th: 'Thai',
		tr: 'Turkish',
		uk: 'Ukrainian',
		ur: 'Urdu',
		uz: 'Uzbek',
		vi: 'Vietnamese',
		cy: 'Welsh',
		dari: 'Dari',
		dar: 'Dari'
	}

	const formatted = code.trim().toLowerCase().replace(/[-_]/g, '')

	const output = map[formatted]
	const allowedLanguages = new Set([
		'Afrikaans', 'Albanian', 'Amharic', 'Arabic', 'Armenian',
		'Azerbaijani', 'Bengali', 'Bosnian', 'Bulgarian', 'Catalan',
		'Chinese (Mandarin)', 'Chinese (Cantonese)', 'Croatian', 'Czech', 'Danish',
		'Dari', 'Dutch', 'English', 'Estonian', 'Farsi (Persian)', 'Filipino, Tagalog',
		'Finnish', 'French', 'French (Canada)', 'Georgian', 'German', 'Greek',
		'Gujarati', 'Haitian Creole', 'Hausa', 'Hebrew', 'Hindi', 'Hungarian',
		'Icelandic', 'Indonesian', 'Irish', 'Italian', 'Japanese', 'Kannada',
		'Kazakh', 'Korean', 'Latvian', 'Lithuanian', 'Macedonian', 'Malay',
		'Malayalam', 'Maltese', 'Marathi', 'Mongolian', 'Norwegian (Bokmål)',
		'Pashto', 'Polish', 'Portuguese (Brazil)', 'Portuguese (Portugal)', 'Punjabi',
		'Romanian', 'Russian', 'Serbian', 'Sinhala', 'Slovak', 'Slovenian', 'Somali',
		'Spanish', 'Spanish (Mexico)', 'Swahili', 'Swedish', 'Tamil', 'Telugu',
		'Thai', 'Turkish', 'Ukrainian', 'Urdu', 'Uzbek', 'Vietnamese', 'Welsh'
	])

	return allowedLanguages.has(output || '') ? output! : 'Unknown'
}

// 🎭 Genres — IMDb → nomenclature Bunqer strict
export const normalizeGenre = (imdbGenre: string): string => {
	const map: Record<string, string> = {
		Action: 'ACTION',
		Adventure: 'ADVENTURE',
		Animation: 'ANIMATION',
		Biography: 'BIOPIC',
		Comedy: 'COMEDY',
		Crime: 'CRIME',
		Documentary: 'DOCUMENTARY & TV REPORT',
		Drama: 'DRAMA',
		Family: 'KIDS',
		Fantasy: 'FANTASY',
		History: 'HISTORICAL',
		Horror: 'HORROR',
		Music: 'MUSIC',
		Musical: 'MUSIC',
		Mystery: 'THRILLER / SUSPENSE',
		Romance: 'ROMANCE',
		'Science Fiction': 'SCIENCE-FICTION',
		'Sci-Fi': 'SCIENCE-FICTION',
		SciFi: 'SCIENCE-FICTION',
		Short: 'WEB FORMAT',
		Sport: 'SPORT',
		Thriller: 'THRILLER / SUSPENSE',
		War: 'WAR',
		Western: 'WESTERN',
		GameShow: 'GAME',
		Reality: 'TV SHOW',
		TalkShow: 'TV SHOW',
		Experimental: 'ART',
		News: 'TV SHOW',
		Educational: 'EDUCATION',
		Education: 'EDUCATION'
	}

	const clean = imdbGenre.trim()
	const value = map[clean] || clean.toUpperCase()

	const allowed = new Set([
		'ACTION', 'ADVENTURE', 'ART', 'BIOPIC', 'BUSINESS', 'CHARM', 'COMEDY',
		'CRIME', 'DRAMA', 'EDUCATION', 'FANTASY', 'FOOD', 'GAME', 'HISTORICAL',
		'HORROR', 'KIDS', 'LIFESTYLE', 'MUSIC', 'NATURE', 'ROMANCE', 'SCIENCE',
		'SCIENCE-FICTION', 'SOCIETAL', 'SPORT', 'TECH', 'THRILLER / SUSPENSE',
		'TRAVEL', 'WAR', 'WEB FORMAT', 'WESTERN'
	])

	return allowed.has(value) ? value : 'DRAMA'
}

// 🌍 Pays — correction vers libellé Bunqer
export const normalizeCountry = (country: string): string => {
	const map: Record<string, string> = {
		'USA': 'United States',
		'United States of America': 'United States',
		'US': 'United States',

		'UK': 'United Kingdom',
		'Great Britain': 'United Kingdom',
		'England': 'United Kingdom',

		'Republic of Korea': 'Korea (South)',
		'South Korea': 'Korea (South)',
		'Korea, Republic of': 'Korea (South)',

		'North Korea': 'Korea (North)',
		'Korea, Democratic People\'s Republic of': 'Korea (North)',

		'Russian Federation': 'Russia',
		'Viet Nam': 'Vietnam',

		'Iran, Islamic Republic of': 'Iran',
		'Syria Arab Republic': 'Syria',
		'Iraq, Republic of': 'Iraq',

		'Bolivia (Plurinational State of)': 'Bolivia',
		'Moldova, Republic of': 'Moldova',
		'Tanzania, United Republic of': 'Tanzania',
		'Venezuela, Bolivarian Republic of': 'Venezuela',

		'Palestinian Territories': 'Palestine',
		'Occupied Palestinian Territory': 'Palestine',

		'Democratic Republic of Congo': 'Democratic Republic of the Congo',
		'Congo, Democratic Republic of the': 'Democratic Republic of the Congo',
		'Congo, Republic of the': 'Republic of the Congo',
		'Republic of the Congo': 'Republic of the Congo',
		'Congo': 'Republic of the Congo',

		'Cape Verde': 'Cabo Verde',
		'Cabo Verde': 'Cabo Verde',

		'Myanmar': 'Myanmar',
		'Burma': 'Myanmar',

		'Brunei Darussalam': 'Brunei',
		'Laos': 'Laos',

		'Ivory Coast': "Ivory Coast (Côte d'Ivoire)",

		'Czechia': 'Czech Republic',

		'Libyan Arab Jamahiriya': 'Libya',
		'Libyan Arab Republic': 'Libya',

		'Hong Kong SAR': 'Hong Kong',
		'China, Hong Kong SAR': 'Hong Kong',
		'Macao': 'Macau',
		'Macau SAR': 'Macau',
		'China, Macao SAR': 'Macau',

		// Autres correspondances directes IMDb → nomenclature Bunqer
		'Albania': 'Albania',
		'Algeria': 'Algeria',
		'Andorra': 'Andorra',
		'Angola': 'Angola',
		'Argentina': 'Argentina',
		'Armenia': 'Armenia',
		'Australia': 'Australia',
		'Austria': 'Austria',
		'Azerbaijan': 'Azerbaijan',
		'Bahamas': 'Bahamas',
		'Bahrain': 'Bahrain',
		'Bangladesh': 'Bangladesh',
		'Barbados': 'Barbados',
		'Belarus': 'Belarus',
		'Belgium': 'Belgium',
		'Benin': 'Benin',
		'Bhutan': 'Bhutan',
		'Bolivia': 'Bolivia',
		'Bosnia and Herzegovina': 'Bosnia and Herzegovina',
		'Botswana': 'Botswana',
		'Brazil': 'Brazil',
		'Brunei': 'Brunei',
		'Bulgaria': 'Bulgaria',
		'Burkina Faso': 'Burkina Faso',
		'Burundi': 'Burundi',
		'Cambodia': 'Cambodia',
		'Cameroon': 'Cameroon',
		'Canada': 'Canada',
		'Chad': 'Chad',
		'Chile': 'Chile',
		'China': 'China',
		'Colombia': 'Colombia',
		'Costa Rica': 'Costa Rica',
		'Croatia': 'Croatia',
		'Cuba': 'Cuba',
		'Cyprus': 'Cyprus',
		'Czech Republic': 'Czech Republic',
		'Denmark': 'Denmark',
		'Djibouti': 'Djibouti',
		'Dominica': 'Dominica',
		'Dominican Republic': 'Dominican Republic',
		'Ecuador': 'Ecuador',
		'Egypt': 'Egypt',
		'El Salvador': 'El Salvador',
		'Equatorial Guinea': 'Equatorial Guinea',
		'Estonia': 'Estonia',
		'Ethiopia': 'Ethiopia',
		'Finland': 'Finland',
		'France': 'France',
		'Gabon': 'Gabon',
		'Gambia': 'Gambia',
		'Georgia': 'Georgia',
		'Germany': 'Germany',
		'Ghana': 'Ghana',
		'Greece': 'Greece',
		'Grenada': 'Grenada',
		'Guatemala': 'Guatemala',
		'Guinea': 'Guinea',
		'Guinea-Bissau': 'Guinea-Bissau',
		'Guyana': 'Guyana',
		'Haiti': 'Haiti',
		'Honduras': 'Honduras',
		'Hungary': 'Hungary',
		'Iceland': 'Iceland',
		'India': 'India',
		'Indonesia': 'Indonesia',
		'Iran': 'Iran',
		'Iraq': 'Iraq',
		'Ireland': 'Ireland',
		'Israel': 'Israel',
		'Italy': 'Italy',
		'Ivory Coast (Côte d\'Ivoire)': "Ivory Coast (Côte d'Ivoire)",
		'Jamaica': 'Jamaica',
		'Japan': 'Japan',
		'Jordan': 'Jordan',
		'Kazakhstan': 'Kazakhstan',
		'Kenya': 'Kenya',
		'Kuwait': 'Kuwait',
		'Kyrgyzstan': 'Kyrgyzstan',
		'Latvia': 'Latvia',
		'Lebanon': 'Lebanon',
		'Lesotho': 'Lesotho',
		'Liberia': 'Liberia',
		'Libya': 'Libya',
		'Liechtenstein': 'Liechtenstein',
		'Lithuania': 'Lithuania',
		'Luxembourg': 'Luxembourg',
		'Madagascar': 'Madagascar',
		'Malawi': 'Malawi',
		'Malaysia': 'Malaysia',
		'Mali': 'Mali',
		'Malta': 'Malta',
		'Mauritania': 'Mauritania',
		'Mauritius': 'Mauritius',
		'Mexico': 'Mexico',
		'Moldova': 'Moldova',
		'Monaco': 'Monaco',
		'Mongolia': 'Mongolia',
		'Montenegro': 'Montenegro',
		'Morocco': 'Morocco',
		'Mozambique': 'Mozambique',
		'Namibia': 'Namibia',
		'Nepal': 'Nepal',
		'Netherlands': 'Netherlands',
		'New Zealand': 'New Zealand',
		'Nicaragua': 'Nicaragua',
		'Niger': 'Niger',
		'Nigeria': 'Nigeria',
		'Norway': 'Norway',
		'Oman': 'Oman',
		'Pakistan': 'Pakistan',
		'Panama': 'Panama',
		'Papua New Guinea': 'Papua New Guinea',
		'Paraguay': 'Paraguay',
		'Peru': 'Peru',
		'Philippines': 'Philippines',
		'Poland': 'Poland',
		'Portugal': 'Portugal',
		'Qatar': 'Qatar',
		'Romania': 'Romania',
		'Russia': 'Russia',
		'Rwanda': 'Rwanda',
		'Saudi Arabia': 'Saudi Arabia',
		'Senegal': 'Senegal',
		'Serbia': 'Serbia',
		'Sierra Leone': 'Sierra Leone',
		'Singapore': 'Singapore',
		'Slovakia': 'Slovakia',
		'Slovenia': 'Slovenia',
		'South Africa': 'South Africa',
		'Spain': 'Spain',
		'Sri Lanka': 'Sri Lanka',
		'Suriname': 'Suriname',
		'Sweden': 'Sweden',
		'Switzerland': 'Switzerland',
		'Syria': 'Syria',
		'Taiwan': 'Taiwan',
		'Tajikistan': 'Tajikistan',
		'Tanzania': 'Tanzania',
		'Thailand': 'Thailand',
		'Togo': 'Togo',
		'Tunisia': 'Tunisia',
		'Turkey': 'Turkey',
		'Turkmenistan': 'Turkmenistan',
		'Uganda': 'Uganda',
		'Ukraine': 'Ukraine',
		'United Arab Emirates': 'United Arab Emirates',
		'United Kingdom': 'United Kingdom',
		'United States': 'United States',
		'Uruguay': 'Uruguay',
		'Uzbekistan': 'Uzbekistan',
		'Vatican City': 'Vatican City',
		'Venezuela': 'Venezuela',
		'Vietnam': 'Vietnam',
		'Zambia': 'Zambia',
		'Zimbabwe': 'Zimbabwe'
	}

	const cleaned = country.trim()
	return map[cleaned] || 'Unknown'
}

// 🏷️ Catégorie — stricte nomenclature Bunqer
export const deduceCategory = (
	mediaType: string,
	genre?: string,
	titleTypeId?: string
): string => {
	const allowedCategories = new Set([
		'ANIMATION',
		'CINEMA',
		'DOCUMENTARY & TV REPORT',
		'MUSIC & LIVE',
		'SERIE & TELENOVELAS',
		'SPORT',
		'TV MOVIE',
		'TV SHOW',
		'EDUTAINMENT'
	])

	const type = titleTypeId?.toLowerCase() || ''
	const genreLower = genre?.toLowerCase() || ''

	let category = 'CINEMA'

	if (type.includes('tvseries') || type.includes('miniseries')) {
		category = 'SERIE & TELENOVELAS'
	} else if (type.includes('tvmovie')) {
		category = 'TV MOVIE'
	} else if (type.includes('documentary')) {
		category = 'DOCUMENTARY & TV REPORT'
	} else if (type.includes('reality') || type.includes('gameshow') || type.includes('talkshow')) {
		category = 'TV SHOW'
	} else if (type.includes('animation')) {
		category = 'ANIMATION'
	} else if (genreLower.includes('documentary')) {
		category = 'DOCUMENTARY & TV REPORT'
	} else if (genreLower.includes('music')) {
		category = 'MUSIC & LIVE'
	} else if (genreLower.includes('sport')) {
		category = 'SPORT'
	} else if (genreLower.includes('animation')) {
		category = 'ANIMATION'
	} else if (genreLower.includes('game') || genreLower.includes('show')) {
		category = 'TV SHOW'
	} else if (genreLower.includes('education') || genreLower.includes('edutainment')) {
		category = 'EDUTAINMENT'
	}

	return allowedCategories.has(category) ? category : 'CINEMA'
}

// 🧠 Saison depuis un texte
export const extractSeasonFromTitle = (title: string): string | null => {
	const seasonMatch = title.match(/(saison\s*\d+|season\s*\d+|s\s*\d+)/i)
	if (!seasonMatch) return null

	const numberMatch = seasonMatch[0].match(/\d+/)
	if (!numberMatch) return null

	return `(Saison ${parseInt(numberMatch[0])})`
}
