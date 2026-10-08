import { runAcceptanceChecks } from '@/motion/lib/acceptance'

const report = runAcceptanceChecks()
for (const result of report.results) {
  console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${result.name}${result.detail ? ` — ${result.detail}` : ''}`)
}
if (!report.ok) {
  throw new Error('Motion acceptance checks failed.')
}
console.log(`passed ${report.results.length}/${report.results.length}`)
