import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Icon } from '../components/Icon';
import { ImportReply } from '../components/ImportReply';
import { Sheet } from '../components/ui';
import { db, MEAL_LABEL, type Analysis, type DayLog, type MealSlot, type Profile } from '../db';
import { fmtInt } from '../lib/calc';
import { addDays, fmtJP, fmtShort } from '../lib/dates';
import { copyText, shareToClaude, toast } from '../lib/media';
import { exportToObsidian, OBSIDIAN_FOLDER } from '../lib/obsidian';
import { consult, projectInstructions, weeklyReport } from '../lib/prompt';
import type { AppData } from '../lib/useData';

const SETUP_KEY = 'coach-project-ready';

function getFlag() {
  try {
    return localStorage.getItem(SETUP_KEY) === '1';
  } catch {
    return false;
  }
}

export function ProjectSetup({ profile, data, onDone }: { profile: Profile; data: AppData; onDone?: () => void }) {
  return (
    <div className="stack gap-10">
      <ol className="howto">
        <li>下のボタンで指示文をコピー</li>
        <li>Claudeアプリで「プロジェクト」→「新規作成」（名前は「ダイエットコーチ」など）</li>
        <li>プロジェクトの「指示」に貼り付けて保存</li>
        <li>毎日の報告は、このプロジェクト内のチャットに送る</li>
      </ol>
      <button
        className="btn-primary"
        onClick={async () => {
          const ok = await copyText(projectInstructions(profile, data.targets));
          toast(ok ? '指示文をコピーしました' : 'コピーできませんでした');
          if (ok) {
            try {
              localStorage.setItem(SETUP_KEY, '1');
            } catch {
              /* 保存できなくても動作に影響なし */
            }
            onDone?.();
          }
        }}
      >
        <Icon name="paste" />
        指示文をコピー
      </button>
      <p className="sub tiny">プロフィールや目標を変えたら、もう一度コピーして貼り直してください。</p>
    </div>
  );
}

export function Coach({ profile, data, onOpenSend }: { profile: Profile; data: AppData; onOpenSend: () => void }) {
  const [ready, setReady] = useState(getFlag);
  const [sheet, setSheet] = useState<'weekly' | 'consult' | 'setup' | 'obsidian' | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const weekly = useLiveQuery(() => db.weekly.orderBy('weekEnd').last(), []);
  const history = [...data.analyses].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>コーチ</h1>
      </header>

      {!ready && (
        <section className="card gap-10 highlight">
          <h3>最初に：Claudeアプリの準備（1回だけ）</h3>
          <ProjectSetup profile={profile} data={data} onDone={() => setReady(true)} />
        </section>
      )}

      <div className="action-list">
        <button className="action" onClick={onOpenSend}>
          <Icon name="send" />
          <span className="stack-2">
            <strong>日次報告を送る</strong>
            <span className="sub small">前日の記録を送って採点を受ける</span>
          </span>
          <Icon name="right" />
        </button>
        <button className="action" onClick={() => setSheet('weekly')}>
          <Icon name="chart" />
          <span className="stack-2">
            <strong>週次レポート</strong>
            <span className="sub small">1週間の振り返りと来週のテーマ</span>
          </span>
          <Icon name="right" />
        </button>
        <button className="action" onClick={() => setSheet('consult')}>
          <Icon name="chat" />
          <span className="stack-2">
            <strong>コーチに相談</strong>
            <span className="sub small">「今日の飲み会、何を選べばいい？」など</span>
          </span>
          <Icon name="right" />
        </button>
        <button className="action" onClick={() => setSheet('obsidian')}>
          <Icon name="dl" />
          <span className="stack-2">
            <strong>Obsidianに保存</strong>
            <span className="sub small">日次・週次の報告をノートとして書き出す</span>
          </span>
          <Icon name="right" />
        </button>
      </div>

      {weekly?.theme && (
        <section className="card gap-6">
          <span className="sub small">今週の重点テーマ（{fmtShort(weekly.weekEnd)}まで）</span>
          <strong className="accent" style={{ fontSize: 18 }}>
            {weekly.theme}
          </strong>
          {weekly.summary && <p className="small">{weekly.summary}</p>}
        </section>
      )}

      <section className="stack gap-8">
        <h3 style={{ padding: '0 4px' }}>これまでの分析</h3>
        {history.length === 0 && <p className="sub small card">まだ分析がありません。</p>}
        {history.map((a) => (
          <HistoryItem key={a.date} a={a} open={open === a.date} toggle={() => setOpen(open === a.date ? null : a.date)} />
        ))}
      </section>

      {sheet === 'weekly' && <WeeklySheet profile={profile} data={data} onClose={() => setSheet(null)} />}
      {sheet === 'consult' && <ConsultSheet profile={profile} data={data} onClose={() => setSheet(null)} />}
      {sheet === 'obsidian' && <ObsidianSheet onClose={() => setSheet(null)} />}
    </div>
  );
}

