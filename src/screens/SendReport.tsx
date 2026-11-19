import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Icon } from '../components/Icon';
import { ImportReply } from '../components/ImportReply';
import { NumField, Sheet } from '../components/ui';
import { db, MEAL_LABEL, MEAL_SLOTS, saveDay, type DayLog, type MealSlot, type Photo, type Profile } from '../db';
import { avgAt, fmtInt } from '../lib/calc';
import { addDays, fmtJP, fmtShort } from '../lib/dates';
import { readClipboard, shareToClaude, toast } from '../lib/media';
import { parseHealth } from '../lib/parse';
import { dailyReport } from '../lib/prompt';
import type { AppData } from '../lib/useData';

export const SHORTCUT_NAME = 'ダイエット記録取得';

export function SendReport({ profile, data, onClose }: { profile: Profile; data: AppData; onClose: () => void }) {
  const [date, setDate] = useState(data.yesterday);
  const log: DayLog = data.dayMap.get(date) ?? { date, meals: {} };
  const photos = useLiveQuery(() => db.photos.where('date').equals(date).toArray(), [date], [] as Photo[]);
  const analysis = data.anMap.get(date);

  const missing: string[] = [];
  if (log.weight == null) missing.push('体重');
  for (const s of ['breakfast', 'lunch', 'dinner'] as MealSlot[]) {
    if (!log.meals?.[s]?.trim() && !photos.some((p) => p.slot === s)) missing.push(MEAL_LABEL[s]);
  }
  if (!log.water) missing.push('水分');
  if (log.steps == null) missing.push('歩数');
  if (log.sleepH == null) missing.push('睡眠');

  const pasteHealth = async () => {
    const t = await readClipboard();
    const h = t ? parseHealth(t) : null;
    if (!h) {
      toast('ショートカットの結果が見つかりません。先にショートカットを実行してください');
      return;
    }
    const target = h.date ?? date;
    await saveDay(target, {
      ...(h.steps != null ? { steps: h.steps } : {}),
      ...(h.sleep != null ? { sleepH: h.sleep } : {}),
    });
    if (target !== date) setDate(target);
    toast(`歩数${h.steps != null ? fmtInt(h.steps) + '歩' : '—'}${h.sleep != null ? `・睡眠${h.sleep}時間` : ''}を取り込みました`);
  };

  const send = async () => {
    const recent: DayLog[] = [];
    for (let i = 7; i >= 1; i--) {
      const d = data.dayMap.get(addDays(date, -i));
      if (d) recent.push(d);
    }
    const counts = Object.fromEntries(MEAL_SLOTS.map((s) => [s, 0])) as Record<MealSlot, number>;
    const files: File[] = [];
    for (const s of MEAL_SLOTS) {
      photos
        .filter((p) => p.slot === s)
        .sort((a, b) => a.createdAt - b.createdAt)
        .forEach((p) => {
          counts[s]++;
          files.push(new File([p.blob], `${date}_${MEAL_LABEL[s]}_${counts[s]}.jpg`, { type: 'image/jpeg' }));
        });
    }
    const text = dailyReport({
      profile,
      day: log,
      photoCounts: counts,
      recent,
      recentAnalyses: data.analyses.filter((a) => a.date < date && a.date >= addDays(date, -7)),
      targets: data.targets,
      avgWeight: avgAt(data.series, date),
      plateau: data.plateau,
      prediction: data.prediction,
    });
    const r = await shareToClaude(text, files);
    if (r === 'shared' || r === 'copied') await saveDay(date, { sentAt: Date.now() });
    if (r === 'copied') toast('文章をコピーしました。Claudeアプリのプロジェクトに貼り付け、写真を添付して送信してください');
    if (r === 'failed') toast('共有できませんでした');
  };

  return (
    <Sheet title="報告をコーチに送る" onClose={onClose}>
      <div className="date-nav compact">
        <button className="icon-btn" aria-label="前の日" onClick={() => setDate(addDays(date, -1))}>
          <Icon name="left" />
        </button>
        <strong>{fmtJP(date)}の報告</strong>
        <button className="icon-btn" aria-label="次の日" disabled={date >= data.yesterday} onClick={() => setDate(addDays(date, 1))}>
          <Icon name="right" />
        </button>
      </div>

      <ol className="steps">
        <li>
          <h3>歩数を取り込み、睡眠を入力</h3>
          <p className="sub small">
            ショートカット「{SHORTCUT_NAME}」を実行すると歩数がコピーされます。戻ってきたら貼り付けボタンを押してください。
          </p>
          <div className="row gap-8">
            <a className="btn-secondary flex-1" href={`shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}`}>
              <Icon name="bolt" size={18} />
              ショートカット実行
            </a>
            <button className="btn-secondary flex-1" onClick={pasteHealth}>
              <Icon name="paste" size={18} />
              貼り付け
            </button>
          </div>
          <p className="small">
            歩数 <strong>{log.steps != null ? `${fmtInt(log.steps)}歩` : '未取得'}</strong>
          </p>
          <NumField
            label={`睡眠（${fmtShort(date)}の夜〜今朝）`}
            unit="時間"
            step="0.1"
            placeholder="例：6.5"
            value={log.sleepH}
            onCommit={(v) => saveDay(date, { sleepH: v != null && v > 0 && v <= 24 ? Math.round(v * 10) / 10 : undefined })}
          />
        </li>
        <li>
          <h3>記録を確認</h3>
          {missing.length ? (
            <p className="small">
              <span className="warn bold">未記録：{missing.join('・')}</span>
              <br />
              <span className="sub">空欄のままでも送れます（記録タブで追加できます）。</span>
            </p>
          ) : (
            <p className="small accent bold">すべて記録済み。完璧だ！</p>
          )}
          <p className="sub small">食事写真 {photos.length}枚を一緒に送ります。</p>
        </li>
        <li>
          <h3>Claudeに送る</h3>
          <p className="sub small">共有メニューで「Claude」を選び、ダイエットコーチのプロジェクトで送信してください。</p>
          <button className="btn-primary" onClick={send}>
            <Icon name="send" />
            Claudeに送る
          </button>
          {log.sentAt && <p className="sub tiny">送信済み（もう一度送ることもできます）</p>}
        </li>
        <li>
          <h3>コーチの返答を取り込む</h3>
          <p className="sub small">Claudeの返答を長押し→「コピー」してから戻り、ボタンを押してください。</p>
          {analysis ? (
            <p className="small accent bold">
              取り込み済み{analysis.grade ? `（評価 ${analysis.grade}・${analysis.kcal != null ? fmtInt(analysis.kcal) + 'kcal' : ''}）` : ''}
            </p>
          ) : null}
          <ImportReply fallbackDate={date} onDone={(p) => p.kind === 'daily' && p.analysis.date === date && onClose()} />
        </li>
      </ol>
    </Sheet>
  );
}
