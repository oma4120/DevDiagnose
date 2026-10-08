export function StepShell({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      {children}
    </div>
  )
}
