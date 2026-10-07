export type MobileRole = 'admin' | 'rm' | 're';

const MATRIX: Record<Exclude<MobileRole, 'admin'>, Record<string, string[]>> = {
  rm: { leads: ['view','create','edit','assign','send'], schedule: ['view','create','edit'], customers: ['view','create','edit'], notifications: ['view'] },
  re: { leads: ['view','create','edit','assign','send'], schedule: ['view','create','edit'], customers: ['view','create','edit'], notifications: ['view'] },
};

export function normalizeRole(role?: string | null): MobileRole | null {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'admin') return 'admin';
  if (value === 'rm' || value === 'manager') return 'rm';
  if (value === 're' || value === 'executive') return 're';
  return null;
}

export function can(role: string | null | undefined, resource: string, action: string) {
  const normalized = normalizeRole(role);
  if (normalized === 'admin') return true;
  return Boolean(normalized && MATRIX[normalized]?.[resource]?.includes(action));
}
