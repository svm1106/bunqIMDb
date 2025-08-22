// src/lib/allowedKeywords.ts
export const ALLOWED_KEYWORDS: string[] = [
    // =========================
    // Genres (larges + dérivés)
    // =========================
    'drama','comedy','action','thriller','horror','fantasy','romance','sci-fi','science-fiction','mystery',
    'crime','adventure','documentary','biography','biopic','animation','family','music','musical','war',
    'history','historical','sport','western','supernatural','superhero','noir','indie','dramedy','rom-com',
    'crime-drama','legal-drama','medical-drama','political-drama','teen-drama','period-drama','melodrama',
    'psychological-thriller','political-thriller','techno-thriller','conspiracy-thriller','erotic-thriller',
    'survival-thriller','disaster','catastrophe','apocalypse','post-apocalyptic','dystopia','utopia',
    'space-opera','hard-sci-fi','time-travel','alternate-history','first-contact','cyberpunk','biopunk',
    'steampunk','dieselpunk','nano-tech','ai','robot','mecha','virtual-reality','metaverse','genetic-engineering',
    'dark-fantasy','urban-fantasy','high-fantasy','sword-and-sorcery','grimdark','mythology','fairy-tale','folk-tale',
    'occult','paranormal','haunted-house','ghost-story','possession','exorcism','witchcraft','vampire','zombie',
    'werewolf','creature-feature','monster','body-horror','cosmic-horror','folk-horror','eco-horror','slasher',
    'found-footage','giallo','splatter','black-comedy','dark-comedy','satire','parody','slapstick','workplace-comedy',
    'sketch-comedy','stand-up','mockumentary','docudrama','true-story','true-crime',
  
    // =========================
    // Tons / styles / publics
    // =========================
    'dark','light','slow','fast','gritty','campy','feel-good','emotional','epic','intense','suspense','mature',
    'kids','children','teen','young-adult','adult','family-friendly','all-ages','wholesome','heartwarming',
    'bittersweet','bleak','hopeful','romantic','tragic','uplifting','edgy','stylized','minimalist','experimental',
    'arthouse','blockbuster','independent','low-budget','micro-budget','cult-classic','mainstream','black-and-white',
    'silent-film','3d','imax','handheld','found-footage-style','single-take','stop-motion','cgi','practical-effects',
  
    // =========================
    // Formats / TV / narration
    // =========================
    'feature','short','short-film','feature-film','tv-movie','tv-special','tv-series','limited-series','mini-series',
    'miniseries','sitcom','reality','reality-competition','talent-show','cooking-competition','dating-show',
    'makeover','home-renovation','survival-game','docuseries','news','investigative','reportage','magazine',
    'anthology','serial','procedural','crime-procedural','police-procedural','courtroom','legal','medical',
    'soap-opera','telenovela','anime','kids-animation','preschool','educational','variety-show',
  
    // =========================
    // Thèmes / motifs narratifs
    // =========================
    'love','forbidden-love','unrequited-love','second-chance-romance','friends-to-lovers','enemies-to-lovers',
    'love-triangle','coming-of-age','rags-to-riches','fish-out-of-water','redemption','revenge','betrayal',
    'loyalty','honor','duty','sacrifice','identity','self-discovery','found-family','family-drama','parenthood',
    'marriage','divorce','wedding','pregnancy','adoption','grief','bereavement','illness','disability','addiction',
    'recovery','faith','religion','spirituality','feminism','patriarchy','matriarchy','lgbtq','queer','transgender',
    'friendship','rivals','mentor','team','ensemble','power','politics','geopolitics','corruption','conspiracy',
    'justice','injustice','inequality','class-struggle','gentrification','migration','diaspora','refugees',
    'human-rights','civil-rights','colonialism','post-colonial','war','peacekeeping','survival','freedom','hope',
    'secrets','truth','lies','memory','amnesia','time-loop','mystery','investigation','detective','whodunit',
    'heist','con-artist','double-cross','manhunt','hostage','man-vs-nature','man-vs-machine','man-vs-self',
  
    // =========================
    // Crime / espionnage
    // =========================
    'gangster','mafia','organized-crime','yakuza','triad','cartel','drug','narcotics','drug-bust','money-laundering',
    'white-collar-crime','financial-crime','cybercrime','hacking','ransomware','identity-theft','forensics',
    'cold-case','serial-killer','profiling','vigilante','private-investigator','undercover','informant','sting',
    'spy','espionage','double-agent','assassin','hitman','prison','jailbreak','courtroom-drama','legal-thriller',
    'police','detective','interpol',
  
    // =========================
    // Sciences / tech / société
    // =========================
    'science','physics','chemistry','biology','genetics','evolution','neuroscience','medicine','public-health',
    'pandemic','vaccines','psychology','sociology','anthropology','economics','finance','business','entrepreneurship',
    'startup','technology','ai-ethics','robotics','engineering','architecture','design','urban-planning','transport',
    'energy','renewable-energy','nuclear','climate-change','environment','conservation','biodiversity','poaching',
    'agriculture','farming','food','cooking','gastronomy','cuisine','nutrition','supply-chain','space','astronomy',
    'space-exploration','spaceflight','rocketry','satellites',
  
    // =========================
    // Musiques / arts / culture
    // =========================
    'music','hip-hop','rap','rnb','pop','rock','metal','punk','jazz','blues','classical','folk','country','reggae',
    'afrobeats','k-pop','latin-music','salsa','tango','flamenco','electronic','edm','techno','house','ambient',
    'soundtrack','composer','orchestra','dance','ballet','street-dance','graffiti','street-art','photography',
    'cinema','filmmaking','showbiz','celebrity','fame','influencer','social-media',
  
    // =========================
    // Sports (très large)
    // =========================
    'football-soccer','american-football','basketball','baseball','rugby','cricket','tennis','golf','boxing','mma',
    'wrestling','table-tennis','badminton','volleyball','handball','hockey','ice-hockey','field-hockey',
    'swimming','diving','surfing','sailing','rowing','canoe-kayak','cycling','bmx','mountain-biking','triathlon',
    'athletics','track-and-field','gymnastics','climbing','mountaineering','hiking','skiing','snowboarding',
    'skateboarding','motorsport','formula-1','motogp','rally','equestrian','fencing','archery','shooting-sports',
    'weightlifting','strongman','martial-arts','kung-fu','karate','taekwondo','judo','jiu-jitsu','muay-thai',
  
    // =========================
    // Lieux / décors (généraux)
    // =========================
    'small-town','big-city','capital-city','rural','urban','suburban','village','slum','ghetto','favela','island',
    'archipelago','desert','oasis','savanna','savane','jungle','rainforest','forest','taiga','tundra','wetlands',
    'swamp','marsh','river','lake','waterfall','glacier','mountains','volcano','cave','canyon','beach','coast',
    'sea','ocean','coral-reef','deep-sea','arctic','antarctica','space-station','spaceship','alien-planet',
  
    // =========================
    // Lieux / décors (spécifiques)
    // =========================
    'prison','hospital','clinic','er','icu','morgue','laboratory','factory','warehouse','mine','oil-rig','power-plant',
    'school','high-school','college','university','campus','boarding-school','monastery','church','mosque','temple',
    'museum','library','theater','studio','tv-station','radio-station','newsroom','court','parliament','embassy',
    'airport','airbase','train-station','subway','bus-station','harbor','ship','submarine','military-base','barracks',
    'refugee-camp','orphanage','retirement-home','hotel','motel','restaurant','kitchen','bar','nightclub','casino',
    'farm','ranch','zoo','wildlife-reserve','safari','serengeti','national-park',
  
    // =========================
    // Périodes / époques
    // =========================
    'prehistoric','ancient-egypt','ancient-greece','ancient-rome','biblical','medieval','middle-ages','renaissance',
    'baroque','victorian','edwardian','industrial-revolution','wild-west','roaring-twenties','prohibition',
    'great-depression','ww1','world-war-i','ww2','world-war-ii','post-war','space-race','cold-war','sixties',
    'seventies','eighties','nineties','2000s','2010s','2020s','near-future','distant-future','modern','contemporary',
    'present','future','past',
  
    // =========================
    // Régions / cultures / langues
    // =========================
    'africa','north-africa','west-africa','east-africa','central-africa','southern-africa','maghreb','sahel',
    'europe','western-europe','eastern-europe','nordic','baltic','balkan','mediterranean',
    'asia','middle-east','gulf','south-asia','southeast-asia','east-asia','central-asia',
    'americas','north-america','latin-america','south-america','central-america','caribbean','oceania',
    'francophone','anglophone','hispanic','lusophone','arabic-language','hebrew-language','turkish-language',
    'hindi-language','tamil-language','telugu-language','malayalam-language','bengali-language',
    'mandarin-language','cantonese-language','japanese-language','korean-language','russian-language',
    'german-language','italian-language','portuguese-language','spanish-language','french-language',
    'yoruba-language','swahili-language','zulu-language',
  
    // =========================
    // Nature / faune / environnement
    // =========================
    'nature','wildlife','animals','big-cats','lion','tiger','leopard','cheetah','elephant','rhino','hippo','giraffe',
    'primates','gorilla','chimpanzee','orangutan','bear','wolf','fox','deer','whale','dolphin','shark','octopus',
    'penguin','polar-bear','seal','bird','raptor','eagle','owl','insects','butterfly','bee','ant','reptile','snake',
    'crocodile','turtle','amphibian','frog','salamander','dinosaurs','paleontology','ecosystem','conservation',
    'endangered-species','habitat-loss','climate-crisis','deforestation','wildfire','drought','flood','hurricane',
    'earthquake','volcanic-eruption','tsunami','glaciology','oceanography','meteorology','astronomy-doc',
  
    // =========================
    // Métiers / domaines
    // =========================
    'doctor','nurse','surgeon','paramedic','pharmacist','psychologist','therapist','lawyer','prosecutor','judge',
    'police-officer','detective-inspector','forensic-scientist','journalist','investigative-journalist',
    'photographer','filmmaker','producer','actor','teacher','professor','scientist','engineer','architect','pilot',
    'astronaut','sailor','fisherman','miner','farmer','chef','baker','butcher','winemaker','barista','bartender',
    'firefighter','mountain-rescue','lifeguard','soldier','spy-officer','diplomat','ngo-worker','humanitarian',
  
    // =========================
    // Économie / société
    // =========================
    'money','poverty','wealth','inequality','tax','debt','banking','stock-market','crypto','real-estate','housing',
    'labor','strikes','union','gig-economy','gig-work','industry','manufacturing','logistics','shipping',
    'e-commerce','retail','fashion','luxury','startup-ecosystem','venture-capital','silicon-valley',
  
    // =========================
    // Fêtes / événements
    // =========================
    'holiday','new-year','valentines-day','ramadan','eid','diwali','hanukkah','lunar-new-year','christmas',
    'halloween','easter','thanksgiving','carnival','wedding','festival','film-festival','music-festival',
  
    // =========================
    // Balises utiles / pratiques
    // =========================
    'short','feature','independent','blockbuster','low-budget','micro-series','pilot','spin-off','reboot','remake',
    'sequel','prequel','crossover','based-on-book','based-on-comic','based-on-play','based-on-true-events',
    'archival-footage','behind-the-scenes','making-of','director-cut','extended-edition'
  ]
  