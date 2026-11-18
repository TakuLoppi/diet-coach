const pad = (n: number) => String(n).padStart(2, '0');
const WEEK = '日月火水木金土';

export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => toKey(new Date());

export const fromKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (k: string, n: number) => {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
};

/** b - a（日数） */
export const diffDays = (a: string, b: string) =>
  Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86400000);

export const fmtJP = (k: string) => {
  const d = fromKey(k);
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEK[d.getDay()]}）`;
};

export const fmtShort = (k: string) => {
  const d = fromKey(k);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

export const weekday = (k: string) => WEEK[fromKey(k).getDay()];
