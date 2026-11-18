import { db, saveDay } from '../db';
import { todayKey } from '../lib/dates';
import { ProfileForm } from './ProfileForm';

export function Setup() {
  return (
    <div className="screen setup">
      <header className="stack gap-6">
        <span className="display accent" style={{ fontSize: 48 }}>
          DIET COACH
        </span>
        <h1>よく来たな。まずはお前のことを教えろ。</h1>
        <p className="sub small">この情報から、1日の目標カロリーや栄養バランスを計算します。データはこのiPhoneの中だけに保存されます。</p>
      </header>
      <section className="card">
        <ProfileForm
          isSetup
          submitLabel="はじめる"
          onSubmit={async (p) => {
            await db.profile.put(p);
            await saveDay(todayKey(), { weight: p.startWeight });
          }}
        />
      </section>
    </div>
  );
}
