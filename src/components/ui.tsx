import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="閉じる" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/** 1〜5の段階評価 */
export function Rating({
  label,
  value,
  onChange,
  low,
  high,
}: {
  label: string;
  value?: number;
  onChange: (v: number | undefined) => void;
  low: string;
  high: string;
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="rating" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            className={value === n ? 'on' : ''}
            aria-pressed={value === n}
            onClick={() => onChange(value === n ? undefined : n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="rating-hint">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

/** 入力中はローカルに持ち、フォーカスが外れたら保存する数値欄 */
export function NumField({
  label,
  unit,
  value,
  onCommit,
  step = 'any',
  placeholder,
}: {
  label: string;
  unit?: string;
  value?: number;
  onCommit: (v: number | undefined) => void;
  step?: string;
  placeholder?: string;
}) {
  const [s, setS] = useState(value != null ? String(value) : '');
  useEffect(() => {
    setS(value != null ? String(value) : '');
  }, [value]);
  const commit = () => {
    const t = s.trim();
    const n = t === '' ? undefined : Number(t);
    if (n === undefined || isFinite(n)) {
      if (n !== value) onCommit(n);
    } else setS(value != null ? String(value) : '');
  };
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="input-wrap">
        <input
          inputMode="decimal"
          type="number"
          step={step}
          value={s}
          placeholder={placeholder}
          onChange={(e) => setS(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        {unit && <span className="unit">{unit}</span>}
      </span>
    </label>
  );
}

export function TextField({
  label,
  value,
  onCommit,
  placeholder,
  multiline,
}: {
  label: string;
  value?: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const [s, setS] = useState(value ?? '');
  useEffect(() => {
    setS(value ?? '');
  }, [value]);
  const commit = () => s !== (value ?? '') && onCommit(s);
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {multiline ? (
        <textarea rows={2} value={s} placeholder={placeholder} onChange={(e) => setS(e.target.value)} onBlur={commit} />
      ) : (
        <input type="text" value={s} placeholder={placeholder} onChange={(e) => setS(e.target.value)} onBlur={commit} />
      )}
    </label>
  );
}

export function Bar({ ratio, warn }: { ratio: number; warn?: boolean }) {
  return (
    <div className="bar">
      <div className={warn ? 'bar-fill warn' : 'bar-fill'} style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }} />
    </div>
  );
}

export function Ring({ ratio, size = 120, children }: { ratio: number; size?: number; children?: ReactNode }) {
  const r = 66;
  const c = 2 * Math.PI * r;
  const over = ratio > 1;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--line)" strokeWidth="14" />
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke={over ? 'var(--warn)' : 'var(--accent)'}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${Math.min(1, Math.max(0, ratio)) * c} ${c}`}
          transform="rotate(-90 80 80)"
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}
