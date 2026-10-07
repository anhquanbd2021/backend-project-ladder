// CLI report: validate the ladder, audit the example paths, run every sim.
// Exit code 1 if the ladder ordering is invalid.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { LADDER, validateLadder, auditPath, rungById } from '../public/ladder.mjs';
import { simulateRung } from '../public/sims.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

console.log('Backend Ladder Lab — report\n');

const v = validateLadder(LADDER);
console.log(`Ladder validation: ${v.ok ? 'OK' : 'INVALID'}`);
for (const e of v.errors) console.log(`  - ${e}`);

console.log('\nRungs:');
for (const r of LADDER) {
  const req = r.requires.length ? `requires ${r.requires.join(', ')}` : 'no prerequisites';
  console.log(`  ${r.rung}. ${r.project.padEnd(22)} teaches ${r.concept.padEnd(28)} (${req})`);
}

console.log('\nExample paths:');
for (const file of ['in-order.json', 'skip-rungs.json']) {
  const fixture = JSON.parse(await readFile(`${root}examples/${file}`, 'utf8'));
  const audit = auditPath(fixture.completed);
  const gaps = audit.gaps.filter(g => g.missing.length > 0);
  console.log(`  ${fixture.name} (${file}): ${audit.completed.length} rungs — ${audit.clean ? 'clean' : 'GAPS'}`);
  for (const g of gaps) {
    console.log(`    ${rungById(g.rung)?.project}: missing ${g.missing.join(', ')} — go back to ${g.missingRungs.join(', ')}`);
  }
  if (audit.next) console.log(`    next unlocked: ${rungById(audit.next).project}`);
}

console.log('\nFailure simulations (without vs with the concept):');
for (const r of LADDER) {
  const wo = simulateRung(r, 'without');
  const w = simulateRung(r, 'with');
  console.log(`  ${r.rung}. ${r.project.padEnd(22)} without: ${wo.outcome.toUpperCase().padEnd(6)} | with: ${w.outcome.toUpperCase().padEnd(2)} — ${wo.summary}`);
}

process.exit(v.ok ? 0 : 1);
