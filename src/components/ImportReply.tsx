import { useState } from 'react';
import { db } from '../db';
import { fmtShort } from '../lib/dates';
import { readClipboard, toast } from '../lib/media';
import { parseReply, type Parsed } from '../lib/parse';
import { Icon } from './Icon';

/** Claudeの返答を貼り付けて取り込む */
export function ImportReply({ fallbackDate, onDone }: { fallbackDate: string; onDone?: (p: Parsed) => void }) {
  const [manual, setManual] = useState(false);
  const [text, setText] = useState('');

  const handle = async (t: string) => {
    const p = parseReply(t, fallbackDate);
    if (p.kind === 'error') {
      toast(p.message);
      setManual(true);
      return;
    }
    if (p.kind === 'daily') {
      await db.analyses.put(p.analysis);
      toast(`${fmtShort(p.analysis.date)}の分析を取り込みました${p.analysis.grade ? `（評価 ${p.analysis.grade}）` : ''}`);
    } else {
      await db.weekly.put(p.weekly);
      toast('週次レポートを取り込みました');
    }
    setText('');
    onDone?.(p);
  };

  const fromClipboard = async () => {
    const t = await readClipboard();
    if (!t) {
      toast('クリップボードを読めませんでした。下の欄に貼り付けてください');
      setManual(true);
      return;
    }
    handle(t);
  };

  return (
    <div className="stack gap-8">
      <button className="btn-primary" onClick={fromClipboard}>
        <Icon name="paste" />
        コピーした返答を取り込む
      </button>
      <button className="link-btn small" onClick={() => setManual(!manual)}>
        {manual ? '手動の貼り付け欄を閉じる' : 'うまくいかない場合：手動で貼り付ける'}
      </button>
      {manual && (
        <>
          <textarea rows={5} value={text} placeholder="Claudeの返答をここに貼り付け" aria-label="Claudeの返答" onChange={(e) => setText(e.target.value)} />
          <button className="btn-secondary" disabled={!text.trim()} onClick={() => handle(text)}>
            取り込む
          </button>
        </>
      )}
    </div>
  );
}
