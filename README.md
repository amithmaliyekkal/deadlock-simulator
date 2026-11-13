# Deadlock Detective — Interactive Deadlock Detection & Recovery Simulator

> **Course:** Operating Systems · **Unit:** II (Deadlocks)  
> **Purpose:** CA3 classroom demonstration — no slides needed.

---

## 📖 Unit II Connection

This project demonstrates concepts from **Unit II: Deadlocks** in a typical Operating Systems curriculum:

| Topic | Where It Appears in the Simulator |
|---|---|
| System model (processes, resource types, instances) | The editable Allocation, Request, and Available matrices |
| Deadlock conditions (mutual exclusion, hold & wait, no preemption, circular wait) | "How It Works" section in the UI |
| Deadlock detection algorithm (Banker's-style) | Step-by-step trace panel; engine code in `js/deadlock-engine.js` |
| Resource-Allocation Graph | Canvas-drawn graph with arrows for allocation and request edges |
| Recovery by process termination | "Terminate & Reclaim" button with resource reclamation |
| Safe vs. unsafe states | Preset scenarios + result highlighting |

---

## 🚀 How to Run

### Option A — Double-click (simplest)

Open `index.html` in any modern browser (Chrome, Edge, Firefox).  
All code is client-side; no server or build step is required.

### Option B — Local HTTP server (if file:// causes issues)

```bash
# Python 3
cd "Deadlock simulator"
python -m http.server 8000
# Then open http://localhost:8000

# Or Node.js
npx serve .
```

---

## 📂 File Structure

```
Deadlock simulator/
├── index.html              ← Main page — open this
├── css/
│   └── style.css           ← Styling (responsive, accessible)
├── js/
│   ├── deadlock-engine.js  ← Detection algorithm (pure logic, no DOM)
│   └── ui.js               ← UI controller (DOM, canvas graph)
├── README.md               ← This file
└── .gitignore
```

---

## 🔬 Algorithm Overview

The simulator implements the **standard deadlock detection algorithm** for systems with multiple resource instances:

1. **Initialize:** `Work = Available`. Mark each process as *Finished* if it holds no resources, else *Unfinished*.
2. **Search:** Find an unfinished process *P_i* whose `Request[i] ≤ Work` (element-wise).
3. **Simulate completion:** Set `Work = Work + Allocation[i]`, mark *P_i* finished.
4. **Repeat** step 2 until no more processes can finish.
5. **Result:** Any process still unfinished is **deadlocked**.

> **Graph vs. algorithm:** A cycle in the resource-allocation graph proves deadlock only when every resource type has exactly one instance. With multiple instances, the matrix algorithm is authoritative. The UI explains this distinction.

---

## 🎓 Live Demo Sequence

Follow these steps during your classroom demonstration:

### Demo 1 — Safe State

1. The page loads with the **"Safe State (No Deadlock)"** preset.
2. Click **▶ Run Detection**.
3. Point out:
   - The green-highlighted rows — all processes can finish.
   - The step-by-step trace showing Work and Finish at each iteration.
   - The safe sequence displayed in the result box.
   - The graph: arrows exist but no "stuck" cycle.
4. Walk through 2–3 steps aloud: *"P0's Request [0,0,0] ≤ Work [0,0,0], so it finishes and releases its Allocation …"*

### Demo 2 — Deadlock

5. Select **"Deadlocked State (5-Process)"** from the Preset dropdown.
6. Click **▶ Run Detection**.
7. Point out:
   - Red-highlighted rows for P1, P2, P3, P4 — they are deadlocked.
   - The trace shows these processes' requests exceed Work.
   - Red arrows in the graph mark deadlocked request edges.
8. Expand **"How It Works"** and briefly explain the four conditions.

### Demo 3 — Recovery

9. In the "Recover by terminating" dropdown, select **P2** (or any deadlocked process).
10. Click **Terminate & Reclaim**.
11. Observe: P2's allocation returns to Available; its row zeros out.
12. Click **▶ Run Detection** again.
13. Show that the system is now in a safe state — the deadlock is resolved.
14. Discuss: *"In a real OS, the scheduler would choose a victim based on priority or cost."*

### Demo 4 — Simple Deadlock (optional)

15. Load the **"Simple 2-Process Deadlock"** preset — the classic textbook example.
16. Run detection; show the mutual circular wait.

### Demo 5 — Custom Values (optional)

17. Set Processes = 3, Resources = 2, click **Apply Size**.
18. Enter custom values and run detection.
19. Show that students can experiment on their own.

---

## ✅ Quality Notes

- **Separation of concerns:** Algorithm logic is in `deadlock-engine.js` with no DOM dependency. UI logic is in `ui.js`.
- **No hard-coded results:** All outcomes are computed from entered data.
- **Input validation:** Non-negative integers enforced; helpful error messages shown.
- **Accessible:** Labels on all inputs, readable color contrast, keyboard-navigable.
- **Responsive:** Works on laptop screens and projectors (tested at 1024px+).
- **No external dependencies:** Zero network requests, zero npm packages, zero build steps.

---

## 📝 License

Educational project — feel free to use and modify for coursework.

