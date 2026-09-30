import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { AutorProvider } from "@/components/sync/autor-provider";
import { SyncProvider } from "@/components/sync/sync-provider";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AutorProvider>
      <SyncProvider>
        <AppHeader />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] print:max-w-none print:p-0">
          {children}
        </main>
        <BottomNav />
      </SyncProvider>
    </AutorProvider>
  );
}
