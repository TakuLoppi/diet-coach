const PATHS: Record<string, string> = {
  home: 'M4 11l8-7 8 7v9H4z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  chart: 'M5 20V11M11 20V5M17 20v-7M3 20h18',
  chat: 'M4 5h16v11H9l-5 4z',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 9.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7',
  scale: 'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 10a4 4 0 0 1 6 0l-3 3',
  drop: 'M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z',
  gear: 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6M19 12l2-1-1-3-2 .2-1.2-1.2.2-2-3-1-1 2h-2l-1-2-3 1 .2 2L6 7.2 4 7 3 10l2 1v2l-2 1 1 3 2-.2 1.2 1.2-.2 2 3 1 1-2h2l1 2 3-1-.2-2 1.2-1.2 2 .2 1-3-2-1z',
  send: 'M4 12l16-8-6 16-3-7z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  paste: 'M9 4h6v3H9zM7 5H5v16h14V5h-2',
  check: 'M5 12l5 5 9-10',
  dl: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  up: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
};

export function Icon({ name, size = 22, stroke = 2 }: { name: keyof typeof PATHS | string; size?: number; stroke?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}
