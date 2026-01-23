export const SOURCE_LABELS: Record<string, string> = {
  remotive: 'Remotive',
  'remotive.com': 'Remotive',
  remoteok: 'RemoteOK',
  'remoteok.com': 'RemoteOK',
  'RemoteOK': 'RemoteOK',
  greenhouse: 'Greenhouse',
  'greenhouse.io': 'Greenhouse',
  wellfound: 'Wellfound',
  'angel.co': 'Wellfound',
  indeed: 'Indeed',
  'indeed.com': 'Indeed',
  hh_kz: 'hh.kz',
  'hh.kz': 'hh.kz',
  hh_ru: 'hh.ru',
  'hh.ru': 'hh.ru',
  linkedin: 'LinkedIn',
  'linkedin.com': 'LinkedIn',
  wwr: 'WeWorkRemotely',
  weworkremotely: 'WeWorkRemotely',
  'weworkremotely.com': 'WeWorkRemotely',
  remote_co: 'Remote.co',
  'remote.co': 'Remote.co',
  work_at_startup: 'Work at a Startup',
  workatastartup: 'Work at a Startup',
  'workatastartup.com': 'Work at a Startup',
  glassdoor: 'Glassdoor',
  'glassdoor.com': 'Glassdoor',
  ziprecruiter: 'ZipRecruiter',
  'ziprecruiter.com': 'ZipRecruiter',
  stack_overflow: 'Stack Overflow',
  stackoverflow: 'Stack Overflow',
  'stackoverflow.com': 'Stack Overflow',
  dice: 'Dice',
  'dice.com': 'Dice',
};

const capitalizeWords = (value: string) =>
  value
    .split(/\s+/)
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
    .join(' ');

export const formatSourceLabel = (source?: string | null): string => {
  if (!source) {
    return 'Unknown';
  }

  const trimmed = source.trim();
  if (trimmed.length === 0) {
    return 'Unknown';
  }

  const normalized = trimmed.toLowerCase();
  const mapped = SOURCE_LABELS[normalized];
  if (mapped) {
    return mapped;
  }

  const cleaned = trimmed.replace(/[-_]/g, ' ');
  return capitalizeWords(cleaned);
};
