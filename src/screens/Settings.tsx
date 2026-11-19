import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { db, type Profile } from '../db';
import { todayKey } from '../lib/dates';
import { base64ToBlob, blobToBase64, downloadBlob, toast } from '../lib/media';
import type { AppData } from '../lib/useData';
import { ProjectSetup } from './Coach';
import { ProfileForm } from './ProfileForm';
import { SHORTCUT_NAME } from './SendReport';

type Section = 'profile' | 'claude' | 'shortcut' | 'reminder' | 'favorites' | 'backup' | null;

export function Settings({ profile, data, onClose }: { profile: Profile; data: AppData; onClose: () => void }) {
  const [open, setOpen] = useState<Section>(null);
  const toggle = (s: Section) => setOpen(open === s ? null : s);

  return (
    <div className="screen settings">
      <header className="screen-head row between">
        <h1>設定</h1>
        <button className="icon-btn" aria-label="設定を閉じる" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>

      <Group title="プロフィール・目標" open={open === 'profile'} onToggle={() => toggle('profile')}>
        <ProfileForm
          initial={profile}
          submitLabel="保存する"
          onSubmit={async (p) => {
            await db.profile.put(p);
            toast('保存しました。Claudeの指示文も貼り直してください');
          }}
        />
      </Group>

      <Group title="Claudeアプリの指示文" open={open === 'claude'} onToggle={() => toggle('claude')}>
        <ProjectSetup profile={profile} data={data} />
      </Group>

      <Group title="歩数のショートカット" open={open === 'shortcut'} onToggle={() => toggle('shortcut')}>
        <ShortcutGuide />
      </Group>

      <Group title="記録忘れのリマインダー" open={open === 'reminder'} onToggle={() => toggle('reminder')}>
        <ol className="howto">
          <li>ショートカットAppの「オートメーション」→「＋」→「時刻」</li>
          <li>時刻を選び（例：毎朝7:30）、「すぐに実行」をオン</li>
          <li>アクション「通知を表示」を追加し、文言を入れる</li>
        </ol>
        <p className="sub small">おすすめの設定：</p>
        <ul className="plain-list small">
          <li>7:30「体重を測れ。そして昨日の報告を送れ！」</li>
          <li>21:00「今日の食事、全部撮ったか？水分は足りてるか？」</li>
        </ul>
      </Group>

      <Group title="よく食べるもの" open={open === 'favorites'} onToggle={() => toggle('favorites')}>
        <Favorites />
      </Group>

      <Group title="バックアップ" open={open === 'backup'} onToggle={() => toggle('backup')}>
        <Backup />
      </Group>

      <section className="card gap-10">
        <h3 className="warn">データの削除</h3>
        <p className="sub small">すべての記録・写真・分析を削除します。元に戻せません。</p>
        <button
          className="btn-danger"
          onClick={async () => {
            if (!confirm('本当にすべてのデータを削除しますか？')) return;
            if (!confirm('元に戻せません。削除してよいですか？')) return;
            await db.delete();
            location.reload();
          }}
        >
          すべてのデータを削除
        </button>
      </section>
    </div>
  );
}

function Group({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className="card gap-12">
      <button className="row between full plain" aria-expanded={open} onClick={onToggle}>
        <h3>{title}</h3>
        <span className="sub">
          <Icon name={open ? 'minus' : 'plus'} size={18} />
        </span>
      </button>
      {open && children}
    </section>
  );
}

function ShortcutGuide() {
  return (
    <div className="stack gap-8 small">
      <p>
        iPhoneの「ショートカット」Appで、前日の歩数をヘルスケアから読み取ってコピーするショートカットを作ります。名前は必ず「
        <strong>{SHORTCUT_NAME}</strong>」にしてください。
      </p>
      <ol className="howto">
        <li>「日付を調整」：現在の日付 の「日の始まりを取得」→ 名前を「今日0時」に</li>
        <li>「日付を調整」：今日0時 から 1日 を減算 → 名前を「昨日0時」に</li>
        <li>「ヘルスケアサンプルを検索」：歩数、開始日が 昨日0時〜今日0時 の範囲 →「統計を計算」：合計</li>
        <li>「日付をフォーマット」：昨日0時、カスタム yyyy-MM-dd</li>
        <li>
          「テキスト」に次の形で入力（[ ]は上の結果の変数）：
          <code className="code">DIETLOG date=[日付] steps=[歩数]</code>
        </li>
        <li>「クリップボードにコピー」を追加して完成</li>
      </ol>
      <p className="sub">初回実行時にヘルスケアへのアクセス許可を求められるので「許可」してください。うまく動かない場合は、一緒に調整しましょう。</p>
    </div>
  );
}

