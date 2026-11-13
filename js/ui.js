/**
 * ============================================================
 * Deadlock Detective — UI Controller (v3)
 * ============================================================
 */

"use strict";

const App = (() => {
  let state = null;
  let result = null;
  let animTimer = null;
  let animSpeed = 600;

  const $ = id => document.getElementById(id);

  function init() {
    wireEvents();
    loadPreset("safe");
  }

  function wireEvents() {
    $("preset-select").addEventListener("change", e => { if (e.target.value) loadPreset(e.target.value); });
    $("btn-detect").addEventListener("click", runDetection);
    $("btn-step").addEventListener("click", runStepByStep);
    $("btn-reset").addEventListener("click", () => loadPreset($("preset-select").value || "safe"));
    $("btn-recover").addEventListener("click", runRecovery);
    $("btn-apply-size").addEventListener("click", applyCustomSize);
    $("speed-slider").addEventListener("input", e => { animSpeed = 1200 - parseInt(e.target.value, 10); });
    $("how-toggle").addEventListener("click", () => {
      const panel = $("how-content");
      const arrow = $("how-toggle").querySelector(".collapse-arrow");
      panel.classList.toggle("collapsed");
      arrow.textContent = panel.classList.contains("collapsed") ? "▶" : "▼";
    });
  }

  /* ==== Presets ==== */
  function loadPreset(key) {
    stopAnim();
    const p = DeadlockEngine.PRESETS[key];
    if (!p) return;
    state = clone(p);
    result = null;
    $("preset-select").value = key;
    $("process-count").value = state.processes.length;
    $("resource-count").value = state.resources.length;
    renderMatrices();
    clearResults();
    toast("info", `📂 Loaded: <strong>${p.name}</strong>`);
  }

  function clone(p) {
    return {
      processes: p.processes.slice(),
      resources: p.resources.slice(),
      allocation: p.allocation.map(r => r.slice()),
      request: p.request.map(r => r.slice()),
      available: p.available.slice()
    };
  }

  /* ==== Custom size ==== */
  function applyCustomSize() {
    const n = parseInt($("process-count").value, 10);
    const m = parseInt($("resource-count").value, 10);
    if (!n || n < 1 || n > 20 || !m || m < 1 || m > 10) {
      toast("error", "Processes must be 1–20 and resource types 1–10.");
      return;
    }
    state = {
      processes: Array.from({ length: n }, (_, i) => `P${i}`),
      resources: Array.from({ length: m }, (_, j) => String.fromCharCode(65 + j % 26)),
      allocation: Array.from({ length: n }, () => new Array(m).fill(0)),
      request:    Array.from({ length: n }, () => new Array(m).fill(0)),
      available:  new Array(m).fill(0)
    };
    result = null;
    $("preset-select").value = "";
    renderMatrices();
    clearResults();
    toast("info", `✏️ Custom: <strong>${n} processes × ${m} resource types</strong>. Fill in values.`);
  }

  /* ==== Matrices ==== */
  function renderMatrices() {
    const { processes: P, resources: R, allocation: A, request: Q, available: V } = state;
    const area = $("matrices-area");
    area.innerHTML = "";
    area.appendChild(matrixBlock("Allocation", "alloc", "dot-alloc", P, R, A));
    area.appendChild(matrixBlock("Request", "req", "dot-req", P, R, Q));

    const av = $("available-area");
    av.innerHTML = "";
    const wrap = mk("div", "matrix-wrapper");
    const h = mk("h3");
    h.innerHTML = '<span class="dot dot-alloc"></span> Available';
    wrap.appendChild(h);
    const tbl = mk("table", "matrix-table");
    const hr = mk("tr");
    hr.appendChild(mkTh(""));
    R.forEach(r => hr.appendChild(mkTh(r)));
    tbl.appendChild(hr);
    const dr = mk("tr");
    dr.appendChild(mk("td"));
    R.forEach((r, j) => {
      const td = mk("td");
      td.appendChild(numInp("avail", null, j, V[j], `Available ${r}`));
      dr.appendChild(td);
    });
    tbl.appendChild(dr);
    wrap.appendChild(tbl);
    av.appendChild(wrap);
  }

  function matrixBlock(title, prefix, dotCls, P, R, data) {
    const wrap = mk("div", "matrix-wrapper");
    const h = mk("h3");
    h.innerHTML = `<span class="dot ${dotCls}"></span> ${title}`;
    wrap.appendChild(h);
    const tbl = mk("table", "matrix-table");
    const hr = mk("tr");
    hr.appendChild(mkTh("Process"));
    R.forEach(r => hr.appendChild(mkTh(r)));
    tbl.appendChild(hr);
    P.forEach((pn, i) => {
      const tr = mk("tr");
      tr.dataset.pid = i;
      const lbl = mk("td", "process-label");
      lbl.textContent = pn;
      tr.appendChild(lbl);
      R.forEach((rn, j) => {
        const td = mk("td");
        td.appendChild(numInp(prefix, i, j, data[i][j], `${title} ${pn} ${rn}`));
        tr.appendChild(td);
      });
      tbl.appendChild(tr);
    });
    wrap.appendChild(tbl);
    return wrap;
  }

  function mk(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function mkTh(t) { const e = document.createElement("th"); e.textContent = t; return e; }
  function numInp(type, i, j, val, label) {
    const inp = document.createElement("input");
    inp.type = "number"; inp.min = "0"; inp.value = val;
    inp.dataset.type = type;
    if (i !== null) inp.dataset.i = i;
    inp.dataset.j = j;
    inp.setAttribute("aria-label", label);
    return inp;
  }

  /* ==== Read DOM ==== */
  function readInputs() {
    const n = state.processes.length, m = state.resources.length;
    const A = Array.from({ length: n }, () => new Array(m).fill(0));
    const Q = Array.from({ length: n }, () => new Array(m).fill(0));
    const V = new Array(m).fill(0);
    document.querySelectorAll("input[data-type='alloc']").forEach(inp => { A[+inp.dataset.i][+inp.dataset.j] = parseInt(inp.value, 10); });
    document.querySelectorAll("input[data-type='req']").forEach(inp => { Q[+inp.dataset.i][+inp.dataset.j] = parseInt(inp.value, 10); });
    document.querySelectorAll("input[data-type='avail']").forEach(inp => { V[+inp.dataset.j] = parseInt(inp.value, 10); });
    state.allocation = A; state.request = Q; state.available = V;
  }

  /* ==== Detection ==== */
  function runDetection() {
    stopAnim();
    readInputs();
    const errs = DeadlockEngine.validate(state);
    if (errs.length) { toast("error", errs.join(" ")); return; }
    result = DeadlockEngine.detect(state);
    showAllSteps();
    showResult();
    drawGraph();
    paintRows();
    resultToast();
  }

  /* ==== Animated step-through ==== */
  function runStepByStep() {
    stopAnim();
    readInputs();
    const errs = DeadlockEngine.validate(state);
    if (errs.length) { toast("error", errs.join(" ")); return; }
    result = DeadlockEngine.detect(state);
    $("result-area").innerHTML = "";
    const area = $("steps-area");
    area.innerHTML = "";
    const ol = mk("ol", "step-list");
    area.appendChild(ol);
    let idx = 0;
    toast("info", "⏳ Running detection step by step…");
    animTimer = setInterval(() => {
      if (idx >= result.steps.length) {
        stopAnim();
        showResult();
        drawGraph();
        paintRows();
        resultToast();
        return;
      }
      ol.appendChild(stepLi(result.steps[idx]));
      ol.lastChild.scrollIntoView({ behavior: "smooth", block: "nearest" });
      idx++;
    }, animSpeed);
  }

  function stopAnim() { if (animTimer) { clearInterval(animTimer); animTimer = null; } }

  /* ==== Renderers ==== */
  function showAllSteps() {
    const area = $("steps-area");
    area.innerHTML = "";
    const ol = mk("ol", "step-list");
    result.steps.forEach(s => ol.appendChild(stepLi(s)));
    area.appendChild(ol);
  }

  function stepLi(step) {
    const li = mk("li", `step-item step-${step.type}`);
    const msg = mk("span", "step-msg");
    msg.textContent = step.message;
    li.appendChild(msg);
    const det = mk("div", "step-detail");
    det.innerHTML = `<span class="mono">Work=[${step.work.join(",")}]</span> <span class="mono">Finish=[${step.finish.map(f => f ? "T" : "F").join(",")}]</span>`;
    li.appendChild(det);
    return li;
  }

  function showResult() {
    const last = result.steps[result.steps.length - 1];
    const cls = result.isDeadlocked ? "result-deadlock" : "result-safe";
    $("result-area").innerHTML = `<div class="result-box ${cls}">${last.message}</div>`;
    if (result.isDeadlocked) showRecover(); else hideRecover();
  }

  function paintRows() {
    document.querySelectorAll("tr[data-pid]").forEach(tr => tr.classList.remove("row-safe", "row-deadlocked"));
    if (!result) return;
    result.safeSequence.forEach(i => document.querySelectorAll(`tr[data-pid="${i}"]`).forEach(tr => tr.classList.add("row-safe")));
    result.deadlocked.forEach(i => document.querySelectorAll(`tr[data-pid="${i}"]`).forEach(tr => tr.classList.add("row-deadlocked")));
  }

  function resultToast() {
    if (result.isDeadlocked)
      toast("error", `🔴 Deadlock detected — <strong>${result.deadlocked.length}</strong> process(es) stuck.`);
    else
      toast("success", `🟢 No deadlock — safe sequence found!`);
  }

  function clearResults() {
    $("result-area").innerHTML = '<div class="empty-state">Run the detection algorithm to see results here.</div>';
    $("steps-area").innerHTML = '<div class="empty-state">Steps will appear here after detection.</div>';
    hideRecover();
    const ctx = $("graph-canvas").getContext("2d");
    ctx.clearRect(0, 0, $("graph-canvas").width, $("graph-canvas").height);
    document.querySelectorAll("tr[data-pid]").forEach(tr => tr.classList.remove("row-safe", "row-deadlocked"));
  }

  function toast(type, html) {
    const bar = $("status-bar");
    bar.innerHTML = html;
    bar.className = `toast toast-${type}`;
  }

  /* ==== Recovery ==== */
  function showRecover() {
    $("recover-section").classList.remove("hidden");
    const sel = $("recover-select");
    sel.innerHTML = "";
    result.deadlocked.forEach(i => {
      const o = document.createElement("option");
      o.value = i; o.textContent = state.processes[i];
      sel.appendChild(o);
    });
  }
  function hideRecover() { $("recover-section").classList.add("hidden"); }

  function runRecovery() {
    const pid = parseInt($("recover-select").value, 10);
    if (isNaN(pid)) return;
    readInputs();
    DeadlockEngine.recoverByTermination(state, pid);
    renderMatrices();
    clearResults();
    toast("info", `♻️ Terminated <strong>${state.processes[pid]}</strong> — resources reclaimed. Run detection again.`);
  }

  /* ============================================================
     Graph Drawing (Canvas)
     ============================================================ */
  function drawGraph() {
    const canvas = $("graph-canvas");
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Light background
    ctx.fillStyle = "#fafbfd";
    ctx.fillRect(0, 0, W, H);

    const { processes: P, resources: R, allocation: A, request: Q } = state;
    const n = P.length, m = R.length;
    const padT = 44, padB = 20;
    const lx = W * 0.28, rx = W * 0.72;
    const uh = H - padT - padB;
    const pg = Math.min(52, uh / Math.max(n, 1));
    const rg = Math.min(52, uh / Math.max(m, 1));
    const po = (uh - (n - 1) * pg) / 2 + padT;
    const ro = (uh - (m - 1) * rg) / 2 + padT;
    const py = i => po + i * pg;
    const ry = j => ro + j * rg;
    const dead = new Set(result ? result.deadlocked : []);
    const CR = 22, SQ = 20;

    // Edges
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        if (A[i][j] > 0) drawArrow(ctx, rx, ry(j), lx + CR, py(i), "#1565d8", A[i][j], false);
        if (Q[i][j] > 0) {
          const d = dead.has(i);
          drawArrow(ctx, lx + CR, py(i), rx - SQ, ry(j), d ? "#dc2626" : "#ca8a04", Q[i][j], d);
        }
      }
    }

    // Process nodes
    for (let i = 0; i < n; i++) {
      const d = dead.has(i);
      ctx.save();
      if (d) { ctx.shadowColor = "rgba(220,38,38,.18)"; ctx.shadowBlur = 10; }
      else if (result) { ctx.shadowColor = "rgba(5,150,105,.12)"; ctx.shadowBlur = 8; }
      ctx.beginPath();
      ctx.arc(lx, py(i), CR, 0, Math.PI * 2);
      ctx.fillStyle = d ? "#fef2f2" : "#e6f9f0";
      ctx.fill();
      ctx.strokeStyle = d ? "#dc2626" : "#059669";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = d ? "#be123c" : "#047857";
      ctx.font = "bold 12px Inter, system-ui";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(P[i], lx, py(i));
    }

    // Resource nodes
    for (let j = 0; j < m; j++) {
      ctx.save();
      ctx.shadowColor = "rgba(80,70,229,.1)"; ctx.shadowBlur = 8;
      ctx.fillStyle = "#e8f1fd";
      ctx.strokeStyle = "#1565d8";
      ctx.lineWidth = 2.5;
      roundRect(ctx, rx - SQ, ry(j) - SQ, SQ * 2, SQ * 2, 8);
      ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "#1565d8";
      ctx.font = "bold 13px Inter, system-ui";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(R[j], rx, ry(j));
    }

    // Headers
    ctx.fillStyle = "#64708a";
    ctx.font = "600 10px Inter, system-ui";
    ctx.textAlign = "center";
    ctx.fillText("PROCESSES", lx, padT - 18);
    ctx.fillText("RESOURCES", rx, padT - 18);
  }

  function drawArrow(ctx, x1, y1, x2, y2, color, w, dashed) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = Math.min(1.5 + w * 0.7, 3.5);
    ctx.globalAlpha = 0.75;
    if (dashed) ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 10 * Math.cos(a - 0.42), y2 - 10 * Math.sin(a - 0.42));
    ctx.lineTo(x2 - 10 * Math.cos(a + 0.42), y2 - 10 * Math.sin(a + 0.42));
    ctx.closePath(); ctx.fill();
    if (w > 1) {
      ctx.font = "bold 10px Inter"; ctx.textAlign = "center";
      ctx.fillText(`×${w}`, (x1 + x2) / 2, (y1 + y2) / 2 - 8);
    }
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", App.init);