function HistoryItem({ a, open, toggle }: { a: Analysis; open: boolean; toggle: () => void }) {
  return (
    <div className="card gap-8">
      <button className="row between full plain" aria-expanded={open} onClick={toggle}>
        <span className="row gap-8">
          {a.grade && <span className="grade">{a.grade}</span>}
          <strong>{fmtJP(a.date)}</strong>
        </span>
        <span className="sub small">{a.kcal != null ? `${fmtInt(a.kcal)}kcal` : ''}</span>
      </button>
      {a.coach && <p className="small bold">{a.coach}</p>}
      {open && (
        <div className="stack gap-8 small">
          {a.good.length > 0 && <List title="良かった点" items={a.good} cls="accent" />}
          {a.bad.length > 0 && <List title="悪かった点" items={a.bad} cls="warn" />}
          {a.todo.length > 0 && <List title="やること" items={a.todo} />}
          {a.meals && a.meals.length > 0 && (
            <div className="stack gap-4">
              <strong>食事の推定</strong>
              {a.meals.map((m, i) => (
                <div key={i} className="sub">
                  {MEAL_LABEL[m.slot as MealSlot] ?? m.slot}：
                  {m.items.map((it) => `${it.name}${it.amount ? `（${it.amount}）` : ''}${it.kcal != null ? ` ${it.kcal}kcal` : ''}`).join('、')}
                </div>
              ))}
            </div>
          )}
          {a.protein != null && (
            <div className="sub">
              P {a.protein}g ／ F {a.fat ?? '—'}g ／ C {a.carbs ?? '—'}g
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function List({ title, items, cls }: { title: string; items: string[]; cls?: string }) {
  return (
    <div className="stack gap-4">
      <strong className={cls}>{title}</strong>
      <ul className="plain-list">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

function WeeklySheet({ profile, data, onClose }: { profile: Profile; data: AppData; onClose: () => void }) {
  const end = data.yesterday;
  const send = async () => {
    const days: DayLog[] = [];
    for (let i = 6; i >= 0; i--) {
      const k = addDays(end, -i);
      days.push(data.dayMap.get(k) ?? { date: k, meals: {} });
    }
    const an = data.analyses.filter((a) => a.date >= addDays(end, -6) && a.date <= end);
    const r = await shareToClaude(weeklyReport(profile, end, days, an, data.targets));
    if (r === 'copied') toast('文章をコピーしました。Claudeアプリのプロジェクトに貼り付けて送信してください');
  };
  return (
    <Sheet title="週次レポート" onClose={onClose}>
      <p className="small">
        {fmtShort(addDays(end, -6))}〜{fmtShort(end)}の7日間をまとめてコーチに送ります。
      </p>
      <button className="btn-primary" onClick={send}>
        <Icon name="send" />
        Claudeに送る
      </button>
      <h3>返答を取り込む</h3>
      <ImportReply fallbackDate={end} onDone={(p) => p.kind === 'weekly' && onClose()} />
    </Sheet>
  );
}

function ConsultSheet({ profile, data, onClose }: { profile: Profile; data: AppData; onClose: () => void }) {
  const [q, setQ] = useState('');
  const send = async () => {
    const recent: DayLog[] = [];
    for (let i = 7; i >= 1; i--) {
      const d = data.dayMap.get(addDays(data.today, -i));
      if (d) recent.push(d);
    }
    const r = await shareToClaude(consult(profile, q, recent, data.weight));
    if (r === 'copied') toast('文章をコピーしました。Claudeアプリに貼り付けて送信してください');
    if (r === 'shared' || r === 'copied') onClose();
  };
  return (
    <Sheet title="コーチに相談" onClose={onClose}>
      <textarea rows={4} autoFocus value={q} placeholder="例：今夜は焼肉の飲み会。何をどれだけ食べていい？" aria-label="相談内容" onChange={(e) => setQ(e.target.value)} />
      <button className="btn-primary" disabled={!q.trim()} onClick={send}>
        <Icon name="send" />
        Claudeに送る
      </button>
      <p className="sub tiny">相談の返答は取り込み不要です。Claudeアプリでそのまま読んでください。</p>
    </Sheet>
  );
}

export function ObsidianHowto() {
  return (
    <ol className="howto small">
      <li>下のボタンを押すと共有メニューが開きます</li>
      <li>「"ファイル"に保存」→「iCloud Drive」→「{OBSIDIAN_FOLDER}」フォルダを選んで「保存」</li>
      <li>同じ名前のファイルがあると聞かれたら「置き換える」</li>
      <li>MacのObsidian（保管庫の「{OBSIDIAN_FOLDER}」フォルダ）に自動で表示されます</li>
    </ol>
  );
}

function ObsidianSheet({ onClose }: { onClose: () => void }) {
  const analyses = useLiveQuery(() => db.analyses.toArray(), [], [] as Analysis[]);
  const weeklies = useLiveQuery(() => db.weekly.toArray(), [], []);
  const newDaily = analyses.filter((a) => !a.exportedAt).map((a) => a.date);
  const newWeekly = weeklies.filter((w) => !w.exportedAt).map((w) => w.weekEnd);
  const newCount = newDaily.length + newWeekly.length;
  const allCount = analyses.length + weeklies.length;

  const run = async (dates: string[], weekEnds: string[]) => {
    const r = await exportToObsidian({ dates, weekEnds });
    if (r === 'empty') toast('書き出す報告がありません');
    if (r === 'downloaded') toast('ファイルをダウンロードしました');
    if (r === 'shared') toast(`${dates.length + weekEnds.length}件を書き出しました`);
  };

  return (
    <Sheet title="Obsidianに保存" onClose={onClose}>
      <ObsidianHowto />
      <button className="btn-primary" disabled={!newCount} onClick={() => run(newDaily, newWeekly)}>
        <Icon name="dl" />
        {newCount ? `未保存の${newCount}件を保存` : '未保存の報告はありません'}
      </button>
      <button className="btn-secondary" disabled={!allCount} onClick={() => run(analyses.map((a) => a.date), weeklies.map((w) => w.weekEnd))}>
        すべて（{allCount}件）を保存し直す
      </button>
      <p className="sub tiny">ファイル名は「2026-11-18 日次.md」「2026-11-22 週次.md」の形です。返答を取り込み直した報告は、未保存に戻ります。</p>
    </Sheet>
  );
}
