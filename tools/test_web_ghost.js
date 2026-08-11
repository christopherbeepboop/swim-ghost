//
//  test_web_ghost.js
//  Schedule tests for the web Ghost engine.
//
//  The engine lives inline in index.html — one self-contained file is the
//  whole point of the web build — so this pulls the first <script> block out and
//  runs it in a bare VM context. Nothing here touches the DOM: it is the swim
//  schedule being checked, not the drawing.
//
//      node tools/test_web_ghost.js
//
//  The expected numbers come from the watch app, not from this port: the tier
//  marker angles are the ones quoted verbatim in GhostClockView.turns(forTier:),
//  and the weighted rep lengths are the ones in the GhostLadder doc comment.
//

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const ctx = vm.createContext({});
vm.runInContext(source, ctx);
const { GhostEngine, multiplier, PHASE, advanceLadder } = vm.runInContext(
  '({ GhostEngine, multiplier, PHASE, advanceLadder })', ctx);

const results = [];
const check = (name, pass, got) => results.push([pass, name, got]);

/* ---------------------------------------------- a whole session, end to end */

function runSession({ baseline, level, rest }) {
  const e = new GhostEngine({ baseline, level, restSeconds: rest });
  let pulses = 0;
  const fire = e.firePulse.bind(e);
  e.firePulse = () => { pulses++; fire(); };

  e.start(0);
  const log = [];
  let prev = null, prevPulses = 0;
  let t = 0;
  for (; t < 20000; t += 0.05) {
    e.tick(t);
    const key = `${e.phase}/${e.activeTier}/${e.repIndex}`;
    if (key !== prev) {
      if (prev !== null) log.push({ at: +t.toFixed(2), seg: prev, pulses: pulses - prevPulses });
      prev = key; prevPulses = pulses;
    }
    if (e.phase === PHASE.finished) break;
  }
  return { log, pulses, total: +t.toFixed(2) };
}

const r = runSession({ baseline: 60, level: 4, rest: 45 });
console.log('baseline 60s, level 4, rest 45s\n');
for (const l of r.log) {
  console.log(`  ${String(l.at).padStart(8)}s  ${l.seg.padEnd(16)} ${l.pulses} pulses`);
}
console.log(`\n  ${r.pulses} pulses, ${r.total}s = ${(r.total / 60).toFixed(1)} min\n`);

// 5 warmup + 30 rep + 5 cooldown laps = 80 lengths, plus the pulse that ends
// the opening 5,4,3,2,1 — which opens a segment rather than closing a length.
check('81 pulses (80 lengths + the lead-in GO)', r.pulses === 81, r.pulses);
// 5 lead-in + 300 warmup + 4x45 rest + 3x564 rep + 300 cooldown.
check('session is 2477s', Math.abs(r.total - 2477) < 0.3, r.total);

/* ------------------------------------------------------------- the ladder */

const weighted = [];
for (let lv = 1; lv <= 6; lv++) {
  const lap = (tier) => 60 * multiplier(tier, lv);
  weighted.push(+((2 * lap(0) + 4 * lap(1) + 4 * lap(2)) / 60).toFixed(1));
}
check('weighted rep runs 10.0 9.8 9.6 9.4 9.3 9.1',
  weighted.join(' ') === '10 9.8 9.6 9.4 9.3 9.1', weighted.join(' '));

/* ------------------------------------------- faster-tier marks on the dial */
//
//  "At level 4 the marks land at 0.95 -> 342 and 0.90 -> 324 on tier 0; on
//   tier 1 the single 0.90 mark sits at 0.90/0.95 = 0.947 -> 341, slightly
//   LATER in the revolution than it was a gear ago, because the whole dial has
//   already sped up beneath it."  — GhostClockView.swift
//
{
  const e = new GhostEngine({ baseline: 60, level: 4, restSeconds: 30 });
  e.phase = PHASE.racing;
  const marks = (level, tier) => {
    e.level = level;
    e.activeTier = tier;
    return e.paceMarks().map((m) => Math.round(m.turns * 3600) / 10).join(' ');
  };

  check('level 4, tier 0: marks at 342 and 324', marks(4, 0) === '342 324', marks(4, 0));
  check('level 4, tier 1: mark at 341.1', marks(4, 1) === '341.1', marks(4, 1));

  // A tier at THIS tier's pace would put its mark on the 12, under the stub
  // already waiting there. It is not a gear to chase, so it isn't drawn.
  check('level 5, tier 0: the level tier-1 mark is dropped, only 0.90 is drawn',
    marks(5, 0) === '341.1', marks(5, 0));
  check('level 1: every tier shares a pace, so nothing is drawn',
    marks(1, 0) === '', `"${marks(1, 0)}"`);
  check('level 6, tier 1: the second 0.90 is not a gear above it',
    marks(6, 1) === '', `"${marks(6, 1)}"`);
  // Level 6 runs 0.90 twice; both would land on the same angle.
  check('level 6, tier 0: the doubled 0.90 mark is drawn once',
    marks(6, 0) === '341.1', marks(6, 0));
  check('the closing tier never has a gear above it',
    [1, 2, 3, 4, 5, 6].every((lv) => marks(lv, 2) === ''), 'ok');
}

