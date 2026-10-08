import { ListChecks } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label, Textarea, FieldHint } from '@/components/ui/field'

type ReproductionCardProps = {
  stepsToReproduce: string
  expectedResult: string
  actualResult: string
  environment: string
  browserDevice: string
  set: (
    key: 'stepsToReproduce' | 'expectedResult' | 'actualResult' | 'environment' | 'browserDevice',
    value: string,
  ) => void
}

export function ReproductionCard({
  stepsToReproduce,
  expectedResult,
  actualResult,
  environment,
  browserDevice,
  set,
}: ReproductionCardProps) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="size-4 text-muted-foreground" />Reproduction</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="steps">Steps to reproduce</Label>
          <Textarea id="steps" value={stepsToReproduce} onChange={(e) => set('stepsToReproduce', e.target.value)} placeholder={'1. Sign in as any customer with an empty cart.\n2. POST to /v1/checkout.\n3. Observe the response.'} className="min-h-28" />
          <FieldHint>One step per line. Numbered lists work best.</FieldHint>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="expected">Expected result</Label>
            <Textarea id="expected" value={expectedResult} onChange={(e) => set('expectedResult', e.target.value)} placeholder="What should happen." className="min-h-20" />
          </div>
          <div>
            <Label htmlFor="actual">Actual result</Label>
            <Textarea id="actual" value={actualResult} onChange={(e) => set('actualResult', e.target.value)} placeholder="What actually happens." className="min-h-20" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="env">Environment</Label>
            <Input id="env" value={environment} onChange={(e) => set('environment', e.target.value)} placeholder="Staging - staging.shop.northwind.dev" />
          </div>
          <div>
            <Label htmlFor="browser">Browser / device</Label>
            <Input id="browser" value={browserDevice} onChange={(e) => set('browserDevice', e.target.value)} placeholder="Chrome 128 / macOS" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
