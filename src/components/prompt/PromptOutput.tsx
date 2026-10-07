import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { copyText } from '@/lib/copy'
import { compilePrompt } from '@/lib/prompt/promptCompiler'
import { compileSceneCode } from '@/lib/prompt/sceneCode'
import { useSceneStore } from '@/store/sceneStore'

export function PromptOutput() {
  const prompt = useSceneStore((state) => compilePrompt(state))
  const code = useSceneStore((state) => compileSceneCode(state))
  const [copied, setCopied] = useState<'prompt' | 'code' | null>(null)

  async function copy(kind: 'prompt' | 'code', text: string) {
    await copyText(text)
    setCopied(kind)
    window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 1600)
  }

  return (
    <section className="flex h-[248px] shrink-0 flex-col overflow-hidden rounded-xl border border-line bg-panel/90">
      <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-line px-3">
        <h2 className="text-[11px] uppercase tracking-[0.16em] text-muted">Generated prompt</h2>
        <div className="flex items-center gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={() => useSceneStore.getState().resetScene()}>
            Reset scene
          </Button>
          <Button type="button" size="sm" onClick={() => void copy('prompt', prompt)}>
            {copied === 'prompt' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied === 'prompt' ? 'Copied' : 'Copy prompt'}
          </Button>
        </div>
      </header>
      <textarea
        readOnly
        value={prompt}
        className="min-h-0 flex-1 resize-none bg-transparent px-3 py-2.5 font-sans text-[13px] leading-relaxed text-ink outline-none"
        aria-label="Generated prompt"
      />
      <div className="flex items-center gap-2 border-t border-line px-3 py-2">
        <p className="min-w-0 flex-1 truncate font-mono text-[10px] text-faint" title={code}>
          {code}
        </p>
        <button
          type="button"
          className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-muted hover:text-ink"
          onClick={() => void copy('code', code)}
        >
          {copied === 'code' ? 'Copied' : 'Copy code'}
        </button>
      </div>
    </section>
  )
}
