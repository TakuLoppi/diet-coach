import type { Analysis, MealItem, Weekly } from '../db';

/** Claudeの返答からJSONオブジェクトを取り出す（最後のコードブロックを優先） */
export function extractJson(text: string): Record<string, unknown> | null {
  const candidates: string[] = [];
  const blocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  candidates.push(...blocks.reverse());
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));
  for (const c of candidates) {
    try {
      const cleaned = c.trim().replace(/,\s*([}\]])/g, '$1');
      const obj = JSON.parse(cleaned);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj as Record<string, unknown>;
    } catch {
      /* 次の候補へ */
    }
  }
  return null;
}

const num = (x: unknown) => (typeof x === 'number' && isFinite(x) ? Math.round(x) : typeof x === 'string' && x.trim() !== '' && isFinite(Number(x)) ? Math.round(Number(x)) : undefined);
const str = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : undefined);
const strs = (x: unknown) => (Array.isArray(x) ? x.map(str).filter((s): s is string => !!s) : []);
const isDate = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);

export type Parsed =
  | { kind: 'daily'; analysis: Analysis }
  | { kind: 'weekly'; weekly: Weekly }
  | { kind: 'error'; message: string };

export function parseReply(text: string, fallbackDate: string): Parsed {
  const o = extractJson(text);
  if (!o) return { kind: 'error', message: '返答の中に取り込み用のJSONが見つかりません。返答全体をコピーしたか確認してください。' };
  const now = Date.now();
  if (o.type === 'weekly') {
    return {
      kind: 'weekly',
      weekly: { weekEnd: isDate(o.weekEnd) ? o.weekEnd : fallbackDate, theme: str(o.theme), summary: str(o.summary), raw: text, importedAt: now },
    };
  }
  const meals = Array.isArray(o.meals)
    ? o.meals
        .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
        .map((m) => ({
          slot: str(m.slot) ?? 'snack',
          items: (Array.isArray(m.items) ? m.items : [])
            .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
            .map((i): MealItem => ({ name: str(i.name) ?? '不明', amount: str(i.amount), kcal: num(i.kcal) })),
        }))
    : undefined;
  return {
    kind: 'daily',
    analysis: {
      date: isDate(o.date) ? o.date : fallbackDate,
      grade: str(o.grade),
      kcal: num(o.kcal),
      protein: num(o.protein),
      fat: num(o.fat),
      carbs: num(o.carbs),
      meals,
      good: strs(o.good),
      bad: strs(o.bad),
      todo: strs(o.todo),
      coach: str(o.coach),
      raw: text,
      importedAt: now,
    },
  };
}

/** ショートカットがコピーする「DIETLOG date=2026-11-17 steps=8123 sleep=6.5」を読む */
export function parseHealth(text: string): { date?: string; steps?: number; sleep?: number } | null {
  const date = text.match(/date\s*[=:]\s*(\d{4}-\d{2}-\d{2})/i)?.[1];
  const stepsS = text.match(/steps\s*[=:]\s*([\d,.]+)/i)?.[1];
  const sleepS = text.match(/sleep\s*[=:]\s*([\d,.]+)/i)?.[1];
  if (!date && !stepsS && !sleepS) return null;
  const steps = stepsS ? Math.round(Number(stepsS.replace(/,/g, ''))) : undefined;
  let sleep = sleepS ? Number(sleepS.replace(/,/g, '')) : undefined;
  // ショートカットの設定次第で単位が変わるため、値の大きさで判定する
  if (sleep != null && sleep > 1440) sleep = sleep / 3600; // 秒
  else if (sleep != null && sleep > 24) sleep = sleep / 60; // 分
  return {
    date,
    steps: steps != null && isFinite(steps) ? steps : undefined,
    sleep: sleep != null && isFinite(sleep) && sleep > 0 ? Math.round(sleep * 10) / 10 : undefined,
  };
}
