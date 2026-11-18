import type { Activity, DayLog, Profile } from '../db';
import { addDays, diffDays } from './dates';

const ACT: Record<Activity, number> = { low: 1.375, mid: 1.55, high: 1.725 };
export const ACT_LABEL: Record<Activity, string> = {
  low: '低い（デスクワーク中心）',
  mid: '普通（立ち仕事・よく歩く）',
  high: '高い（肉体労働・よく運動する）',
};

/** 基礎代謝（Mifflin-St Jeor式） */
export function bmr(p: Profile, w: number) {
  return Math.round(10 * w + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161));
}

export function tdee(p: Profile, w: number) {
  return Math.round(bmr(p, w) * ACT[p.activity]);
}

export interface Targets {
  bmr: number;
  tdee: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  water: number;
  steps: number;
}

/** 1日の目標。目標日があれば逆算、なければ1日500kcalの赤字。基礎代謝は下回らない */
export function targets(p: Profile, w: number, today: string): Targets {
  const B = bmr(p, w);
  const T = tdee(p, w);
  let deficit = 500;
  const remain = w - p.goalWeight;
  if (p.goalDate && remain > 0) {
    const days = diffDays(today, p.goalDate);
    if (days > 0) deficit = (remain * 7200) / days;
  }
  deficit = remain > 0 ? Math.min(750, Math.max(250, deficit)) : 0;
  const kcal = Math.max(B, Math.round((T - deficit) / 10) * 10);
  const protein = Math.round(w * 1.5);
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const water = Math.round((w * 35) / 100) * 100;
  return { bmr: B, tdee: T, kcal, protein, fat, carbs, water, steps: p.stepGoal };
}

export const bmi = (p: Profile, w: number) => w / (p.heightCm / 100) ** 2;

export interface WPoint {
  date: string;
  weight: number;
}

export function weightSeries(days: DayLog[]): WPoint[] {
  return days
    .filter((d) => d.weight != null)
    .map((d) => ({ date: d.date, weight: d.weight! }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** date を含む直近 window 日の平均体重 */
export function avgAt(series: WPoint[], date: string, window = 7): number | null {
  const pts = series.filter((s) => {
    const d = diffDays(s.date, date);
    return d >= 0 && d < window;
  });
  if (!pts.length) return null;
  return pts.reduce((a, b) => a + b.weight, 0) / pts.length;
}

export function currentWeight(series: WPoint[], today: string): number | null {
  return avgAt(series, today) ?? series.at(-1)?.weight ?? null;
}

export type Prediction =
  | { status: 'insufficient' }
  | { status: 'reached' }
  | { status: 'flat'; perWeek: number }
  | { status: 'ok'; date: string; perWeek: number };

/** 直近21日の体重の回帰直線から目標達成日を予測（7件以上必要） */
export function predictGoal(series: WPoint[], goal: number, today: string): Prediction {
  const recent = series.filter((s) => {
    const d = diffDays(s.date, today);
    return d >= 0 && d < 21;
  });
  const cur = currentWeight(series, today);
  if (cur != null && cur <= goal) return { status: 'reached' };
  if (recent.length < 7 || cur == null) return { status: 'insufficient' };
  const xs = recent.map((s) => -diffDays(s.date, today));
  const ys = recent.map((s) => s.weight);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my);
    den += (x - mx) ** 2;
  });
  const slope = den ? num / den : 0;
  if (slope > -0.005) return { status: 'flat', perWeek: slope * 7 };
  const days = Math.ceil((cur - goal) / -slope);
  if (days > 730) return { status: 'flat', perWeek: slope * 7 };
  return { status: 'ok', date: addDays(today, days), perWeek: slope * 7 };
}

/** 停滞期：記録開始から14日以上経ち、7日平均が2週間で0.2kg以上減っていない */
export function isPlateau(series: WPoint[], today: string): boolean {
  if (!series.length || diffDays(series[0].date, today) < 14) return false;
  const before = avgAt(series, addDays(today, -14));
  const now = avgAt(series, today);
  if (before == null || now == null) return false;
  return now - before > -0.2;
}

export function hasRecord(d: DayLog) {
  return (
    d.weight != null ||
    Object.values(d.meals ?? {}).some(Boolean) ||
    !!d.water ||
    d.steps != null ||
    !!d.exercise
  );
}

/** 連続記録日数（今日が未記録なら昨日から数える） */
export function streak(recordDates: Set<string>, today: string) {
  let k = recordDates.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (recordDates.has(k)) {
    n++;
    k = addDays(k, -1);
  }
  return n;
}

export const fmt1 = (n: number) => n.toFixed(1);
export const fmtInt = (n: number) => Math.round(n).toLocaleString('ja-JP');
