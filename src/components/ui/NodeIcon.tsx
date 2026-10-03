import { FlaskConical, Folder, FolderOpen, Hash, Library } from 'lucide-react';
import type { NodeRef } from '@/types/collection';
import { cx } from './primitives';

/** Ícone do nível; requisições mostram o método HTTP abreviado. */
export function NodeIcon({ refNode, open = false, className }: { refNode: NodeRef; open?: boolean; className?: string }) {
  const size = 15;
  switch (refNode.kind) {
    case 'collection':
      return <Library size={size} className={cx('shrink-0 text-accent', className)} />;
    case 'folder':
      return open ? (
        <FolderOpen size={size} className={cx('shrink-0 text-amber-500', className)} />
      ) : (
        <Folder size={size} className={cx('shrink-0 text-amber-500', className)} />
      );
    case 'scenario':
      return <FlaskConical size={size} className={cx('shrink-0 text-sky-500', className)} />;
    case 'testId':
      return <Hash size={size} className={cx('shrink-0 text-violet-500', className)} />;
    case 'request':
      return (
        <span className={cx('w-9 shrink-0 text-[10px] font-bold tracking-tight', `method-${refNode.node.method}`, className)}>
          {refNode.node.method === 'DELETE' ? 'DEL' : refNode.node.method === 'OPTIONS' ? 'OPT' : refNode.node.method}
        </span>
      );
  }
}
