import { Bot, Check, ListChecks, MessageSquarePlus, Send } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { Bug, Comment } from '@/lib/types'

const commentAccent: Record<Comment['authorKind'], string> = {
  QA: 'bg-cyan',
  Developer: 'bg-indigo',
  System: 'bg-slate-400',
  AI: 'bg-violet-500',
}

export function InvestigationTab({
  bug,
  comment,
  onCommentChange,
  onAddComment,
}: {
  bug: Bug
  comment: string
  onCommentChange: (value: string) => void
  onAddComment: () => void
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Description</CardTitle></CardHeader>
        <CardContent><p className="text-sm leading-relaxed text-muted-foreground">{bug.description}</p></CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="size-4 text-muted-foreground" />Steps to reproduce</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {bug.stepsToReproduce.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-muted-foreground">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-soft text-[11px] font-medium text-foreground">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Expected vs. actual</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">Expected</p>
              <p className="mt-1 text-muted-foreground">{bug.expectedResult}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-error">Actual</p>
              <p className="mt-1 text-muted-foreground">{bug.actualResult}</p>
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Environment</p>
              <p className="mt-1 text-muted-foreground">{bug.environment}</p>
              <p className="text-xs text-muted-foreground">{bug.browserDevice}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Discussion */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquarePlus className="size-4 text-muted-foreground" />Discussion</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {bug.comments.length ? (
            <ul className="space-y-4">
              {bug.comments.map((c) => (
                <li key={c.id} className="flex gap-3">
                  {c.authorKind === 'AI' ? (
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white"><Bot className="size-4" /></span>
                  ) : c.authorKind === 'System' ? (
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600"><Check className="size-4" /></span>
                  ) : (
                    <Avatar name={c.authorName} size="md" color={c.authorKind === 'QA' ? '#06b6d4' : '#6366f1'} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{c.authorName}</span>
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white', commentAccent[c.authorKind])}>{c.authorKind}</span>
                      <span className="text-xs text-muted-foreground">{c.at}</span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No comments yet. Start the investigation below.</p>
          )}

          <div className="flex items-start gap-3 border-t border-border pt-4">
            <Avatar name="You" color="#6366f1" size="md" />
            <div className="flex-1">
              <textarea
                value={comment}
                onChange={(e) => onCommentChange(e.target.value)}
                placeholder="Add a comment or investigation note…"
                className="min-h-16 w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={onAddComment}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo px-3 text-xs font-medium text-white hover:bg-indigo/90"
                >
                  <Send className="size-3.5" />Comment
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
