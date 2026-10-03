import { useMemo, useState } from 'react';
import { Bookmark, ClipboardCopy, Download } from 'lucide-react';
import { useActiveCollection } from '@/store/collectionStore';
import { useBaselineStore } from '@/store/baselineStore';
import { useDialogStore } from '@/store/dialogStore';
import { confirmDialog, notify } from '@/store/feedbackStore';
import { diffCollections, hasChanges } from '@/lib/changes/diff';
import { buildCommitMessage, buildMarkdownReport } from '@/lib/changes/report';
import { nowIso } from '@/lib/ids';
import { Button, Tabs } from '@/components/ui/primitives';
import { LargeDialog } from '@/components/ui/LargeDialog';

function download(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportDialog() {
  const open = useDialogStore((s) => s.report);
  if (!open) return null;
  return <ReportContent />;
}

function ReportContent() {
  const collection = useActiveCollection();
  const baseline = useBaselineStore((s) => (collection ? s.baselines[collection.id] : undefined));
  const setBaseline = useBaselineStore((s) => s.setBaseline);
  const close = () => useDialogStore.getState().setReport(false);
  const [tab, setTab] = useState<'markdown' | 'commit'>('markdown');

  const result = useMemo(() => {
    if (!collection || !baseline) return null;
    const diff = diffCollections(baseline.snapshot, collection);
    const meta = { collectionName: collection.name, baselineAt: baseline.takenAt, generatedAt: nowIso() };
    return { diff, markdown: buildMarkdownReport(diff, meta), commit: buildCommitMessage(diff, meta) };
  }, [collection, baseline]);

  if (!collection) return null;
  const text = result ? (tab === 'markdown' ? result.markdown : result.commit) : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      notify('success', 'Copiado para a área de transferência.');
    } catch {
      notify('error', 'Não foi possível copiar. Selecione o texto e copie manualmente.');
    }
  };

  const markBaseline = async () => {
    const ok = await confirmDialog({
      title: 'Marcar como base',
      message: 'O estado atual vira a nova base e o relatório passa a mostrar apenas o que mudar daqui em diante. Faça isso depois de compartilhar o relatório ou de fazer o commit.',
      confirmLabel: 'Marcar como base',
    });
    if (!ok) return;
    setBaseline(collection);
    notify('success', 'Nova base registrada.');
  };

  return (
    <LargeDialog
      title="Relatório de alterações"
      subtitle={baseline ? `Comparando com a base de ${new Date(baseline.takenAt).toLocaleString()}` : 'Sem base registrada'}
      onClose={close}
      footer={
        <>
          <Button icon={<Bookmark size={14} />} className="mr-auto" onClick={markBaseline} disabled={!result || !hasChanges(result.diff)}>
            Marcar estado atual como base
          </Button>
          <Button icon={<Download size={14} />} onClick={() => download(text, tab === 'markdown' ? `alteracoes-${collection.name}.md` : 'commit-message.txt')}>
            Baixar
          </Button>
          <Button variant="primary" icon={<ClipboardCopy size={14} />} onClick={copy}>
            Copiar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 p-5">
        <Tabs
          value={tab}
          onChange={(t) => setTab(t as 'markdown' | 'commit')}
          tabs={[
            { id: 'markdown', label: 'Relatório (Markdown)' },
            { id: 'commit', label: 'Mensagem de commit' },
          ]}
        />
        <p className="text-xs text-muted">
          {tab === 'markdown'
            ? 'Cole em um PR, Slack, Teams ou wiki: o Markdown é renderizado nessas ferramentas.'
            : 'Título curto + lista de alterações, pronta para `git commit -F commit-message.txt`.'}
        </p>
        <pre className="max-h-[60vh] overflow-auto rounded-md border border-line bg-panel-2 p-4 font-mono text-[13px] whitespace-pre-wrap">{text}</pre>
      </div>
    </LargeDialog>
  );
}
