export const MAX_MAP_LOADS = 300;

const keyFor = (uid: string) => `trippin:mapLoadCount:${uid}`;

export const getCount = (uid: string): number => {
  if (!uid) return 0;
  const raw = localStorage.getItem(keyFor(uid));
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export const incrementCount = (uid: string): number => {
  const next = getCount(uid) + 1;
  localStorage.setItem(keyFor(uid), String(next));
  return next;
};

export const isAtLimit = (uid: string): boolean => getCount(uid) >= MAX_MAP_LOADS;
