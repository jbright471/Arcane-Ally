import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from './ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { BrandMark } from './BrandMark';

export function Layout({ children }: { children: ReactNode }) {
  const { isOnline } = useOnlineStatus();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-h-screen min-w-0">
          <header className="h-14 shrink-0 flex items-center border-b border-border px-4 bg-card/60 backdrop-blur-sm sticky top-0 z-20 shadow-sm shadow-black/30">
            <SidebarTrigger className="mr-4" />
            <div className="flex items-center gap-2">
              <BrandMark size="sm" className="border-primary/30 bg-background/80" />
              <span className="font-display text-sm font-semibold text-primary/80 tracking-widest uppercase">
                Arcane Ally
              </span>
            </div>

            {/* Offline indicator */}
            {!isOnline && (
              <div className="ml-auto flex items-center gap-1.5 mr-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
                </span>
                <WifiOff className="h-3.5 w-3.5 text-orange-400" />
                <span className="text-[10px] text-orange-400 font-semibold uppercase tracking-wider">Offline</span>
              </div>
            )}

            {/* Decorative gold rule at the bottom of the header */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          </header>
          <main className="flex-1 p-6 overflow-y-auto overflow-x-hidden">
            {children}
          </main>
          <footer className="border-t border-border/10 py-4 px-6 text-center text-[10px] md:text-xs text-muted-foreground/40 bg-card/20 shrink-0">
            <p className="max-w-3xl mx-auto leading-normal">
              If you have features, bugs or general inquiry please reach out to{' '}
              <a href="mailto:j.bright@gaming-dojo.net" className="text-muted-foreground/60 hover:text-primary transition-colors">
                j.bright@gaming-dojo.net
              </a>
              . If you like this app please support here:{' '}
              <a
                href="https://www.paypal.com/donate/?hosted_button_id=NGHCPLVCM4HWN"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 hover:underline transition-colors font-medium ml-0.5"
              >
                Donate
              </a>
            </p>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
