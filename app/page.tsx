import { AmbientBackground } from "@/app/components/ambient-background";
import { PomodoroDashboard } from "@/app/components/pomodoro-dashboard";

export default function HomePage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden">
      <AmbientBackground />
      <PomodoroDashboard />
    </div>
  );
}
