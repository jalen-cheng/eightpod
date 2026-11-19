// Widens what a finger can hit around a small control to about 40px, without changing its size
// or the layout around it. For icons and pills that sit inside rows of text and controls.
export const widePressTarget = (extraPx: number) => ({
  position: 'relative',
  '&::after': { content: '""', position: 'absolute', inset: -extraPx },
} as const);
