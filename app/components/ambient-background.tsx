/**
 * Decorative ambient scene behind the dashboard.
 *
 * This is a CSS/SVG stand-in for the wallpaper in docs/pomodoro-draft.png so the
 * shell ships without a binary asset. When the final artwork lands, swap the
 * inner layers for a `next/image` with priority and keep the scrim/vignette
 * layers on top (see F017 in docs/feature_list.json).
 */
export function AmbientBackground() {
  return (
    <div aria-hidden="true" className="scene">
      <div className="scene__glow" />
      <div className="scene__sun" />
      <div className="scene__water" />
      <div className="scene__reflection" />

      <svg
        className="scene__ridges"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMax slice"
      >
        {/* Distant ridge, closed at the horizon (y = 620). */}
        <path
          className="scene__ridge-far"
          d="M0 620V540l60-20 60-20 60 12 60-42 60-15 60 35 60 15 50-35 70-22 60 32 50 25 60-35 70 30 60-20 70 40 50-15 60-45 60 28 60-18 60 35 60-15 60-40 60 45 60-15V620Z"
        />
        {/* Mid ridge, closer and darker. */}
        <path
          className="scene__ridge-mid"
          d="M0 620v-35l70-15 70-25 70 30 70-15 70 25 60-15 70-25 70 27 70-17 70 35 70-20 70-25 70 35 70-20 70 30 70-20 70-25 70 35 70-15 70 30 50-15V620Z"
        />
        {/* Foreground banks that frame the water. */}
        <path
          className="scene__ridge-near"
          d="M0 900v-62l70-12 70 16 75-22 65 30 70-12 70 32 80 30Z"
        />
        <path
          className="scene__ridge-near"
          d="M860 900l70-62 70-26 60 23 60-35 70 30 60-15 70 30 60-17 60 20V900Z"
        />
      </svg>

      <div className="scene__haze" />
      <div className="scene__scrim" />
      <div className="scene__vignette" />
    </div>
  );
}
