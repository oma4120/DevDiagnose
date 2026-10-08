import { Code2, Image as ImageIcon, Paperclip } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CodeBlock } from '@/components/ui/code-block'
import { EmptyState } from '@/components/empty-state'
import type { Bug, Member } from '@/lib/types'

export function EvidenceTab({
  bug,
  memberById,
}: {
  bug: Bug
  memberById: (id: string | undefined) => Member | undefined
}) {
  return (
    <div className="space-y-4">
      {bug.evidence.length ? (
        bug.evidence.map((e) => {
          const addedBy = memberById(e.addedBy)
          return (
            <Card key={e.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {e.fileUrl ? (
                    <ImageIcon className="size-4 text-muted-foreground" />
                  ) : e.language ? (
                    <Code2 className="size-4 text-muted-foreground" />
                  ) : (
                    <Paperclip className="size-4 text-muted-foreground" />
                  )}
                  {e.title}
                  <span className="rounded-md bg-soft px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{e.type}</span>
                </CardTitle>
                <span className="text-xs text-muted-foreground">{addedBy?.name} · {e.addedAt}</span>
              </CardHeader>
              <CardContent>
                {e.fileUrl ? (
                  <div className="space-y-2">
                    <a href={e.fileUrl} target="_blank" rel="noreferrer">
                      <img
                        src={e.fileUrl}
                        alt={e.title}
                        className="max-h-80 w-auto max-w-full rounded-lg border border-border bg-soft object-contain"
                      />
                    </a>
                    <p className="text-xs text-muted-foreground">Display only - not sent to the AI analysis.</p>
                    {e.content && <p className="text-sm leading-relaxed text-muted-foreground">{e.content}</p>}
                  </div>
                ) : e.language ? (
                  <CodeBlock code={e.content} language={e.language} label={e.type} />
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground">{e.content}</p>
                )}
              </CardContent>
            </Card>
          )
        })
      ) : (
        <EmptyState icon={Paperclip} title="No evidence attached" description="Add logs, stack traces, or code to improve AI diagnosis." />
      )}
    </div>
  )
}
