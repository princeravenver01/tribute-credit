// Philippine Administrative Regions, Provinces, Cities/Municipalities, and Sample Barangays
export interface ProvinceData {
  name: string;
  cities: {
    name: string;
    barangays: string[];
  }[];
}

export const PH_LOCATIONS: Record<string, { cities: { name: string; barangays: string[] }[] }> = {
  'Metro Manila (NCR)': {
    cities: [
      { name: 'Manila', barangays: ['Barangay 1', 'Barangay 2', 'Ermita', 'Malate', 'Paco', 'Sampaloc', 'Santa Ana', 'Santa Cruz', 'Tondo'] },
      { name: 'Quezon City', barangays: ['Batasan Hills', 'Commonwealth', 'Cubao', 'Diliman', 'Holy Spirit', 'Loyola Heights', 'Novalliches', 'Project 4', 'Tatalon'] },
      { name: 'Taguig', barangays: ['Bagumbayan', 'Fort Bonifacio', 'Hagonoy', 'Lower Bicutan', 'Signal Village', 'Upper Bicutan', 'Western Bicutan'] },
      { name: 'Makati', barangays: ['Bel-Air', 'Bangkal', 'Guadalupe Nuevo', 'Poblacion', 'San Antonio', 'San Lorenzo', 'Urdaneta'] },
      { name: 'Pasig', barangays: ['Caniogan', 'Kapitolyo', 'Manggahan', 'Maybunga', 'Oranbo', 'Pinagbuhatan', 'Rosario', 'San Joaquin'] },
    ]
  },
  'Cebu': {
    cities: [
      { name: 'Cebu City', barangays: ['Apas', 'Banilad', 'Guadalupe', 'Lahug', 'Mabolo', 'Pardo', 'Talamban', 'Tisa'] },
      { name: 'Mandaue City', barangays: ['Bakilid', 'Banilad', 'Cabancalan', 'Centro', 'Maguikay', 'Subangdaku', 'Tipolo'] },
      { name: 'Lapu-Lapu City', barangays: ['Basak', 'Gun-ob', 'Maribago', 'Mactan', 'Pajo', 'Pusok', 'Subabasbas'] },
    ]
  },
  'Davao del Sur': {
    cities: [
      { name: 'Davao City', barangays: ['Agdao', 'Buhangin', 'Matina Crossing', 'Poblacion', 'Talomo', 'Toril', 'Bucana', 'Mintal'] },
      { name: 'Digos City', barangays: ['Aplaya', 'Cogon', 'Colorado', 'Kapatagan', 'San Jose', 'Zone 1', 'Zone 2', 'Zone 3'] },
    ]
  },
  'Davao del Norte': {
    cities: [
      { name: 'Tagum City', barangays: ['Apokon', 'Canocotan', 'Magugpo East', 'Magugpo North', 'Magugpo Poblacion', 'Magugpo South', 'Magugpo West', 'Mankilam', 'San Miguel', 'Visayan Village'] },
      { name: 'Panabo City', barangays: ['Cagangohan', 'Gredu', 'New Pandan', 'San Francisco', 'Santo Niño'] },
    ]
  },
  'Pampanga': {
    cities: [
      { name: 'San Fernando City', barangays: ['Dolores', 'Juliana', 'Magliman', 'San Agustin', 'San Jose', 'Sindalan', 'Telabastagan'] },
      { name: 'Angeles City', barangays: ['Balibago', 'Cutcut', 'Malabanias', 'Pulung Maragul', 'Santo Rosario'] },
    ]
  },
  'Cavite': {
    cities: [
      { name: 'Bacoor City', barangays: ['Habay', 'Molino I', 'Molino II', 'Molino III', 'Niog', 'Panapaan', 'Talaba'] },
      { name: 'Imus City', barangays: ['Alapan', 'Anabu', 'Bucandala', 'Malagasang', 'Poblacion', 'Tanzang Luma'] },
      { name: 'Dasmariñas City', barangays: ['Burol', 'Fatima', 'Langkaan', 'Paliparan', 'Salawag', 'Sampaloc'] },
    ]
  },
  'Laguna': {
    cities: [
      { name: 'Santa Rosa City', barangays: ['Balibago', 'Don Jose', 'Dita', 'Macabling', 'Tagapo'] },
      { name: 'Calamba City', barangays: ['Canlubang', 'Halang', 'Makiling', 'Parian', 'Real'] },
    ]
  },
  'Iloilo': {
    cities: [
      { name: 'Iloilo City', barangays: ['Jaro', 'La Paz', 'Mandurriao', 'Molo', 'Villa Arevalo', 'City Proper'] },
    ]
  },
  'Misamis Oriental': {
    cities: [
      { name: 'Cagayan de Oro City', barangays: ['Carmen', 'Kauswagan', 'Lapasan', 'Macasandig', 'Nazareth', 'Puntod'] },
    ]
  }
};

export const COUNTRY_CODES = [
  { code: '+63', flag: '🇵🇭', country: 'Philippines' },
  { code: '+1', flag: '🇺🇸', country: 'United States' },
  { code: '+1', flag: '🇨🇦', country: 'Canada' },
  { code: '+65', flag: '🇸🇬', country: 'Singapore' },
  { code: '+81', flag: '🇯🇵', country: 'Japan' },
  { code: '+82', flag: '🇰🇷', country: 'South Korea' },
  { code: '+971', flag: '🇦🇪', country: 'United Arab Emirates' },
  { code: '+966', flag: '🇸🇦', country: 'Saudi Arabia' },
  { code: '+44', flag: '🇬🇧', country: 'United Kingdom' },
  { code: '+61', flag: '🇦🇺', country: 'Australia' },
  { code: '+852', flag: '🇭🇰', country: 'Hong Kong' },
  { code: '+886', flag: '🇹🇼', country: 'Taiwan' },
  { code: '+60', flag: '🇲🇾', country: 'Malaysia' },
  { code: '+62', flag: '🇮🇩', country: 'Indonesia' },
  { code: '+66', flag: '🇹🇭', country: 'Thailand' },
  { code: '+84', flag: '🇻🇳', country: 'Vietnam' },
  { code: '+39', flag: '🇮🇹', country: 'Italy' },
  { code: '+34', flag: '🇪🇸', country: 'Spain' },
  { code: '+49', flag: '🇩🇪', country: 'Germany' },
  { code: '+974', flag: '🇶🇦', country: 'Qatar' },
  { code: '+965', flag: '🇰🇼', country: 'Kuwait' },
  { code: '+973', flag: '🇧🇭', country: 'Bahrain' },
  { code: '+968', flag: '🇴🇲', country: 'Oman' },
];

export const GOV_ID_TYPES = [
  'PH National ID (PhilSys)',
  'Passport',
  "Driver's License",
  'SSS (Social Security System)',
  'GSIS (Government Service Insurance System)',
  'UMID (Unified Multi-Purpose ID)',
  'TIN (Tax Identification Number)',
  'PRC ID (Professional Regulation Commission)',
  'Postal ID',
  "Voter's ID",
  'Senior Citizen ID',
  'OFW ID',
  'Barangay ID',
  'Other'
];
