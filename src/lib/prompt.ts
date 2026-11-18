import { MEAL_LABEL, MEAL_SLOTS, type Analysis, type DayLog, type MealSlot, type Profile } from '../db';
import { ACT_LABEL, fmt1, fmtInt, type Prediction, type Targets } from './calc';
import { fmtJP, fmtShort } from './dates';

const FENCE = '```';

const sexLabel = (p: Profile) => (p.sex === 'male' ? '男性' : '女性');

function targetLine(t: Targets) {
  return `${fmtInt(t.kcal)}kcal（P${t.protein}g・F${t.fat}g・C${t.carbs}g）／水分${fmt1(t.water / 1000)}L／歩数${fmtInt(t.steps)}歩`;
}

/** Claudeアプリの「プロジェクト」に一度だけ貼り付ける指示文 */
export function projectInstructions(p: Profile, t: Targets) {
  return `あなたは私専属の、激しめのダイエットトレーナー「コーチ」です。

# 私のプロフィール
- ${p.age}歳・${sexLabel(p)}・身長${p.heightCm}cm
- 開始体重 ${fmt1(p.startWeight)}kg → 目標体重 ${fmt1(p.goalWeight)}kg${p.goalDate ? `（目標日 ${p.goalDate}）` : '（目標日は設定なし）'}
- 活動レベル：${ACT_LABEL[p.activity]}
- 1日の目標：${targetLine(t)}
- 基礎代謝：約${fmtInt(t.bmr)}kcal
- 食事の制限・アレルギー・苦手：${p.notes?.trim() || 'なし'}
※最新の体重と目標は毎回の報告に書くので、そちらを優先してください。

# 口調
- 熱血で厳しいトレーナー口調。甘やかさず、ダメな点ははっきり言う。良い点は短く力強く褒める。
- ただし人格否定や体型への侮辱はしない。

# 安全ルール（口調より優先）
- 摂取カロリーを基礎代謝未満にする指示、絶食・極端な糖質抜き・下剤などは勧めない。
- 急激な体重変化、極端な睡眠不足、体調不良の訴えがあれば、無理をさせず受診を勧める。

# 「【日次報告】」への返答
1. 添付写真と文章から、食事ごとの料理名・推定量・カロリーを推定する（写真がない食事は文章から推定。量が不明なら一般的な量を仮定し、仮定したことを書く）。
2. 1日の総摂取カロリーとPFCを出し、目標と比べる。
3. 評価をS/A/B/C/D（+/-可）で付ける。
4. 良かった点・悪かった点・今日やること（具体的な行動）をそれぞれ最大3つ。
5. 直近7日の傾向（睡眠と食欲の関係など）にも触れる。
6. 最後に必ず、アプリ取り込み用に次の形式のJSONを1つだけコードブロックで出力する（数値は整数、slotは breakfast/lunch/dinner/snack）。

${FENCE}json
{"type":"daily","date":"YYYY-MM-DD","grade":"B-","kcal":1850,"protein":80,"fat":55,"carbs":230,
 "meals":[{"slot":"breakfast","items":[{"name":"ご飯","amount":"150g","kcal":252}]}],
 "good":["..."],"bad":["..."],"todo":["..."],"coach":"今日の一言（40字以内）"}
${FENCE}

# 「【週次報告】」への返答
1週間を振り返り、良かった習慣・悪かった習慣、来週の重点テーマを1つ決める。最後に次のJSONをコードブロックで出力する。
${FENCE}json
{"type":"weekly","weekEnd":"YYYY-MM-DD","theme":"来週の重点テーマ","summary":"総評（100字以内）"}
${FENCE}

# 「【相談】」への返答
質問に具体的に答える。JSONは不要。`;
}

function v<T>(x: T | undefined | null, f: (x: T) => string, empty = '未記録') {
  return x == null || x === '' ? empty : f(x);
}

export interface DailyInput {
  profile: Profile;
  day: DayLog;
  photoCounts: Record<MealSlot, number>;
  recent: DayLog[]; // 対象日より前の最大7日
  recentAnalyses: Analysis[];
  targets: Targets;
  avgWeight: number | null;
  plateau: boolean;
  prediction: Prediction;
}

