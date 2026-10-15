export const LOGO_PRESETS = {
  silver: { label: 'chrome', family: 'metal', note: 'sharp reflections. cool silver.', repetition: 2.5, softness: 0.12, distortion: 0.08, contour: 0.45, angle: 65, tint: '#ffffff', shift: 0 },
  molten: { label: 'molten', family: 'metal', note: 'slow, liquid, a little heavier.', repetition: 1.6, softness: 0.3, distortion: 0.4, contour: 0.7, angle: 110, tint: '#ffffff', shift: 0 },
  pearl: { label: 'pearl', family: 'metal', note: 'soft light with a violet edge.', repetition: 3.4, softness: 0.65, distortion: 0.15, contour: 0.3, angle: 25, tint: '#e8e4ff', shift: 0.08 },
  heat: { label: 'ember', family: 'heat', note: 'house orange, turned up.', colors: ['#461707', '#a52b08', '#e23d00', '#ff8b45', '#ffe2bd', '#ffffff'], contour: 0.85, innerGlow: 0.25, outerGlow: 0.2, angle: 40 },
  thermal: { label: 'thermal', family: 'heat', note: 'cold blue into red hot.', colors: ['#071441', '#183bce', '#33baf7', '#f5f282', '#ff622f', '#b90027'], contour: 0.7, innerGlow: 0.5, outerGlow: 0.4, angle: 120 },
  ice: { label: 'ice', family: 'heat', note: 'electric blue. white light.', colors: ['#07152e', '#122f72', '#2179cb', '#6acfee', '#c4f7ff', '#ffffff'], contour: 0.9, innerGlow: 0.3, outerGlow: 0.25, angle: 70 },
} as const

export type LogoPreset = keyof typeof LOGO_PRESETS
export const LOGO_BACKGROUNDS = { black: '#0a0a0a', navy: '#0c1b30', white: '#f3f4f6' } as const
export type LogoBackground = keyof typeof LOGO_BACKGROUNDS
