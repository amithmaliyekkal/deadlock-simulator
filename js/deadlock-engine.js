/**
 * ============================================================
 * Deadlock Detection Engine  (v2 — Enhanced)
 * ============================================================
 *
 * Pure algorithmic logic — zero DOM dependencies.
 *
 * Algorithm (standard deadlock detection for multi-instance resources):
 * ------------------------------------------------------------------
 *   1.  Work  ← copy of Available
 *   2.  Finish[i] ← true if Allocation[i] == 0, else false
 *   3.  Find i where Finish[i]==false AND Request[i] ≤ Work
 *       → if none found, go to 5
 *   4.  Work ← Work + Allocation[i];  Finish[i] ← true;  go to 3
 *   5.  Any i with Finish[i]==false is DEADLOCKED
 * ============================================================
 */

"use strict";

const DeadlockEngine = (() => {

  /* ---- vector helpers ---- */
  const vecLEQ  = (a, b) => a.every((v, j) => v <= b[j]);
  const vecAdd  = (a, b) => a.map((v, j) => v + b[j]);
  const vecZero = v => v.every(x => x === 0);
  const vecCopy = v => v.slice();

  /**
   * Run deadlock detection.
   * @returns {{ deadlocked, safeSequence, steps[], isDeadlocked }}
   */
  function detect(state) {
    const { processes, resources, allocation, request, available } = state;
    const n = processes.length;

    // Step 1
    let work = vecCopy(available);

    // Step 2
    const finish = allocation.map(row => vecZero(row));

    const steps = [];
    const safeSequence = [];

    // Initial snapshot
    steps.push({
      type: "init", process: null,
      work: vecCopy(work), finish: finish.slice(),
      message: `Set Work = Available = [${work.join(", ")}].  Finish = [${finish.map(f => f ? "T" : "F").join(", ")}].`
    });

    // Mark trivially-finished processes (hold nothing)
    for (let i = 0; i < n; i++) {
      if (finish[i]) {
        safeSequence.push(i);
        steps.push({
          type: "trivial", process: i,
          work: vecCopy(work), finish: finish.slice(),
          message: `${processes[i]} holds no resources → already finished.`
        });
      }
    }

    // Steps 3–4 — iteratively find finishable processes
    let changed = true;
    let pass = 0;
    while (changed) {
      changed = false;
      pass++;
      for (let i = 0; i < n; i++) {
        if (finish[i]) continue;

        if (vecLEQ(request[i], work)) {
          const oldWork = vecCopy(work);
          work = vecAdd(work, allocation[i]);
          finish[i] = true;
          safeSequence.push(i);
          changed = true;

          steps.push({
            type: "finish", process: i,
            work: vecCopy(work), finish: finish.slice(),
            message: `${processes[i]}: Request [${request[i].join(", ")}] ≤ Work [${oldWork.join(", ")}]  ✓  ` +
                     `Reclaim Alloc [${allocation[i].join(", ")}] → Work = [${work.join(", ")}]`
          });
        } else {
          steps.push({
            type: "skip", process: i,
            work: vecCopy(work), finish: finish.slice(),
            message: `${processes[i]}: Request [${request[i].join(", ")}] > Work [${work.join(", ")}]  ✗  Cannot finish.`
          });
        }
      }
    }

    // Step 5 — report
    const deadlocked = [];
    for (let i = 0; i < n; i++) if (!finish[i]) deadlocked.push(i);

    const resultMsg = deadlocked.length > 0
      ? `⚠️ DEADLOCK — Processes ${deadlocked.map(i => processes[i]).join(", ")} cannot finish.`
      : `✅ SAFE — All processes can finish.  Sequence: ${safeSequence.map(i => processes[i]).join(" → ")}`;

    steps.push({
      type: "result", process: null,
      work: vecCopy(work), finish: finish.slice(),
      message: resultMsg
    });

    return { deadlocked, safeSequence, steps, isDeadlocked: deadlocked.length > 0 };
  }

  /**
   * Terminate a process and reclaim its resources.
   * Mutates state in-place.
   */
  function recoverByTermination(state, pid) {
    const m = state.resources.length;
    for (let j = 0; j < m; j++) {
      state.available[j] += state.allocation[pid][j];
      state.allocation[pid][j] = 0;
      state.request[pid][j] = 0;
    }
    return state;
  }

  /** Validate inputs. Returns string[] of errors (empty = valid). */
  function validate(state) {
    const errors = [];
    const { processes, resources, allocation, request, available } = state;
    const n = processes.length, m = resources.length;

    if (n === 0) errors.push("Need at least one process.");
    if (m === 0) errors.push("Need at least one resource type.");
    if (available.length !== m) errors.push("Available vector length mismatch.");

    const check = (label, arr) => {
      if (arr.length !== n) { errors.push(`${label} row count ≠ process count.`); return; }
      arr.forEach((row, i) => {
        if (row.length !== m) errors.push(`${label} row ${i}: expected ${m} cols, got ${row.length}.`);
        row.forEach((v, j) => {
          if (!Number.isInteger(v) || v < 0)
            errors.push(`${label}[${processes[i]}][${resources[j]}] = "${v}" — must be a non-negative integer.`);
        });
      });
    };
    check("Allocation", allocation);
    check("Request", request);
    available.forEach((v, j) => {
      if (!Number.isInteger(v) || v < 0)
        errors.push(`Available[${resources[j]}] = "${v}" — must be a non-negative integer.`);
    });

    return errors;
  }

  /* ---- Presets ---- */
  const PRESETS = {
    safe: {
      name: "Safe State — No Deadlock",
      desc: "5 processes, 3 resource types. Everyone can eventually finish.",
      processes: ["P0", "P1", "P2", "P3", "P4"],
      resources: ["A", "B", "C"],
      allocation: [[0,1,0],[2,0,0],[3,0,3],[2,1,1],[0,0,2]],
      request:    [[0,0,0],[2,0,2],[0,0,0],[1,0,0],[0,0,2]],
      available:  [0,0,0]
    },
    deadlocked: {
      name: "Deadlocked State",
      desc: "5 processes, 3 resource types. P1–P4 are stuck in deadlock.",
      processes: ["P0", "P1", "P2", "P3", "P4"],
      resources: ["A", "B", "C"],
      allocation: [[0,1,0],[2,0,0],[3,0,3],[2,1,1],[0,0,2]],
      request:    [[0,0,0],[2,0,2],[0,0,1],[1,0,0],[0,0,2]],
      available:  [0,0,0]
    },
    simple: {
      name: "Classic 2-Process Deadlock",
      desc: "P0 holds A, wants B.  P1 holds B, wants A.  Textbook circular wait.",
      processes: ["P0", "P1"],
      resources: ["A", "B"],
      allocation: [[1,0],[0,1]],
      request:    [[0,1],[1,0]],
      available:  [0,0]
    },
    dining: {
      name: "Dining Philosophers (3)",
      desc: "3 philosophers, 3 forks. Each holds one fork and needs the next — deadlock!",
      processes: ["Phil-0", "Phil-1", "Phil-2"],
      resources: ["Fork-A", "Fork-B", "Fork-C"],
      allocation: [[1,0,0],[0,1,0],[0,0,1]],
      request:    [[0,1,0],[0,0,1],[1,0,0]],
      available:  [0,0,0]
    }
  };

  return { detect, recoverByTermination, validate, PRESETS };
})();
