import { useState } from 'react';
import type { Activity, Profile, Sex } from '../db';
import { ACT_LABEL } from '../lib/calc';
import { todayKey } from '../lib/dates';
import { toast } from '../lib/media';

type Draft = {
  age: string;
  sex: Sex;
  heightCm: string;
  startWeight: string;
  goalWeight: string;
  goalDate: string;
  activity: Activity;
  stepGoal: string;
  notes: string;
};

export function ProfileForm({
  initial,
  submitLabel,
  onSubmit,
  isSetup,
}: {
  initial?: Profile;
  submitLabel: string;
  onSubmit: (p: Profile) => void;
  isSetup?: boolean;
}) {
  const [d, setD] = useState<Draft>({
    age: initial ? String(initial.age) : '',
    sex: initial?.sex ?? 'male',
    heightCm: initial ? String(initial.heightCm) : '',
    startWeight: initial ? String(initial.startWeight) : '',
    goalWeight: initial ? String(initial.goalWeight) : '',
    goalDate: initial?.goalDate ?? '',
    activity: initial?.activity ?? 'low',
    stepGoal: String(initial?.stepGoal ?? 8000),
    notes: initial?.notes ?? '',
  });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const submit = () => {
    const age = Number(d.age);
    const h = Number(d.heightCm);
    const sw = Number(d.startWeight);
    const gw = Number(d.goalWeight);
    const steps = Number(d.stepGoal) || 8000;
    if (!(age >= 10 && age <= 100)) return toast('年齢を正しく入力してください');
    if (!(h >= 100 && h <= 230)) return toast('身長を正しく入力してください');
    if (!(sw >= 25 && sw <= 300)) return toast('体重を正しく入力してください');
    if (!(gw >= 25 && gw <= 300)) return toast('目標体重を正しく入力してください');
    if (d.goalDate && d.goalDate <= todayKey()) return toast('目標達成日は明日以降の日付にしてください');
    onSubmit({
      id: 1,
      age,
      sex: d.sex,
      heightCm: h,
      startWeight: Math.round(sw * 10) / 10,
      goalWeight: Math.round(gw * 10) / 10,
      goalDate: d.goalDate || undefined,
      activity: d.activity,
      stepGoal: Math.round(steps),
      notes: d.notes.trim() || undefined,
      startDate: initial?.startDate ?? todayKey(),
    });
  };

  const num = (k: keyof Draft, label: string, unit: string, step = '1') => (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="input-wrap">
        <input type="number" inputMode="decimal" step={step} value={d[k] as string} onChange={(e) => set(k, e.target.value as never)} />
        <span className="unit">{unit}</span>
      </span>
    </label>
  );

  return (
    <div className="stack gap-14">
      <div className="grid-2">
        {num('age', '年齢', '歳')}
        <div className="field">
          <span className="field-label">性別</span>
          <div className="seg">
            {(['male', 'female'] as Sex[]).map((s) => (
              <button key={s} className={d.sex === s ? 'on' : ''} aria-pressed={d.sex === s} onClick={() => set('sex', s)}>
                {s === 'male' ? '男性' : '女性'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="grid-2">
        {num('heightCm', '身長', 'cm', '0.1')}
        {num('startWeight', isSetup ? '現在の体重' : '開始時の体重', 'kg', '0.1')}
      </div>
      <div className="grid-2">
        {num('goalWeight', '目標体重', 'kg', '0.1')}
        <label className="field">
          <span className="field-label">目標達成日（任意）</span>
          <span className="input-wrap">
            <input type="date" value={d.goalDate} min={todayKey()} onChange={(e) => set('goalDate', e.target.value)} />
          </span>
          {d.goalDate && (
            <button className="link-btn tiny" onClick={() => set('goalDate', '')}>
              日付をクリア
            </button>
          )}
        </label>
      </div>
      <div className="field">
        <span className="field-label">普段の活動レベル</span>
        <div className="seg vertical">
          {(['low', 'mid', 'high'] as Activity[]).map((a) => (
            <button key={a} className={d.activity === a ? 'on' : ''} aria-pressed={d.activity === a} onClick={() => set('activity', a)}>
              {ACT_LABEL[a]}
            </button>
          ))}
        </div>
      </div>
      {num('stepGoal', '1日の目標歩数', '歩')}
      <label className="field">
        <span className="field-label">食事の制限・アレルギー・苦手なもの（任意）</span>
        <textarea rows={2} value={d.notes} placeholder="例：乳製品が苦手、甲殻類アレルギー" onChange={(e) => set('notes', e.target.value)} />
      </label>
      <button className="btn-primary" onClick={submit}>
        {submitLabel}
      </button>
    </div>
  );
}
