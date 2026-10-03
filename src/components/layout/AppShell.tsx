import { useEffect, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { useSelectedPath } from '@/hooks/useSelection';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { NodeEditor } from '@/components/editors/NodeEditor';
import { VariablesPanel } from '@/components/variables/VariablesPanel';
import { ConfirmDialog, PromptDialog, Toasts } from '@/components/ui/Feedback';
import { IconButton, cx } from '@/components/ui/primitives';
import { Header } from './Header';
import { Breadcrumb } from './Breadcrumb';

export function AppShell() {
  const path = useSelectedPath();
  const showVariables = useUiStore((s) => s.showVariablesPanel);
  const theme = useUiStore((s) => s.theme);
  const selectedId = useUiStore((s) => s.selectedId);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useKeyboardShortcuts();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Em telas estreitas a árvore vira gaveta: fecha ao escolher um item.
  useEffect(() => {
    setSidebarOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
  }, [selectedId]);

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="relative flex min-h-0 flex-1">
        <div
          className={cx(
            'absolute inset-y-0 left-0 z-20 w-72 shrink-0 transition-transform lg:static lg:translate-x-0',
            sidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full',
          )}
        >
          <Sidebar />
        </div>
        {sidebarOpen && <div className="absolute inset-0 z-10 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

        <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto">
          {path ? (
            <>
              <div className="sticky top-0 z-[5] flex items-center gap-2 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur">
                <IconButton label="Abrir árvore" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
                  <Menu size={16} />
                </IconButton>
                <Breadcrumb path={path} />
              </div>
              <div className="mx-auto max-w-5xl p-4 md:p-6">
                <NodeEditor path={path} />
              </div>
            </>
          ) : (
            <div className="p-8 text-muted">Nenhuma collection. Clique em “Nova” para começar.</div>
          )}
        </main>

        {showVariables && path && (
          <div className="hidden w-72 shrink-0 xl:block">
            <VariablesPanel path={path} />
          </div>
        )}
      </div>
      <Toasts />
      <ConfirmDialog />
      <PromptDialog />
    </div>
  );
}
