import { useState } from 'react';
import type { Profile } from '../db';
import { avgAt, bmi, fmt1, fmtInt } from '../lib/calc';
import { addDays, diffDays, fmtJP, fmtShort, weekday } from '../lib/dates';
import type { AppData } from '../lib/useData';

const RANGES = [
  { days: 14, label: '2週間' },
  { days: 30, label: '1か月' },
  { days: 90, label: '3か月' },
];

export function Analysis({ profile, data }: { profile: Profile; data: AppData }) {
  const [range, setRange] = useState(30);
  const t = data.targets;
  const pred = data.prediction;

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>分析</h1>
      </header>

      <section className="card gap-10">
        <div className="row between">
          <h3>体重の推移</h3>
          <div className="seg small">
            {RANGES.map((r) => (
              <button key={r.days} className={range === r.days ? 'on' : ''} aria-pressed={range === r.days} onClick={() => setRange(r.days)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <WeightChart data={data} goal={profile.goalWeight} days={range} />
        <div className="row gap-12 tiny sub">
          <span className="row gap-4">
            <span className="legend-dot" />
            毎日の体重
          </span>
          <span className="row gap-4">
            <span className="legend-line" />
            7日平均
          </span>
          <span className="row gap-4">
            <span className="legend-dash" />
            目標
          </span>
        </div>
        <p className="small">
          {pred.status === 'ok' && (
            <>
              達成予測：<strong className="accent">{fmtJP(pred.date)}</strong>（週{fmt1(pred.perWeek)}kgペース）
              {profile.goalDate && (
                <span className="sub">
                  {' '}
                  ／目標日 {fmtJP(profile.goalDate)}
                  {pred.date > profile.goalDate ? ' に間に合わないペース' : ' に間に合うペース'}
                </span>
              )}
            </>
          )}
          {pred.status === 'insufficient' && <span className="sub">直近3週間で体重を7日以上記録すると、達成予測日が出ます。</span>}
          {pred.status === 'flat' && <span className="warn">直近3週間、体重がほぼ減っていません。</span>}
          {pred.status === 'reached' && <span className="accent bold">目標体重に到達しました！</span>}
        </p>
        {data.plateau && <div className="notice">停滞期の可能性あり：7日平均が2週間で0.2kg以上減っていません。次の報告でコーチが原因を分析します。</div>}
      </section>

      <section className="card gap-10">
        <h3>摂取カロリー（コーチの推定）</h3>
        <KcalChart data={data} />
        <p className="sub tiny">線は1日の目標 {fmtInt(t.kcal)}kcal</p>
      </section>

      <section className="card gap-10">
        <h3>最近の評価</h3>
        <GradeStrip data={data} />
      </section>

      <section className="card gap-10">
        <h3>あなたの目標値</h3>
        <div className="stat-grid">
          <Stat label="BMI" value={fmt1(bmi(profile, data.weight))} />
          <Stat label="基礎代謝" value={`${fmtInt(t.bmr)}`} unit="kcal" />
          <Stat label="消費の目安" value={`${fmtInt(t.tdee)}`} unit="kcal" />
          <Stat label="摂取目標" value={`${fmtInt(t.kcal)}`} unit="kcal" />
          <Stat label="P / F / C" value={`${t.protein}/${t.fat}/${t.carbs}`} unit="g" />
          <Stat label="水分 / 歩数" value={`${fmt1(t.water / 1000)}L`} unit={`${fmtInt(t.steps)}歩`} />
        </div>
        <p className="sub tiny">
          基礎代謝はMifflin-St Jeor式による推定値です。摂取目標は{profile.goalDate ? '目標日から逆算し' : '1日500kcalの赤字を基準に'}
          、1日250〜750kcalの赤字の範囲で、基礎代謝を下回らないように計算しています。
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="stat">
      <span className="sub tiny">{label}</span>
      <span className="display" style={{ fontSize: value.length > 7 ? 19 : 26, whiteSpace: 'nowrap' }}>
        {value}
      </span>
      {unit && <span className="sub tiny">{unit}</span>}
    </div>
  );
}

function WeightChart({ data, goal, days }: { data: AppData; goal: number; days: number }) {
  const W = 340;
  const H = 180;
  const P = { l: 34, r: 8, t: 10, b: 22 };
  const start = addDays(data.today, -(days - 1));
  const pts = data.series.filter((s) => s.date >= start);
  if (pts.length < 2) return <p className="sub small empty">体重を2日以上記録するとグラフが表示されます。</p>;
  const ma = pts.map((p) => ({ date: p.date, v: avgAt(data.series, p.date)! }));
  const vals = [...pts.map((p) => p.weight), goal];
  const min = Math.floor(Math.min(...vals) - 0.5);
  const max = Math.ceil(Math.max(...vals) + 0.5);
  const x = (d: string) => P.l + (diffDays(start, d) / (days - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + ((max - v) / (max - min)) * (H - P.t - P.b);
  const ticks = Array.from({ length: 4 }, (_, i) => min + ((max - min) * i) / 3);
  return (
    <svg role="img" aria-label={`直近${days}日の体重グラフ`} viewBox={`0 0 ${W} ${H}`} className="chart">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
          <text x={P.l - 6} y={y(v) + 4} textAnchor="end" className="axis">
            {v.toFixed(1)}
          </text>
        </g>
      ))}
      <line x1={P.l} x2={W - P.r} y1={y(goal)} y2={y(goal)} stroke="var(--warn)" strokeWidth="1.5" strokeDasharray="5 4" />
      {pts.map((p) => (
        <circle key={p.date} cx={x(p.date)} cy={y(p.weight)} r="3" fill="var(--sub)" />
      ))}
      <polyline fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={ma.map((m) => `${x(m.date)},${y(m.v)}`).join(' ')} />
      <text x={P.l} y={H - 4} className="axis">
        {fmtShort(start)}
      </text>
      <text x={W - P.r} y={H - 4} textAnchor="end" className="axis">
        {fmtShort(data.today)}
      </text>
    </svg>
  );
}

function KcalChart({ data }: { data: AppData }) {
  const days = 14;
  const W = 340;
  const H = 150;
  const P = { l: 34, r: 8, t: 10, b: 22 };
  const list = Array.from({ length: days }, (_, i) => addDays(data.yesterday, -(days - 1 - i)));
  const vals = list.map((d) => data.anMap.get(d)?.kcal);
  if (!vals.some((v) => v != null)) return <p className="sub small empty">コーチの分析を取り込むと、推定カロリーが表示されます。</p>;
  const target = data.targets.kcal;
  const max = Math.max(target * 1.3, ...vals.map((v) => v ?? 0));
  const bw = (W - P.l - P.r) / days;
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  return (
    <svg role="img" aria-label="直近14日の摂取カロリー" viewBox={`0 0 ${W} ${H}`} className="chart">
      {list.map((d, i) => {
        const v = vals[i];
        return (
          <g key={d}>
            {v != null && (
              <rect x={P.l + i * bw + 3} y={y(v)} width={bw - 6} height={H - P.b - y(v)} rx="3" fill={v > target ? 'var(--warn)' : 'var(--accent)'} />
            )}
            {(i % 2 === 1 || i === days - 1) && (
              <text x={P.l + i * bw + bw / 2} y={H - 6} textAnchor="middle" className="axis">
                {fmtShort(d)}
              </text>
            )}
          </g>
        );
      })}
      <line x1={P.l} x2={W - P.r} y1={y(target)} y2={y(target)} stroke="var(--text)" strokeWidth="1.5" strokeDasharray="5 4" />
      <text x={P.l - 6} y={y(target) + 4} textAnchor="end" className="axis">
        {fmtInt(target)}
      </text>
    </svg>
  );
}

function GradeStrip({ data }: { data: AppData }) {
  const list = Array.from({ length: 14 }, (_, i) => addDays(data.yesterday, -(13 - i)));
  return (
    <div className="grades">
      {list.map((d) => {
        const g = data.anMap.get(d)?.grade;
        const bad = g && /^[CD]/.test(g);
        return (
          <div key={d} className="grade-cell">
            <span className={g ? (bad ? 'g bad' : 'g') : 'g empty'}>{g ?? '–'}</span>
            <span className="tiny sub">{weekday(d)}</span>
          </div>
        );
      })}
    </div>
  );
}
