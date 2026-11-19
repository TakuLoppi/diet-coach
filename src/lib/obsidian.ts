import { db, MEAL_LABEL, MEAL_SLOTS, type Analysis, type DayLog, type MealSlot, type Weekly } from '../db';
import { fmtJP } from './dates';

/** iCloud Drive に作る保存先フォルダ名（Mac側でObsidianの保管庫にリンクする） */
export const OBSIDIAN_FOLDER = 'ダイエットコーチ';

const yaml = (v: string | number | undefined) => (v == null || v === '' ? '' : typeof v === 'number' ? String(v) : JSON.stringify(v));

/** 返答本文からJSONブロックを取り除く */
function prose(raw: string) {
  return raw
    .replace(/```json[\s\S]*?```/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const list = (items: string[]) => items.map((x) => `- ${x}`).join('\n');

function frontmatter(fields: Record<string, string | number | undefined>, tags: string[]) {
  const lines = Object.entries(fields)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}: ${yaml(v)}`);
  return ['---', ...lines, `tags: [${tags.join(', ')}]`, '---'].join('\n');
}

export function dailyFileName(date: string) {
  return `${date} 日次.md`;
}

export function weeklyFileName(weekEnd: string) {
  return `${weekEnd} 週次.md`;
}

export function dailyNote(a: Analysis, day?: DayLog): string {
  const out: string[] = [];
  out.push(
    frontmatter(
      {
        date: a.date,
        grade: a.grade,
        kcal: a.kcal,
        protein: a.protein,
        fat: a.fat,
        carbs: a.carbs,
        weight: day?.weight,
        steps: day?.steps,
        sleep: day?.sleepH,
        water: day?.water,
      },
      ['ダイエット', '日次報告'],
    ),
  );
  out.push(`# ${fmtJP(a.date)} の報告${a.grade ? `（評価 ${a.grade}）` : ''}`);

  if (day) {
    out.push('## 記録');
    const rows: string[] = [];
    if (day.weight != null) rows.push(`- 体重：${day.weight}kg`);
    for (const s of MEAL_SLOTS) {
      const m = day.meals?.[s]?.trim();
      if (m) rows.push(`- ${MEAL_LABEL[s]}：${m}`);
    }
    if (day.water) rows.push(`- 水分：${(day.water / 1000).toFixed(1)}L`);
    if (day.exercise || day.exerciseMin) rows.push(`- 運動：${day.exercise ?? ''}${day.exerciseMin ? `（${day.exerciseMin}分）` : ''}`);
    if (day.steps != null) rows.push(`- 歩数：${day.steps.toLocaleString('ja-JP')}歩`);
    if (day.sleepH != null) rows.push(`- 睡眠：${day.sleepH}時間${day.sleepQ ? `（質 ${day.sleepQ}/5）` : ''}`);
    if (day.mood) rows.push(`- 気分：${day.mood}/5`);
    if (day.hunger) rows.push(`- 空腹感：${day.hunger}/5`);
    if (day.alcohol) rows.push(`- 飲酒：${day.alcohol}`);
    if (day.bowel) rows.push(`- 排便：${day.bowel === 'yes' ? 'あり' : 'なし'}`);
    if (day.memo) rows.push(`- メモ：${day.memo}`);
    out.push(rows.join('\n') || '（記録なし）');
  }

  out.push('## コーチの評価');
  const nut: string[] = [];
  if (a.kcal != null) nut.push(`推定 ${a.kcal}kcal`);
  if (a.protein != null) nut.push(`P ${a.protein}g / F ${a.fat ?? '—'}g / C ${a.carbs ?? '—'}g`);
  if (nut.length) out.push(nut.join('　'));
  if (a.coach) out.push(a.coach.split("\n").map((l) => `> ${l}`).join("\n"));
  if (a.good.length) out.push(`### 良かった点\n${list(a.good)}`);
  if (a.bad.length) out.push(`### 悪かった点\n${list(a.bad)}`);
  if (a.todo.length) out.push(`### やること\n${list(a.todo)}`);
  if (a.meals?.length) {
    out.push(
      '### 食事の推定\n' +
        a.meals
          .map(
            (m) =>
              `- ${MEAL_LABEL[m.slot as MealSlot] ?? m.slot}：` +
              m.items.map((it) => `${it.name}${it.amount ? `（${it.amount}）` : ''}${it.kcal != null ? ` ${it.kcal}kcal` : ''}`).join('、'),
          )
          .join('\n'),
    );
  }

  const body = prose(a.raw);
  if (body) out.push(`## コーチの返答（全文）\n${body}`);
  return out.join('\n\n') + '\n';
}

export function weeklyNote(w: Weekly): string {
  const out: string[] = [];
  out.push(frontmatter({ weekEnd: w.weekEnd, theme: w.theme }, ['ダイエット', '週次報告']));
  out.push(`# ${fmtJP(w.weekEnd)} までの週次レポート`);
  if (w.theme) out.push(`**来週のテーマ：** ${w.theme}`);
  if (w.summary) out.push(w.summary);
  const body = prose(w.raw);
  if (body) out.push(`## コーチの返答（全文）\n${body}`);
  return out.join('\n\n') + '\n';
}

export type ExportResult = 'shared' | 'cancelled' | 'downloaded' | 'empty';

/** 共有メニュー（「"ファイル"に保存」）でMarkdownを書き出し、書き出し済みの印を付ける */
export async function exportToObsidian(target: { dates?: string[]; weekEnds?: string[] }): Promise<ExportResult> {
  const [analyses, weeklies] = await Promise.all([
    target.dates?.length ? db.analyses.bulkGet(target.dates) : Promise.resolve([]),
    target.weekEnds?.length ? db.weekly.bulkGet(target.weekEnds) : Promise.resolve([]),
  ]);
  const files: File[] = [];
  for (const a of analyses) {
    if (!a) continue;
    const day = await db.days.get(a.date);
    files.push(new File([dailyNote(a, day)], dailyFileName(a.date), { type: 'text/markdown' }));
  }
  for (const w of weeklies) {
    if (!w) continue;
    files.push(new File([weeklyNote(w)], weeklyFileName(w.weekEnd), { type: 'text/markdown' }));
  }
  if (!files.length) return 'empty';

  let result: ExportResult;
  try {
    if (!navigator.canShare?.({ files })) throw new Error('share unsupported');
    await navigator.share({ files });
    result = 'shared';
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    // 共有できない環境（PCのブラウザなど）ではダウンロードする
    for (const f of files) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(f);
      a.download = f.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }
    result = 'downloaded';
  }

  const now = Date.now();
  await db.transaction('rw', db.analyses, db.weekly, async () => {
    for (const a of analyses) if (a) await db.analyses.update(a.date, { exportedAt: now });
    for (const w of weeklies) if (w) await db.weekly.update(w.weekEnd, { exportedAt: now });
  });
  return result;
}
