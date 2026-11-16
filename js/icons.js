// Ikoner som inline-SVG (streck, ärver färg via currentColor).
const wrap = (body) =>
  `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

export const icons = {
  mug: wrap('<path d="M5 8h10v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8z"/><path d="M15 10h2a3 3 0 0 1 0 6h-2"/><path d="M5 8a2.5 2.5 0 0 1 1.5-4.5A3 3 0 0 1 12 3a2.5 2.5 0 0 1 3 5"/><path d="M8.5 12v6M11.5 12v6"/>'),
  book: wrap('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>'),
  flame: wrap('<path d="M12 22a7 7 0 0 0 7-7c0-4-3-6-4-9-1 2-2 3-3 3 0-2-1-4-3-6 0 4-4 7-4 12a7 7 0 0 0 7 7z"/>'),
  timer: wrap('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>'),
  chart: wrap('<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>'),
  archive: wrap('<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/>'),
  bubbles: wrap('<circle cx="8" cy="15" r="4"/><circle cx="16" cy="8" r="3"/><circle cx="17" cy="17" r="2"/>'),
  box: wrap('<path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/>'),
  calc: wrap('<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h8"/>'),
  drop: wrap('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>'),
  kettle: wrap('<path d="M5 7h14v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7z"/><path d="M4 7h16M9 4h6M12 4v3"/><path d="M8 16c1.3-1.2 2.7-1.2 4 0s2.7 1.2 4 0"/><path d="M19 12h2"/>'),
  wifi: wrap('<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0"/><circle cx="12" cy="19.5" r="0.6"/>'),
  upload: wrap('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>'),
};
