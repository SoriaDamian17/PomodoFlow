import { AmbientBackground } from "@/app/components/ambient-background";
import { OfflineIndicator } from "@/app/components/offline-indicator";
import { PomodoroDashboard } from "@/app/components/pomodoro-dashboard";
import { ServiceWorkerUpdate } from "@/app/components/service-worker-update";

export default function HomePage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden">
      <AmbientBackground />
      <PomodoroDashboard />
      {/* Global, non-blocking status surfaces: both are client leaves. */}
      <OfflineIndicator />
      <ServiceWorkerUpdate />
    </div>
  );
}
