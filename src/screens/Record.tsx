import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { NumField, Rating, TextField } from '../components/ui';
import { db, MEAL_LABEL, MEAL_SLOTS, saveDay, type DayLog, type MealSlot, type Photo } from '../db';
import { fmt1 } from '../lib/calc';
import { addDays, fmtJP } from '../lib/dates';
import { compressImage, toast } from '../lib/media';
import type { AppData } from '../lib/useData';

export function Record({ data, date, setDate }: { data: AppData; date: string; setDate: (d: string) => void }) {
  const log: DayLog = data.dayMap.get(date) ?? { date, meals: {} };
  const photos = useLiveQuery(() => db.photos.where('date').equals(date).toArray(), [date], [] as Photo[]);
  const favorites = useLiveQuery(() => db.favorites.toArray(), [], []);
  const [moreOpen, setMoreOpen] = useState(false);
  const save = (patch: Partial<DayLog>) => saveDay(date, patch);
  const isToday = date === data.today;

  return (
    <div className="screen" key={date}>
      <header className="date-nav">
        <button className="icon-btn" aria-label="前の日" onClick={() => setDate(addDays(date, -1))}>
          <Icon name="left" />
        </button>
        <div className="stack-2 center">
          <strong>{fmtJP(date)}</strong>
          <span className="sub tiny">{isToday ? '今日' : date === data.yesterday ? '昨日' : ''}</span>
        </div>
        <button className="icon-btn" aria-label="次の日" disabled={isToday} onClick={() => setDate(addDays(date, 1))}>
          <Icon name="right" />
        </button>
      </header>

      <section className="card gap-12">
        <h3>体重</h3>
        <NumField label="体重" unit="kg" step="0.1" value={log.weight} onCommit={(v) => save({ weight: v != null ? Math.round(v * 10) / 10 : undefined })} />
      </section>

      <section className="card gap-14">
        <h3>食事</h3>
        {MEAL_SLOTS.map((s) => (
          <MealBlock
            key={s}
            date={date}
            slot={s}
            memo={log.meals?.[s]}
            photos={photos.filter((p) => p.slot === s)}
            favorites={favorites}
            onMemo={(text) => save({ meals: { [s]: text } })}
          />
        ))}
      </section>

      <section className="card gap-12">
        <h3>水分・運動</h3>
        <div className="field">
          <span className="field-label">水分</span>
          <div className="row gap-8 wrap">
            <span className="display" style={{ fontSize: 32, minWidth: 80 }}>
              {fmt1((log.water ?? 0) / 1000)}L
            </span>
            {[100, 200, 500].map((ml) => (
              <button key={ml} className="chip-btn" onClick={() => save({ water: (log.water ?? 0) + ml })}>
                +{ml}
              </button>
            ))}
            <button className="chip-btn" aria-label="水分を200ml減らす" onClick={() => save({ water: Math.max(0, (log.water ?? 0) - 200) })}>
              −200
            </button>
          </div>
        </div>
        <TextField label="運動の内容" value={log.exercise} placeholder="例：筋トレ（スクワット・腕立て）" onCommit={(v) => save({ exercise: v })} />
        <NumField label="運動時間" unit="分" value={log.exerciseMin} onCommit={(v) => save({ exerciseMin: v })} />
      </section>

      <section className="card gap-12">
        <h3>歩数・睡眠</h3>
        <p className="sub small">歩数は翌朝、報告を送るときにショートカットで自動で入ります（手入力も可）。睡眠は手入力してください。</p>
        <div className="grid-2">
          <NumField label="歩数" unit="歩" step="1" value={log.steps} onCommit={(v) => save({ steps: v != null ? Math.round(v) : undefined })} />
          <NumField label="睡眠（この日の夜）" unit="時間" step="0.1" value={log.sleepH} onCommit={(v) => save({ sleepH: v })} />
        </div>
        <Rating label="睡眠の質" value={log.sleepQ} onChange={(v) => save({ sleepQ: v })} low="悪い" high="良い" />
      </section>

      <section className="card gap-12">
        <button className="row between full plain" aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>
          <h3>体調・その他</h3>
          <span className="sub small">{moreOpen ? '閉じる' : '開く'}</span>
        </button>
        {moreOpen && (
          <>
            <Rating label="気分・ストレス" value={log.mood} onChange={(v) => save({ mood: v })} low="つらい" high="良好" />
            <Rating label="空腹感" value={log.hunger} onChange={(v) => save({ hunger: v })} low="なし" high="強い" />
            <TextField label="飲酒" value={log.alcohol} placeholder="例：ビール中ジョッキ2杯" onCommit={(v) => save({ alcohol: v })} />
            <div className="field">
              <span className="field-label">排便</span>
              <div className="seg">
                {(['yes', 'no'] as const).map((b) => (
                  <button key={b} className={log.bowel === b ? 'on' : ''} aria-pressed={log.bowel === b} onClick={() => save({ bowel: log.bowel === b ? undefined : b })}>
                    {b === 'yes' ? 'あり' : 'なし'}
                  </button>
                ))}
              </div>
            </div>
            <TextField label="体調・メモ" multiline value={log.memo} placeholder="コーチに伝えたいこと" onCommit={(v) => save({ memo: v })} />
          </>
        )}
      </section>
    </div>
  );
}