/* ------------------------------------------- colour tracks pace, not tier */
//
//  The face colours a lap by what it multiplies the baseline by, so the same
//  colour always means the same speed. On the top rung two tiers share ×0.90
//  and so share a colour — that is the point, not a collision.
//
{
  const colour = (tier, level) => Math.round((1 - multiplier(tier, level)) / 0.05);   // 0 blue, 1 yellow, 2 red
  const row = (level) => [0, 1, 2].map((t) => colour(t, level)).join('');
  check('level 4 is blue / yellow / red', row(4) === '012', row(4));
  check('level 6 is yellow / red / red', row(6) === '122', row(6));
  check('level 1 is blue throughout', row(1) === '000', row(1));
  check('every rung maps onto one of the three colours',
    [1, 2, 3, 4, 5, 6].every((lv) => [0, 1, 2].every((t) => [0, 1, 2].includes(colour(t, lv)))), 'ok');
}

/* ------------------------------------------------- moving up the ladder */
//
//  A rung below the top is just the next rung. ON the top rung the baseline
//  drops instead and the caterpillar restarts, because a seventh rung would be
//  0.90/0.90/0.90 — level 1 again at nine tenths of the baseline, the identical
//  ghost.
//
{
  const step = (lv, base) => { const n = advanceLadder(lv, base); return `${n.level}@${n.baseline}`; };
  check('level 4 goes to 5 on the same baseline', step(4, 60) === '5@60', step(4, 60));
  check('the top rung rebases: level 6 at 60s becomes level 1 at 54s',
    step(6, 60) === '1@54', step(6, 60));
  // Rounding from the STORED baseline each cycle keeps the error from compounding.
  check('a rebased baseline is whole seconds', step(6, 55) === '1@50', step(6, 55));
  check('the baseline never falls below 20s', step(6, 21) === '1@20', step(6, 21));
  // Six passes take a whole cycle: level 1 back to level 1, 10% quicker.
  {
    let s = { level: 1, baseline: 60 };
    for (let i = 0; i < 6; i++) s = advanceLadder(s.level, s.baseline);
    check('six passes complete a cycle: level 1 at 54s', `${s.level}@${s.baseline}` === '1@54', `${s.level}@${s.baseline}`);
  }
}

/* --------------------------------------------- the hand arrives upright */

{
  const e = new GhostEngine({ baseline: 60, level: 4, restSeconds: 30 });
  e.start(0);
  let worst = 0;
  for (let t = 0; t < 2600; t += 0.05) {
    e.tick(t);
    if (!e.isPacing || e.awaitingFirstPulse) continue;
    if (Math.abs(e.nextPulse - t) >= 0.05) continue;      // not at a wall
    const p = e.lapPhase(t);
    // A wall is either the lap's close (12 o'clock) or its turn (6 o'clock).
    worst = Math.max(worst, Math.min(Math.abs(p - 1), Math.abs(p - 0.5), p));
  }
  check('hand is on the 12 or the 6 at every ghost touch', worst < 0.002, worst.toFixed(5));
}

/* ------------------------------------- a backgrounded tab loses no schedule */

{
  const smooth = new GhostEngine({ baseline: 60, level: 4, restSeconds: 45 });
  const slept = new GhostEngine({ baseline: 60, level: 4, restSeconds: 45 });
  smooth.start(0);
  slept.start(0);
  for (let t = 0; t < 1500; t += 0.05) smooth.tick(t);
  slept.tick(1500);                                        // one 25-minute jump
  check('a throttled tab catches up to the identical schedule',
    smooth.phase === slept.phase && smooth.activeTier === slept.activeTier
      && smooth.repIndex === slept.repIndex
      && Math.abs(smooth.nextPulse - slept.nextPulse) < 1e-9,
    `${smooth.phase}/${smooth.activeTier}/${smooth.repIndex} vs ${slept.phase}/${slept.activeTier}/${slept.repIndex}`);
}

/* --------------------------------------------- pause resumes where it froze */

{
  const e = new GhostEngine({ baseline: 60, level: 4, restSeconds: 45 });
  e.start(0);
  for (let t = 0; t < 200; t += 0.05) e.tick(t);
  const before = e.lapPhase(200);
  e.togglePause(200);
  e.tick(260);                                             // a minute stood still
  e.togglePause(260);
  check('pause resumes the hand exactly where it froze',
    Math.abs(e.lapPhase(260) - before) < 1e-9, (e.lapPhase(260) - before).toExponential(1));
}

/* ------------------------------------------------------------------ report */

console.log('');
let failed = 0;
for (const [pass, name, got] of results) {
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  [${got}]`);
}
process.exit(failed ? 1 : 0);
