import { ChevronRight } from 'lucide-react';
import type { NodePath } from '@/types/collection';
import { useUiStore } from '@/store/uiStore';
import { NodeIcon } from '@/components/ui/NodeIcon';
import { cx } from '@/components/ui/primitives';

export function Breadcrumb({ path }: { path: NodePath }) {
  const select = useUiStore((s) => s.select);
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm whitespace-nowrap">
      {path.map((ref, i) => {
        const last = i === path.length - 1;
        return (
          <span key={ref.node.id} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={13} className="shrink-0 text-muted" />}
            <button
              type="button"
              onClick={() => select(ref.node.id)}
              aria-current={last ? 'page' : undefined}
              className={cx('flex items-center gap-1 rounded px-1 py-0.5 hover:bg-panel-2', last ? 'font-medium' : 'text-muted')}
            >
              <NodeIcon refNode={ref} className={ref.kind === 'request' ? 'w-auto' : undefined} />
              <span className="max-w-48 truncate">{ref.node.name}</span>
            </button>
          </span>
        );
      })}
    </nav>
  );
}
