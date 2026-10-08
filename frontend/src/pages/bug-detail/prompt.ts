import type { AIAnalysis, Bug, Project } from '@/lib/types'

export function buildAgentPrompt(bug: Bug, project: Project | undefined, analysis?: AIAnalysis) {
  const stack = project
    ? [...project.frontend, ...project.backend, ...project.database, ...project.auth].join(', ')
    : 'Unknown stack'
  const rules = project?.businessRules.map((r) => `- ${r.title}: ${r.description}`).join('\n') || '- None specified'
  const evidence = bug.evidence
    .filter((e) => e.type !== 'Screenshot')
    .map((e) => `### ${e.title} (${e.type})\n\`\`\`${e.language ?? ''}\n${e.content}\n\`\`\``)
    .join('\n\n')

  return `You are a senior engineer fixing a production bug. Implement a complete, tested fix.

## Bug ${bug.ref}: ${bug.title}
${bug.description}

## Project context
- Project: ${project?.name ?? 'Unknown'} (${project?.type ?? ''})
- Tech stack: ${stack}
- Architecture: ${project?.architecture ?? 'n/a'}
- Conventions: ${project?.conventions ?? 'n/a'}
- Constraints: ${project?.constraints ?? 'n/a'}

## Business rules to respect
${rules}

## Steps to reproduce
${bug.stepsToReproduce.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## Expected vs. actual
- Expected: ${bug.expectedResult}
- Actual: ${bug.actualResult}
- Environment: ${bug.environment} (${bug.browserDevice})
${analysis
      ? `
## AI root-cause diagnosis (confidence ${analysis.confidence}%)
${analysis.rootCause}

Suggested fix:
${analysis.suggestedFix.summary || analysis.suggestedFix.steps.join('\n')}
${analysis.suggestedFix.code ? `\n\`\`\`\n${analysis.suggestedFix.code}\n\`\`\`` : ''}

Recommended tests:
${analysis.recommendedTests.map((t) => `- ${t}`).join('\n')}`
      : ''
    }

## Evidence
${evidence || 'No evidence attached.'}

## Deliverables
1. Identify the exact file(s) and line(s) to change.
2. Provide the minimal, correct fix as a diff.
3. Add or update tests that prove the fix and prevent regression.
4. Note any follow-up risks or related code paths to review.`
}
