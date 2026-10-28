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
  // Next's build manifests are not used at runtime. Leaving them out keeps a
  // non-atomic deploy (HTML/SW from one build, `.next/static` from another)
  // from 404ing one entry and aborting the whole install with
  // `bad-precaching-response`. `@serwist/next` validates with the webpack
  // plugin's schema, which exposes asset filters through `exclude` (it does not
  // accept `globIgnores`), so keep the two defaults and add the manifests.
  exclude: [
    /\.map$/,
    /^manifest.*\.js$/,
    /_buildManifest\.js$/,
    /_ssgManifest\.js$/,
  ],
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default withSerwist(nextConfig);
