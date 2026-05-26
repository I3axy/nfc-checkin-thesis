export const C = {
  bg0:    '#1b2838',
  bg1:    '#16202d',
  bg2:    '#2a475e',
  border: '#3d4450',
  text:   '#c6d4df',
  muted:  '#8f98a0',
  accent: '#66c0f4',
  green:  '#5ba32b',
  red:    '#c94f4f',
}

export const S = {
  input:        { width: '100%', padding: '0.55rem 0.8rem', fontSize: '0.86rem', background: C.bg0, border: `1px solid ${C.border}`, color: C.text, outline: 'none', boxSizing: 'border-box', borderRadius: 0 },
  btnPrimary:   { padding: '0.6rem 1.25rem', fontSize: '0.86rem', fontWeight: 700, background: C.accent, color: C.bg0, border: 'none', cursor: 'pointer', borderRadius: 0 },
  btnSecondary: { padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 600, background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, cursor: 'pointer', borderRadius: 0 },
  btnIcon:      { background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer', padding: '0.2rem 0.5rem', fontSize: '0.78rem', borderRadius: 0 },
  td:           { padding: '0.65rem 1rem', fontSize: '0.85rem', color: C.text, background: C.bg1 },
  errorBox:     { background: C.red + '15', border: `1px solid ${C.red}40`, padding: '0.5rem 0.75rem', fontSize: '0.82rem', color: C.red },
}
