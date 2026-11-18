import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Icon } from './components/Icon';
import { db, type Profile } from './db';
import { todayKey } from './lib/dates';
import { useData } from './lib/useData';
import { Analysis } from './screens/Analysis';
import { Coach } from './screens/Coach';
import { Home } from './screens/Home';
import { Record } from './screens/Record';
import { SendReport } from './screens/SendReport';
import { Settings } from './screens/Settings';
import { Setup } from './screens/Setup';

type Tab = 'home' | 'record' | 'analysis' | 'coach';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'ホーム', icon: 'home' },
  { id: 'record', label: '記録', icon: 'list' },
  { id: 'analysis', label: '分析', icon: 'chart' },
  { id: 'coach', label: 'コーチ', icon: 'chat' },
];

export default function App() {
  const profile = useLiveQuery(async () => (await db.profile.get(1)) ?? null, []);
  return (
    <>
      {profile === undefined ? null : profile === null ? <Setup /> : <Main profile={profile} />}
      <ToastHost />
    </>
  );
}

function Main({ profile }: { profile: Profile }) {
  const data = useData(profile);
  const [tab, setTab] = useState<Tab>('home');
  const [recordDate, setRecordDate] = useState(todayKey());
  const [sendOpen, setSendOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab, settingsOpen]);

  if (settingsOpen) return <Settings profile={profile} data={data} onClose={() => setSettingsOpen(false)} />;

  return (
    <>
      <main>
        {tab === 'home' && (
          <Home
            profile={profile}
            data={data}
            onOpenSend={() => setSendOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenRecord={() => {
              setRecordDate(data.today);
              setTab('record');
            }}
          />
        )}
        {tab === 'record' && <Record data={data} date={recordDate} setDate={setRecordDate} />}
        {tab === 'analysis' && <Analysis profile={profile} data={data} />}
        {tab === 'coach' && <Coach profile={profile} data={data} onOpenSend={() => setSendOpen(true)} />}
      </main>
      <nav className="tabbar" aria-label="メインメニュー">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'on' : ''}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => {
              if (t.id === 'record' && tab !== 'record') setRecordDate(data.today);
              setTab(t.id);
            }}
          >
            <Icon name={t.icon} />
            {t.label}
          </button>
        ))}
      </nav>
      {sendOpen && <SendReport profile={profile} data={data} onClose={() => setSendOpen(false)} />}
    </>
  );
}

function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let timer: number | undefined;
    const h = (e: Event) => {
      setMsg((e as CustomEvent<string>).detail);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMsg(null), 3200);
    };
    window.addEventListener('app-toast', h);
    return () => {
      window.removeEventListener('app-toast', h);
      window.clearTimeout(timer);
    };
  }, []);
  return (
    <div className="toast-wrap" aria-live="polite">
      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}
