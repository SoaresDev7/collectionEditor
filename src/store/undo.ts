import { useCollectionStore } from './collectionStore';
import { useHistoryStore, type Snapshot } from './historyStore';
import { notify } from './feedbackStore';

const current = (): Snapshot => {
  const s = useCollectionStore.getState();
  return { collections: s.collections, activeCollectionId: s.activeCollectionId };
};

/** Desfaz a última ação nas collections. */
export function undo(): void {
  const entry = useHistoryStore.getState().undo(current());
  if (!entry) return;
  useCollectionStore.setState(entry.state);
  notify('info', `Desfeito: ${entry.label}`);
}

/** Refaz a última ação desfeita. */
export function redo(): void {
  const entry = useHistoryStore.getState().redo(current());
  if (!entry) return;
  useCollectionStore.setState(entry.state);
  notify('info', `Refeito: ${entry.label}`);
}
