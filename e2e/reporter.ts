import { writeFileSync } from 'node:fs';
import type { FullResult, Reporter, Suite } from '@playwright/test/reporter';

const categories = ['Auth/Session','Permission','Cross-Tenant Denial','API Error','Security','Regression'];
export default class AcceptanceReporter implements Reporter {
  private suite?: Suite;
  onBegin(_config: unknown, suite: Suite) { this.suite = suite; }
  onEnd(result: FullResult) {
    const cases = (this.suite?.allTests() ?? []).map(test => ({
      category:categories.find(category=>test.titlePath().includes(category)) ?? 'Uncategorized',
      name:test.title,
      status:test.outcome() === 'expected' && test.results.at(-1)?.status === 'passed' ? 'PASS' : 'FAIL',
    }));
    const table = '| Acceptance category | Passed | Failed / not run | Result |\n|---|---:|---:|---|\n'+categories.map(category=>{
      const rows = cases.filter(row=>row.category===category);
      const passed = rows.filter(row=>row.status==='PASS').length;
      return `| ${category} | ${passed} | ${rows.length-passed} | ${rows.length>0 && passed===rows.length ? 'PASS' : 'FAIL / missing coverage'} |`;
    }).join('\n');
    const text = '## End-to-end acceptance categories (Chromium)\n\nRun: **'+result.status+'**. Each case uses real seeded browser sessions and the production web/API proxy. Phase 1 covers boundaries and existing error shells; full product UI flows await the screens merge.\n\n'+table+'\n\n| Category | Case | Result |\n|---|---|---|\n'+cases.map(row=>`| ${row.category} | ${row.name.replaceAll('|','\\|')} | ${row.status} |`).join('\n')+'\n';
    if (process.env.E2E_REPORT_PATH) writeFileSync(process.env.E2E_REPORT_PATH,text);
  }
}