function Favorites() {
  const favs = useLiveQuery(() => db.favorites.toArray(), [], []);
  if (!favs.length) return <p className="sub small">記録タブの食事メモから「よく食べるものに登録」で追加できます。</p>;
  return (
    <ul className="plain-list">
      {favs.map((f) => (
        <li key={f.id} className="row between gap-8">
          <span className="stack-2">
            <strong>{f.name}</strong>
            <span className="sub tiny">{f.text}</span>
          </span>
          <button className="icon-btn" aria-label={`${f.name}を削除`} onClick={() => db.favorites.delete(f.id!)}>
            <Icon name="trash" size={18} />
          </button>
        </li>
      ))}
    </ul>
  );
}

interface BackupFile {
  app: 'diet-coach';
  version: 1;
  exportedAt: string;
  profile: unknown[];
  days: unknown[];
  analyses: unknown[];
  weekly: unknown[];
  favorites: unknown[];
  photos?: { date: string; slot: string; createdAt: number; data: string }[];
}

function Backup() {
  const [withPhotos, setWithPhotos] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportData = async () => {
    const out: BackupFile = {
      app: 'diet-coach',
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: await db.profile.toArray(),
      days: await db.days.toArray(),
      analyses: await db.analyses.toArray(),
      weekly: await db.weekly.toArray(),
      favorites: await db.favorites.toArray(),
    };
    if (withPhotos) {
      const ps = await db.photos.toArray();
      out.photos = await Promise.all(ps.map(async (p) => ({ date: p.date, slot: p.slot, createdAt: p.createdAt, data: await blobToBase64(p.blob) })));
    }
    const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
    const name = `diet-coach-${todayKey()}.json`;
    const file = new File([blob], name, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
    downloadBlob(blob, name);
  };

  const importData = async (f: File | undefined) => {
    if (!f) return;
    try {
      const j = JSON.parse(await f.text()) as BackupFile;
      if (j.app !== 'diet-coach') throw new Error();
      if (!confirm('バックアップを読み込みます。同じ日付の記録は上書きされます。よろしいですか？')) return;
      await db.transaction('rw', [db.profile, db.days, db.analyses, db.weekly, db.favorites, db.photos], async () => {
        await db.profile.bulkPut(j.profile as never[]);
        await db.days.bulkPut(j.days as never[]);
        await db.analyses.bulkPut(j.analyses as never[]);
        await db.weekly.bulkPut(j.weekly as never[]);
        await db.favorites.bulkPut(j.favorites as never[]);
        if (j.photos?.length) {
          await db.photos.bulkAdd(j.photos.map((p) => ({ date: p.date, slot: p.slot as never, createdAt: p.createdAt, blob: base64ToBlob(p.data) })));
        }
      });
      toast('バックアップを読み込みました');
    } catch {
      toast('このファイルは読み込めません');
    }
  };

  return (
    <div className="stack gap-10">
      <p className="sub small">データはこのiPhoneの中だけにあります。機種変更やトラブルに備えて、ときどき書き出してファイルAppやiCloud Driveに保存してください。</p>
      <label className="row gap-8 small">
        <input type="checkbox" checked={withPhotos} onChange={(e) => setWithPhotos(e.target.checked)} />
        食事写真も含める（ファイルが大きくなります）
      </label>
      <div className="row gap-8">
        <button className="btn-secondary flex-1" onClick={exportData}>
          <Icon name="dl" size={18} />
          書き出す
        </button>
        <button className="btn-secondary flex-1" onClick={() => fileRef.current?.click()}>
          <Icon name="up" size={18} />
          読み込む
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          importData(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