function Thumb({ photo }: { photo: Photo }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const u = URL.createObjectURL(photo.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo.blob]);
  return (
    <button
      className="thumb"
      aria-label="この写真を削除"
      onClick={async () => {
        if (confirm('この写真を削除しますか？')) await db.photos.delete(photo.id!);
      }}
    >
      {url && <img src={url} alt="" />}
    </button>
  );
}

function MealBlock({
  date,
  slot,
  memo,
  photos,
  favorites,
  onMemo,
}: {
  date: string;
  slot: MealSlot;
  memo?: string;
  photos: Photo[];
  favorites: { id?: number; name: string; text: string }[];
  onMemo: (text: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(memo ?? '');
  useEffect(() => {
    setText(memo ?? '');
  }, [memo]);

  const add = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      try {
        await db.photos.add({ date, slot, blob: await compressImage(f), createdAt: Date.now() });
      } catch (e) {
        toast((e as Error).message);
      }
    }
  };

  const appendFav = (t: string) => {
    const next = text.trim() ? `${text.trim()}、${t}` : t;
    setText(next);
    onMemo(next);
  };

  const saveFav = async () => {
    const t = text.trim();
    if (!t) return toast('先にメモを入力してください');
    const name = prompt('「よく食べるもの」に登録する名前', t.slice(0, 16));
    if (!name) return;
    await db.favorites.add({ name, text: t });
    toast('登録しました');
  };

  return (
    <div className="meal">
      <div className="row between">
        <strong>{MEAL_LABEL[slot]}</strong>
        <button className="link-btn small" onClick={saveFav}>
          よく食べるものに登録
        </button>
      </div>
      <div className="thumbs">
        {photos.map((p) => (
          <Thumb key={p.id} photo={p} />
        ))}
        <button className="thumb add" aria-label={`${MEAL_LABEL[slot]}の写真を追加`} onClick={() => fileRef.current?.click()}>
          <Icon name="camera" />
        </button>
      </div>
      <textarea
        rows={2}
        aria-label={`${MEAL_LABEL[slot]}のメモ`}
        value={text}
        placeholder="内容・量のメモ（例：ご飯大盛り、ドレッシング多め）"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== (memo ?? '') && onMemo(text)}
      />
      {favorites.length > 0 && (
        <div className="chips">
          {favorites.map((f) => (
            <button key={f.id} className="chip-btn small" onClick={() => appendFav(f.text)}>
              <Icon name="star" size={14} />
              {f.name}
            </button>
          ))}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          add(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
