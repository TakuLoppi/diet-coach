import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Bar, Ring, Sheet } from '../components/ui';
import { db, MEAL_LABEL, saveDay, type MealSlot, type Profile } from '../db';
import { fmt1, fmtInt } from '../lib/calc';
import { fmtJP, fmtShort } from '../lib/dates';
import { compressImage, toast } from '../lib/media';
import type { AppData } from '../lib/useData';

function slotByTime(): MealSlot {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h < 10.5) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 17) return 'snack';
  return 'dinner';
}

export function Home({
  profile,
  data,
  onOpenSend,
  onOpenSettings,
  onOpenRecord,
}: {
  profile: Profile;
  data: AppData;
  onOpenSend: () => void;
  onOpenSettings: () => void;
  onOpenRecord: () => void;
}) {
  const { today, yesterday, targets: t } = data;
  const todayLog = data.dayMap.get(today);
  const todayPhotos = useLiveQuery(() => db.photos.where('date').equals(today).count(), [today], 0);
  const latest = [...data.analyses].sort((a, b) => b.date.localeCompare(a.date))[0];
  const yAnalysis = data.anMap.get(yesterday);
  const yLog = data.dayMap.get(yesterday);
  const fileRef = useRef<HTMLInputElement>(null);
  const [weightOpen, setWeightOpen] = useState(false);

  const lost = profile.startWeight - data.weight;
  const total = profile.startWeight - profile.goalWeight;
  const progress = total > 0 ? lost / total : 0;
  const remain = Math.max(0, data.weight - profile.goalWeight);

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const slot = slotByTime();
    for (const f of Array.from(files)) {
      try {
        const blob = await compressImage(f);
        await db.photos.add({ date: today, slot, blob, createdAt: Date.now() });
      } catch (e) {
        toast((e as Error).message);
        return;
      }
    }
    toast(`${MEAL_LABEL[slot]}に${files.length}枚追加しました（記録タブで変更できます）`);
  };

  const addWater = async (ml: number) => {
    await saveDay(today, { water: Math.max(0, (todayLog?.water ?? 0) + ml) });
    toast(`水分 +${ml}ml`);
  };

  const pred = data.prediction;

  return (
    <div className="screen">
      <header className="home-head">
        <div className="stack-2">
          <span className="sub small">{fmtJP(today)}</span>
          <span className="display" style={{ fontSize: 40 }}>
            DAY {data.dayNumber}
          </span>
        </div>
        <div className="row gap-8">
          {data.streak > 0 && (
            <span className="pill">
              <span className="accent">
                <Icon name="flame" size={18} />
              </span>
              {data.streak}日連続
            </span>
          )}
          <button className="icon-btn" aria-label="設定" onClick={onOpenSettings}>
            <Icon name="gear" />
          </button>
        </div>
      </header>

      {!yAnalysis && (
        <button className="send-banner" onClick={onOpenSend}>
          <Icon name="send" />
          <span className="stack-2" style={{ textAlign: 'left', flex: 1 }}>
            <strong>昨日の報告をコーチに送る</strong>
            <span className="small">{yLog?.sentAt ? '送信済み・返答の取り込み待ち' : `${fmtShort(yesterday)}分の記録をClaudeに送って採点を受ける`}</span>
          </span>
          <Icon name="right" />
        </button>
      )}

      <section className="card">
        <div className="row between end">
          <div className="stack-2">
            <span className="sub small">現在の体重（7日平均）</span>
            <div className="row baseline gap-4">
              <span className="display accent" style={{ fontSize: 84, lineHeight: 0.9 }}>
                {fmt1(data.weight)}
              </span>
              <span className="sub bold">kg</span>
            </div>
          </div>
          <div className="stack-2 right">
            <span className="sub small">開始から</span>
            <span className="display" style={{ fontSize: 36 }}>
              {lost >= 0 ? '-' : '+'}
              {fmt1(Math.abs(lost))}kg
            </span>
          </div>
        </div>
        <Bar ratio={progress} />
        <div className="row between small">
          <span className="sub">スタート {fmt1(profile.startWeight)}kg</span>
          <span className="bold">{remain > 0 ? `目標まで あと${fmt1(remain)}kg` : '目標達成！'}</span>
          <span className="sub">目標 {fmt1(profile.goalWeight)}kg</span>
        </div>
        <div className="sub small">
          {pred.status === 'ok' && `このペース（週${fmt1(pred.perWeek)}kg）なら ${fmtJP(pred.date)} に達成予測`}
          {pred.status === 'flat' && '直近3週間、体重がほぼ動いていない。ここが踏ん張りどころだ。'}
          {pred.status === 'insufficient' && '体重を7日以上記録すると達成予測日が出ます'}
          {pred.status === 'reached' && '目標体重に到達！維持モードに入ろう。'}
        </div>
        {data.plateau && <div className="notice">停滞期の可能性あり。コーチに原因を分析させよう。</div>}
      </section>

      <div className="row gap-12 stretch">
        <section className="card center flex-1 gap-6">
          <span className="sub small self-start">
            {latest?.kcal != null ? `摂取カロリー（${fmtShort(latest.date)}）` : '摂取カロリー'}
          </span>
          <Ring ratio={latest?.kcal != null ? latest.kcal / t.kcal : 0}>
            <span className="display" style={{ fontSize: 32 }}>
              {latest?.kcal != null ? fmtInt(latest.kcal) : '—'}
            </span>
            <span className="sub tiny">/ {fmtInt(t.kcal)} kcal</span>
          </Ring>
          <span className="small bold">
            {latest?.kcal != null
              ? latest.kcal > t.kcal
                ? `${fmtInt(latest.kcal - t.kcal)}kcal オーバー`
                : `${fmtInt(t.kcal - latest.kcal)}kcal 余裕あり`
              : 'コーチの分析後に表示'}
          </span>
          <span className="sub tiny">今日の食事写真 {todayPhotos}枚</span>
        </section>
        <div className="stack flex-1 gap-8">
          <MiniStat label="水分（今日）" value={`${fmt1((todayLog?.water ?? 0) / 1000)} / ${fmt1(t.water / 1000)}L`} ratio={(todayLog?.water ?? 0) / t.water} />
          <MiniStat
            label={`歩数（${fmtShort(yesterday)}）`}
            value={yLog?.steps != null ? `${fmtInt(yLog.steps)} / ${fmtInt(t.steps)}` : '未取得'}
            ratio={(yLog?.steps ?? 0) / t.steps}
          />
          <MiniStat
            label={`睡眠（${fmtShort(yesterday)}の夜）`}
            value={yLog?.sleepH != null ? `${fmt1(yLog.sleepH)}h${yLog.sleepH < 6.5 ? ' 不足' : ''}` : '未入力'}
            ratio={(yLog?.sleepH ?? 0) / 7.5}
            warn={yLog?.sleepH != null && yLog.sleepH < 6.5}
          />
        </div>
      </div>

      <section className="card gap-10">
        <div className="row gap-8 accent">
          <Icon name="chat" size={18} />
          <span className="display" style={{ fontSize: 20, letterSpacing: '0.06em' }}>
            COACH{latest ? ` · ${fmtShort(latest.date)}` : ''}
          </span>
          {latest?.grade && <span className="grade">{latest.grade}</span>}
        </div>
        {latest ? (
          <>
            {latest.coach && <p className="coach-text">{latest.coach}</p>}
            {latest.todo.length > 0 && (
              <ul className="todo">
                {latest.todo.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="coach-text">まだ報告がない。記録をつけて、明日の朝に報告を送ってこい。話はそれからだ！</p>
        )}
      </section>

      <div className="quick">
        <button className="btn-primary span-2" onClick={() => fileRef.current?.click()}>
          <Icon name="camera" />
          食事を撮る
        </button>
        <button className="btn-tile" onClick={() => setWeightOpen(true)}>
          <Icon name="scale" size={20} />
          体重
        </button>
        <button className="btn-tile" onClick={() => addWater(200)}>
          <Icon name="drop" size={20} />
          +200ml
        </button>
      </div>
      <button className="link-btn" onClick={onOpenRecord}>
        今日の記録をすべて見る・編集する
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          addPhotos(e.target.files);
          e.target.value = '';
        }}
      />
      {weightOpen && <WeightSheet initial={todayLog?.weight ?? data.latestWeight ?? undefined} onClose={() => setWeightOpen(false)} date={today} />}
    </div>
  );
}

function MiniStat({ label, value, ratio, warn }: { label: string; value: string; ratio: number; warn?: boolean }) {
  return (
    <div className="mini">
      <span className="sub tiny">{label}</span>
      <span className={warn ? 'bold warn small' : 'bold small'}>{value}</span>
      <Bar ratio={ratio} warn={warn} />
    </div>
  );
}

function WeightSheet({ initial, onClose, date }: { initial?: number; onClose: () => void; date: string }) {
  const [s, setS] = useState(initial != null ? String(initial) : '');
  const save = async () => {
    const n = Number(s);
    if (!s || !isFinite(n) || n < 20 || n > 300) {
      toast('体重を正しく入力してください');
      return;
    }
    await saveDay(date, { weight: Math.round(n * 10) / 10 });
    toast('体重を記録しました');
    onClose();
  };
  return (
    <Sheet title="今日の体重" onClose={onClose}>
      <label className="field">
        <span className="field-label">体重</span>
        <span className="input-wrap big">
          <input autoFocus type="number" inputMode="decimal" step="0.1" value={s} onChange={(e) => setS(e.target.value)} />
          <span className="unit">kg</span>
        </span>
      </label>
      <button className="btn-primary" onClick={save}>
        記録する
      </button>
    </Sheet>
  );
}
