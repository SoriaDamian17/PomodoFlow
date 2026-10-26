import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // F033: a new version is installed but never takes over a running tab on its
  // own. ServiceWorkerUpdate shows a prompt and posts SKIP_WAITING when the
  // user chooses to reload, so a session is never interrupted by a deploy.
  skipWaiting: false,
  clientsClaim: false,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
