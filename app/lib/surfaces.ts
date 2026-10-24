export const SURFACES = [
  "timer",
  "streak",
  "insights",
  "settings",
  "tasks",
  "music",
] as const;

export type Surface = (typeof SURFACES)[number];
