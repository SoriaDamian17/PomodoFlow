import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  // Never reload on reconnect: the offline banner explains the state and the
  // user decides when to refresh (F033).
  reloadOnOnline: false,
  // Ambient loops (3 × ~190 kB) are part of the precache: every track is
  // playable offline immediately after the first visit (F023 step 6).
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default withSerwist(nextConfig);