export function dailyReport(x: DailyInput) {
  const { profile: p, day: d, targets: t } = x;
  const lines: string[] = [];
  lines.push(`【日次報告】${d.date}（${fmtJP(d.date)}）`);
  lines.push('');
  lines.push('■ 体重・目標');
  lines.push(
    `体重：${v(d.weight, (w) => `${fmt1(w)}kg`)}（7日平均 ${x.avgWeight != null ? fmt1(x.avgWeight) + 'kg' : '—'}／開始 ${fmt1(p.startWeight)}kg／目標 ${fmt1(p.goalWeight)}kg）`,
  );
  lines.push(`1日の目標：${targetLine(t)}`);
  lines.push('');

  // 添付写真の順番
  let n = 0;
  const order: string[] = [];
  for (const s of MEAL_SLOTS) {
    const c = x.photoCounts[s];
    if (c > 0) {
      order.push(c === 1 ? `${n + 1}枚目=${MEAL_LABEL[s]}` : `${n + 1}〜${n + c}枚目=${MEAL_LABEL[s]}`);
      n += c;
    }
  }
  lines.push(`■ 食事${n ? `（添付写真：${order.join('、')}）` : '（写真なし）'}`);
  for (const s of MEAL_SLOTS) {
    const memo = d.meals?.[s]?.trim();
    const c = x.photoCounts[s];
    const desc = [c ? `写真${c}枚` : '', memo ?? ''].filter(Boolean).join('／');
    lines.push(`${MEAL_LABEL[s]}：${desc || (s === 'snack' ? 'なし' : '未記録')}`);
  }
  lines.push('');
  lines.push('■ 生活');
  lines.push(`水分：${v(d.water, (w) => `${fmt1(w / 1000)}L`)}`);
  lines.push(`運動：${d.exercise || d.exerciseMin ? `${d.exercise ?? ''}${d.exerciseMin ? `（${d.exerciseMin}分）` : ''}` : 'なし'}`);
  lines.push(`歩数：${v(d.steps, (s) => `${fmtInt(s)}歩`)}`);
  lines.push(`睡眠（この日の夜）：${v(d.sleepH, (h) => `${fmt1(h)}時間`)}${d.sleepQ ? `・質${d.sleepQ}/5` : ''}`);
  lines.push(`気分・ストレス：${v(d.mood, (m) => `${m}/5（5=良好）`)}`);
  lines.push(`空腹感：${v(d.hunger, (m) => `${m}/5（5=強い）`)}`);
  lines.push(`飲酒：${d.alcohol?.trim() || 'なし'}`);
  lines.push(`排便：${d.bowel === 'yes' ? 'あり' : d.bowel === 'no' ? 'なし' : '未記録'}`);
  if (d.memo?.trim()) lines.push(`メモ：${d.memo.trim()}`);
  lines.push('');

  if (x.recent.length) {
    lines.push('■ 直近の推移');
    lines.push('日付｜体重｜摂取kcal｜歩数｜睡眠｜評価');
    const amap = new Map(x.recentAnalyses.map((a) => [a.date, a]));
    for (const r of x.recent) {
      const a = amap.get(r.date);
      lines.push(
        [
          fmtShort(r.date),
          r.weight != null ? fmt1(r.weight) : '—',
          a?.kcal != null ? fmtInt(a.kcal) : '—',
          r.steps != null ? fmtInt(r.steps) : '—',
          r.sleepH != null ? `${fmt1(r.sleepH)}h` : '—',
          a?.grade ?? '—',
        ].join('｜'),
      );
    }
    lines.push('');
  }

  const auto: string[] = [];
  if (x.plateau) auto.push('停滞期の可能性あり（2週間で7日平均体重がほぼ減っていない）。原因と対策も指摘してください。');
  if (x.prediction.status === 'ok') auto.push(`今のペース（週${fmt1(x.prediction.perWeek)}kg）だと目標達成は ${x.prediction.date} ごろ。`);
  if (x.prediction.status === 'flat') auto.push('直近3週間、体重がほぼ減っていない。');
  if (auto.length) {
    lines.push('■ アプリの自動判定');
    auto.forEach((a) => lines.push(`- ${a}`));
    lines.push('');
  }
  lines.push('プロジェクトの指示どおり分析し、最後にJSONを出力してください。');
  return lines.join('\n');
}

export function weeklyReport(p: Profile, weekEnd: string, days: DayLog[], analyses: Analysis[], t: Targets) {
  const amap = new Map(analyses.map((a) => [a.date, a]));
  const lines = [`【週次報告】${weekEnd}までの7日間`, '', `目標体重 ${fmt1(p.goalWeight)}kg／1日の目標：${targetLine(t)}`, ''];
  lines.push('日付｜体重｜摂取kcal｜歩数｜睡眠｜運動｜評価');
  for (const d of days) {
    const a = amap.get(d.date);
    lines.push(
      [
        `${fmtShort(d.date)}`,
        d.weight != null ? fmt1(d.weight) : '—',
        a?.kcal != null ? fmtInt(a.kcal) : '—',
        d.steps != null ? fmtInt(d.steps) : '—',
        d.sleepH != null ? `${fmt1(d.sleepH)}h` : '—',
        d.exercise || (d.exerciseMin ? `${d.exerciseMin}分` : '—'),
        a?.grade ?? '—',
      ].join('｜'),
    );
  }
  const bads = analyses.flatMap((a) => a.bad).slice(0, 10);
  if (bads.length) {
    lines.push('', '■ 今週コーチに指摘された点');
    bads.forEach((b) => lines.push(`- ${b}`));
  }
  lines.push('', 'プロジェクトの指示どおり週次の振り返りをして、最後にJSONを出力してください。');
  return lines.join('\n');
}

export function consult(p: Profile, question: string, recent: DayLog[], weight: number | null) {
  return [
    '【相談】',
    question.trim(),
    '',
    `（参考：現在の体重 ${weight != null ? fmt1(weight) + 'kg' : '未記録'}／目標 ${fmt1(p.goalWeight)}kg／直近${recent.length}日の平均歩数 ${
      recent.filter((r) => r.steps != null).length
        ? fmtInt(recent.reduce((a, r) => a + (r.steps ?? 0), 0) / recent.filter((r) => r.steps != null).length)
        : '—'
    }歩）`,
  ].join('\n');
}
