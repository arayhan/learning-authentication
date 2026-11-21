import { Dashboard } from "@/components/game/Dashboard";
import { AppShell } from "@/components/shell/AppShell";
import { ModuleNav } from "@/components/shell/ModuleNav";
import { XpGuide } from "@/components/shell/XpGuide";
import { currentUser } from "@/lib/auth/session";

export default async function Home() {
  const user = await currentUser();
  return (
    <AppShell userName={user.displayName} left={<ModuleNav />} right={<XpGuide />} rightTitle="Panduan XP">
      <Dashboard name={user.displayName} />
    </AppShell>
  );
}
