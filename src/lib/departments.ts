export const DEPARTMENTS = [
  'Board',
  'OPS - General Support',
  'OPS - Project',
  'People & Culture',
  'Technology',
] as const;

export const DEPARTMENT_OPTIONS = DEPARTMENTS.map((d) => ({ value: d, label: d }));
