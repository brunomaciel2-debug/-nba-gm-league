// Country names translation map EN → PT-PT
// Used when isPT is true to translate country names from the database
export const COUNTRY_PT: Record<string, string> = {
  // Americas
  'USA':'EUA', 'United States':'Estados Unidos', 'Canada':'Canadá',
  'Brazil':'Brasil', 'Argentina':'Argentina', 'Dominican Republic':'República Dominicana',
  'Puerto Rico':'Porto Rico', 'Venezuela':'Venezuela', 'Colombia':'Colômbia',
  'Mexico':'México', 'Panama':'Panamá', 'Trinidad and Tobago':'Trindade e Tobago',
  'Bahamas':'Bahamas', 'Jamaica':'Jamaica',
  // Europe
  'France':'França', 'Spain':'Espanha', 'Germany':'Alemanha', 'Italy':'Itália',
  'Greece':'Grécia', 'Serbia':'Sérvia', 'Croatia':'Croácia', 'Slovenia':'Eslovénia',
  'Lithuania':'Lituânia', 'Latvia':'Letónia', 'Montenegro':'Montenegro',
  'Bosnia':'Bósnia', 'Bosnia and Herzegovina':'Bósnia e Herzegovina',
  'Turkey':'Turquia', 'Russia':'Rússia', 'Ukraine':'Ucrânia',
  'Czech Republic':'República Checa', 'Poland':'Polónia', 'Hungary':'Hungria',
  'Romania':'Roménia', 'Georgia':'Geórgia', 'Belarus':'Bielorrússia',
  'Netherlands':'Holanda', 'Belgium':'Bélgica', 'Sweden':'Suécia',
  'Norway':'Noruega', 'Denmark':'Dinamarca', 'Finland':'Finlândia',
  'Switzerland':'Suíça', 'Austria':'Áustria', 'Portugal':'Portugal',
  'Israel':'Israel', 'North Macedonia':'Macedónia do Norte',
  'Slovakia':'Eslováquia', 'Bulgaria':'Bulgária', 'Albania':'Albânia', 'Kosovo':'Kosovo',
  'Iceland':'Islândia', 'Estonia':'Estónia', 'Moldova':'Moldávia',
  // Africa
  'Nigeria':'Nigéria', 'Senegal':'Senegal', 'Cameroon':'Camarões',
  'Congo':'Congo', 'Democratic Republic of Congo':'República Democrática do Congo',
  'DR Congo':'RD Congo', 'Angola':'Angola', 'Mali':'Mali',
  'Ivory Coast':'Costa do Marfim', "Côte d'Ivoire":'Costa do Marfim',
  'South Africa':'África do Sul', 'Egypt':'Egito', 'Morocco':'Marrocos',
  'Tunisia':'Tunísia', 'Algeria':'Argélia', 'Kenya':'Quénia', 'Ghana':'Gana',
  'Tanzania':'Tanzânia', 'Sudan':'Sudão', 'Ethiopia':'Etiópia',
  'Guinea':'Guiné', 'South Sudan':'Sudão do Sul', 'Cape Verde':'Cabo Verde',
  'Gabon':'Gabão', 'Mozambique':'Moçambique', 'Rwanda':'Ruanda',
  'Uganda':'Uganda', 'Zimbabwe':'Zimbábue',
  // Asia / Oceania
  'Australia':'Austrália', 'New Zealand':'Nova Zelândia',
  'China':'China', 'Japan':'Japão', 'South Korea':'Coreia do Sul',
  'Philippines':'Filipinas', 'Iran':'Irão', 'Lebanon':'Líbano',
  'Jordan':'Jordânia', 'Saudi Arabia':'Arábia Saudita', 'Qatar':'Catar',
  'UAE':'Emirados Árabes', 'India':'Índia', 'Taiwan':'Taiwan',
  'Indonesia':'Indonésia', 'Mongolia':'Mongólia',
}

/** Returns translated country name if PT is active, otherwise returns the original */
export function countryName(name: string | null | undefined, isPT: boolean): string {
  if (!name) return ''
  if (!isPT) return name
  return COUNTRY_PT[name] ?? name
}
