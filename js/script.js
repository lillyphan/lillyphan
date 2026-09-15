(function () {
  "use strict";

  const COLS = 34;
  const ROWS = 20;
  const MINE_RATIO = 0.2;

  const REGIONS = [
    {
      id: "skills",
      title: "Skills",
      col: 0, row: 0, w: 7, h: 7,
      html: `
        <p><strong>Languages</strong><br>C++, Python, Java, SQL, JavaScript, OCaml, Bash, HTML/CSS</p>
        <p><strong>Tools</strong><br>PostgreSQL, MongoDB, GitHub, PyTorch, Snorkel, Tkinter, raylib, LLM Studio, BERTopic</p>
        <p><strong>Concepts</strong><br>Algorithms, Data Structures, Machine Learning, NLP, OOP, Agile/Scrum</p>
      `,
    },
    {
      id: "education",
      title: "Education",
      col: 12, row: 0, w: 6, h: 5,
      html: `
        <p><strong>Colorado School of Mines</strong><br>B.S. Computer Science — Expected May 2028</p>
        <p>Golden, CO</p>
        <p>GPA: 4.00/4.00 · Dean's List, Fall 2024 – Spring 2026</p>
      `,
    },
    {
      id: "activities",
      title: "Activities & Awards",
      col: 6, row: 1, w: 7, h: 6,
      html: `
        <p><strong><a href="https://boettcherfoundation.org/boettcher-foundation-honors-outstanding-colorado-students/" target="_blank" rel="noopener">Boettcher Scholarship</a></strong> (May 2024)<br>1 of 50 selected nationwide for a four-year full-ride merit scholarship out of 1,900+ applicants.</p>
        <p><strong>Society of Women Engineers</strong><br>Peer Mentor / General Member, Aug 2024 – Present.</p>
      `,
    },
    {
      id: "experience",
      title: "Experience",
      col: 0, row: 6, w: 12, h: 8,
      html: `
        <p><strong>CSCI406 Algorithms — TA</strong>, Mines · Aug 2026–Present<br>
        Weekly office hours, oral grading interviews, and homework grading with feedback.</p>
        <p><strong>#HappyPlace Lab — SURF Fellow</strong> · May 2026–Present<br>
        NLP pipeline (Snorkel weak supervision + fine-tuned transformers) to detect spiritual-care narratives in Reddit communities; structured literature reviews for co-authored publications.</p>
        <p><strong>PHGN200 E&amp;M Physics — TA</strong> · Aug 2025–Present<br>
        Weekly help hours and studio support for lab setup and problem-solving.</p>
        <p><strong>The Challenge Foundation — Math Teacher</strong> · Summer 2026<br>
        Built a 5-week math curriculum from scratch for incoming 6th/7th graders.</p>
      `,
    },
    {
      id: "projects",
      title: "Projects",
      col: 9, row: 6, w: 13, h: 8,
      html: `
        <p><strong>Minesweeper AI &amp; Analytics Platform</strong> — Python/Tkinter, PostgreSQL<br>
        Minesweeper with a live neural-net confidence overlay, autoplay bot, and model selector; PostgreSQL backend using CTEs, window functions, and WIDTH_BUCKET for a live model leaderboard. (Yes — the board you're playing right now is a spiritual sequel.)</p>
        <p><strong>De-Bug</strong> — 1st Place, BlasterHacks (60+ participants) · C++, raylib<br>
        3D platformer/puzzle game built from scratch, custom physics + game engine; tech lead for architecture (event bus, puzzle engine, data-driven level loader).</p>
        <p><strong>Clue</strong> — Java<br>
        Full-stack Clue implementation with custom maps, AI opponents that reason over game state, and a from-scratch Swing UI.</p>
      `,
    },
  ];

  const TOTAL_SECTIONS = REGIONS.length;

  let cellData = [];
  let regionRevealed = {};
  let firstClickDone = false;
  let mineTotal = 0;
  let gameLocked = false;

  const boardEl = document.getElementById("board");
  const mineCounterEl = document.querySelector("#mine-counter span");
  const progressCounterEl = document.querySelector("#progress-counter span");
  const resetBtn = document.getElementById("reset-btn");
  const revealBtn = document.getElementById("reveal-btn");
  const toastEl = document.getElementById("toast");
  const viewToggle = document.getElementById("view-toggle");
  const gameView = document.getElementById("game-view");
  const resumeView = document.getElementById("resume-view");

  function inBounds(c, r) {
    return c >= 0 && c < COLS && r >= 0 && r < ROWS;
  }

  function regionAt(c, r) {
    for (const reg of REGIONS) {
      if (c >= reg.col && c < reg.col + reg.w && r >= reg.row && r < reg.row + reg.h) {
        return reg;
      }
    }
    return null;
  }

  function buildEmptyGrid() {
    const grid = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) {
        const reg = regionAt(c, r);
        row.push({
          col: c,
          row: r,
          isMine: false,
          isRegion: !!reg,
          regionId: reg ? reg.id : null,
          adjacent: 0,
          revealed: reg ? !!regionRevealed[reg.id] : false,
          flagged: false,
        });
      }
      grid.push(row);
    }
    return grid;
  }

  function countOpening(startCol, startRow) {
    const queue = [[startCol, startRow]];
    const seen = new Set();
    let count = 0;
    while (queue.length) {
      const [c, r] = queue.shift();
      const key = c + "," + r;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!inBounds(c, r)) continue;
      const cell = cellData[r][c];
      if (cell.isMine) continue;
      count++;
      if (cell.isRegion) continue;
      if (cell.adjacent === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            queue.push([c + dc, r + dr]);
          }
        }
      }
    }
    return count;
  }

  function placeMines(excludeCol, excludeRow, skipOpeningGuarantee) {
    const freeCells = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = cellData[r][c];
        if (cell.isRegion) continue;
        if (Math.abs(c - excludeCol) <= 1 && Math.abs(r - excludeRow) <= 1) continue;
        freeCells.push(cell);
      }
    }
    mineTotal = Math.max(6, Math.round(freeCells.length * MINE_RATIO));

    if (skipOpeningGuarantee) {
      shuffle(freeCells);
      for (let i = 0; i < mineTotal && i < freeCells.length; i++) {
        freeCells[i].isMine = true;
      }
      computeAdjacency();
      updateMineCounter();
      return;
    }

    const targetOpening = Math.min(24, Math.max(10, Math.round(freeCells.length * 0.12)));
    const maxAttempts = 40;
    let bestSize = -1;
    let bestMines = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      freeCells.forEach((c) => (c.isMine = false));
      shuffle(freeCells);
      for (let i = 0; i < mineTotal && i < freeCells.length; i++) {
        freeCells[i].isMine = true;
      }
      computeAdjacency();
      const openingSize = countOpening(excludeCol, excludeRow);
      if (openingSize >= targetOpening) {
        bestMines = null;
        break;
      }
      if (openingSize > bestSize) {
        bestSize = openingSize;
        bestMines = freeCells.map((c) => c.isMine);
      }
    }

    if (bestMines) {
      freeCells.forEach((c, i) => (c.isMine = bestMines[i]));
      computeAdjacency();
    }

    updateMineCounter();
  }

  function computeAdjacency() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = cellData[r][c];
        if (cell.isRegion || cell.isMine) continue;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nc = c + dc, nr = r + dr;
            if (inBounds(nc, nr) && cellData[nr][nc].isMine) count++;
          }
        }
        cell.adjacent = count;
      }
    }
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function rectsOverlap(a, b) {
    return !(a.col + a.w <= b.col || b.col + b.w <= a.col || a.row + a.h <= b.row || b.row + b.h <= a.row);
  }

  function randomPlacement(reg, placed) {
    const maxCol = COLS - reg.w;
    const maxRow = ROWS - reg.h;
    if (maxCol < 0 || maxRow < 0) return null;
    for (let i = 0; i < 400; i++) {
      const col = Math.floor(Math.random() * (maxCol + 1));
      const row = Math.floor(Math.random() * (maxRow + 1));
      const candidate = { col, row, w: reg.w, h: reg.h };
      if (!placed.some((p) => rectsOverlap(candidate, p))) return { col, row };
    }
    return null;
  }

  function firstFitPlacement(reg, placed) {
    const maxCol = COLS - reg.w;
    const maxRow = ROWS - reg.h;
    for (let row = 0; row <= maxRow; row++) {
      for (let col = 0; col <= maxCol; col++) {
        const candidate = { col, row, w: reg.w, h: reg.h };
        if (!placed.some((p) => rectsOverlap(candidate, p))) return { col, row };
      }
    }
    return { col: 0, row: 0 };
  }

  function attemptLayout() {
    const byArea = {};
    REGIONS.forEach((reg) => {
      const key = reg.w * reg.h;
      (byArea[key] = byArea[key] || []).push(reg);
    });
    const order = [];
    Object.keys(byArea)
      .map(Number)
      .sort((a, b) => b - a)
      .forEach((key) => order.push(...shuffle(byArea[key])));

    const placed = [];
    for (const reg of order) {
      const pos = randomPlacement(reg, placed) || firstFitPlacement(reg, placed);
      if (!pos || placed.some((p) => rectsOverlap({ ...pos, w: reg.w, h: reg.h }, p))) {
        return null;
      }
      placed.push({ ...reg, col: pos.col, row: pos.row });
    }
    return placed;
  }

  function layoutRegions() {
    const maxAttempts = 30;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const placed = attemptLayout();
      if (placed) {
        placed.forEach((p) => {
          const reg = REGIONS.find((r) => r.id === p.id);
          reg.col = p.col;
          reg.row = p.row;
        });
        return;
      }
    }
    const order = [...REGIONS].sort((a, b) => b.w * b.h - a.w * a.h);
    const placed = [];
    order.forEach((reg) => {
      const pos = firstFitPlacement(reg, placed);
      reg.col = pos.col;
      reg.row = pos.row;
      placed.push(reg);
    });
  }

  function renderBoard() {
    boardEl.innerHTML = "";
    boardEl.style.setProperty("--cols", COLS);
    boardEl.style.setProperty("--rows", ROWS);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = cellData[r][c];
        const div = document.createElement("div");
        div.className = "cell";
        div.dataset.col = c;
        div.dataset.row = r;
        div.style.gridColumn = String(c + 1);
        div.style.gridRow = String(r + 1);
        if (cell.isRegion) {
          div.classList.add("region-cell");
          div.dataset.region = cell.regionId;
          if (cell.revealed) div.classList.add("hidden-panel-cell");
        }
        applyCellVisual(div, cell);
        div.addEventListener("click", () => onCellClick(c, r));
        div.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          onCellFlag(c, r);
        });
        div.addEventListener("touchstart", startLongPress(c, r), { passive: true });
        div.addEventListener("touchend", cancelLongPress, { passive: true });
        div.addEventListener("touchmove", cancelLongPress, { passive: true });
        boardEl.appendChild(div);
      }
    }

    REGIONS.forEach((reg) => {
      if (regionRevealed[reg.id]) boardEl.appendChild(buildPanel(reg, false));
    });

    updateProgress();
  }

  let longPressTimer = null;
  function startLongPress(c, r) {
    return () => {
      longPressTimer = setTimeout(() => onCellFlag(c, r), 450);
    };
  }
  function cancelLongPress() {
    if (longPressTimer) clearTimeout(longPressTimer);
  }

  const FLAG_ICON =
    '<svg class="icon-flag" viewBox="0 0 24 24" aria-hidden="true">' +
    '<rect x="6" y="2.5" width="2.2" height="19" rx="1.1" fill="currentColor"/>' +
    '<path d="M8.2 4 L19 7.6 L8.2 11.2 Z" fill="currentColor"/>' +
    "</svg>";
  const BOMB_ICON =
    '<svg class="icon-bomb" viewBox="0 0 24 24" aria-hidden="true">' +
    '<circle cx="12" cy="14" r="7" fill="currentColor"/>' +
    '<rect x="14.5" y="3" width="2.4" height="5.5" rx="1.2" transform="rotate(40 14.5 3)" fill="currentColor"/>' +
    '<circle cx="18.5" cy="5" r="2.1" fill="currentColor"/>' +
    '<path d="M8.5 11 L10.7 8.8" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>' +
    "</svg>";

  function applyCellVisual(div, cell) {
    div.classList.toggle("revealed", cell.revealed);
    div.classList.toggle("flagged", cell.flagged && !cell.revealed);
    div.classList.toggle("mine", cell.revealed && cell.isMine);
    div.textContent = "";
    if (cell.flagged && !cell.revealed) {
      div.innerHTML = FLAG_ICON;
      return;
    }
    if (!cell.revealed) return;
    if (cell.isRegion) return;
    if (cell.isMine) {
      div.innerHTML = BOMB_ICON;
      return;
    }
    if (cell.adjacent > 0) {
      div.textContent = String(cell.adjacent);
      div.classList.add("n" + cell.adjacent);
    }
  }

  const PANEL_BASE_FONT_PX = 15;
  const PANEL_MIN_FONT_PX = 11;

  function buildPanel(reg, animate) {
    const panel = document.createElement("div");
    panel.className = "panel";
    panel.dataset.region = reg.id;
    panel.style.gridColumn = `${reg.col + 1} / ${reg.col + reg.w + 1}`;
    panel.style.gridRow = `${reg.row + 1} / ${reg.row + reg.h + 1}`;
    panel.innerHTML = `<h3>${reg.title}</h3><div class="panel-body">${reg.html}</div>`;
    if (animate) {
      panel.classList.add("panel-enter");
      requestAnimationFrame(() => panel.classList.add("panel-enter-active"));
    }
    requestAnimationFrame(() => requestAnimationFrame(() => fitPanelText(panel)));
    window.addEventListener("resize", () => fitPanelText(panel));
    return panel;
  }

  function fitPanelText(panel) {
    const body = panel.querySelector(".panel-body");
    if (!body) return;
    const fits = () => body.scrollHeight <= body.clientHeight + 1 && body.scrollWidth <= body.clientWidth + 1;

    let size = PANEL_BASE_FONT_PX;
    body.style.overflow = "hidden";
    body.style.fontSize = size + "px";

    let guard = 0;
    while (!fits() && size > PANEL_MIN_FONT_PX && guard < 40) {
      size -= 0.5;
      body.style.fontSize = size + "px";
      guard++;
    }
    const stillOverflows = !fits();
    body.style.overflowY = stillOverflows ? "auto" : "hidden";
    body.classList.toggle("is-scrollable", stillOverflows);
  }

  function openRegionPanel(reg) {
    if (boardEl.querySelector(`.panel[data-region="${reg.id}"]`)) return;
    for (let rr = reg.row; rr < reg.row + reg.h; rr++) {
      for (let cc = reg.col; cc < reg.col + reg.w; cc++) {
        cellData[rr][cc].revealed = true;
        const div = boardEl.querySelector(`.cell[data-col="${cc}"][data-row="${rr}"]`);
        if (div) div.classList.add("hidden-panel-cell");
      }
    }
    boardEl.appendChild(buildPanel(reg, true));
  }

  function revealAllSections() {
    if (gameLocked) return;

    if (!firstClickDone) {
      firstClickDone = true;
      placeMines(-1, -1, true);
    }

    const toReveal = REGIONS.filter((reg) => !regionRevealed[reg.id]);
    toReveal.forEach((reg) => {
      for (let rr = reg.row; rr < reg.row + reg.h; rr++) {
        for (let cc = reg.col; cc < reg.col + reg.w; cc++) {
          cellData[rr][cc].revealed = true;
        }
      }
      regionRevealed[reg.id] = true;
    });

    cellData.flat().forEach((cell) => {
      if (!cell.isRegion) cell.revealed = true;
    });

    syncAllCells();
    toReveal.forEach((reg) => boardEl.appendChild(buildPanel(reg, true)));
    updateProgress();
    updateMineCounter();
    gameLocked = true;
    showToast("Board fully revealed — press New board to play again.");
  }

  function onCellClick(c, r) {
    if (gameLocked) return;
    const cell = cellData[r][c];
    if (cell.flagged || cell.revealed) return;

    if (!firstClickDone) {
      firstClickDone = true;
      placeMines(c, r);
    }

    if (cell.isMine) {
      explodeMine(cell);
      return;
    }

    const order = revealCascade(c, r);
    animateRevealOrder(order);
  }

  function onCellFlag(c, r) {
    if (gameLocked) return;
    const cell = cellData[r][c];
    if (cell.revealed || cell.isRegion) return;
    cell.flagged = !cell.flagged;
    syncAllCells();
    updateMineCounter();
  }

  function revealCascade(startCol, startRow) {
    const queue = [[startCol, startRow]];
    const seen = new Set();
    const order = [];

    while (queue.length) {
      const [c, r] = queue.shift();
      const key = c + "," + r;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!inBounds(c, r)) continue;
      const cell = cellData[r][c];
      if (cell.isMine || cell.flagged) continue;
      if (cell.revealed) continue;

      cell.revealed = true;
      order.push(cell);

      if (cell.isRegion) {
        const reg = REGIONS.find((x) => x.id === cell.regionId);
        for (let rr = reg.row; rr < reg.row + reg.h; rr++) {
          for (let cc = reg.col; cc < reg.col + reg.w; cc++) {
            const rc = cellData[rr][cc];
            if (!rc.revealed) {
              rc.revealed = true;
              order.push(rc);
            }
          }
        }
        continue;
      }

      if (cell.adjacent === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            queue.push([c + dc, r + dr]);
          }
        }
      }
    }

    return order;
  }

  function animateRevealOrder(order) {
    if (!order.length) return;

    const stagger = Math.max(10, Math.min(26, Math.round(550 / order.length)));
    const lastStepForRegion = {};
    order.forEach((cell, i) => {
      if (cell.isRegion) lastStepForRegion[cell.regionId] = i;
    });

    order.forEach((cell, i) => {
      setTimeout(() => {
        const div = boardEl.querySelector(
          `.cell[data-col="${cell.col}"][data-row="${cell.row}"]`
        );
        if (!div) return;
        applyCellVisual(div, cell);
        div.classList.remove("pop");
        void div.offsetWidth;
        div.classList.add("pop");
      }, i * stagger);
    });

    Object.keys(lastStepForRegion).forEach((id) => {
      const step = lastStepForRegion[id];
      setTimeout(() => {
        const reg = REGIONS.find((x) => x.id === id);
        if (!reg) return;
        regionRevealed[id] = true;
        openRegionPanel(reg);
        updateProgress();
      }, step * stagger + 220);
    });
  }

  function syncAllCells() {
    boardEl.querySelectorAll(".cell").forEach((div) => {
      const c = Number(div.dataset.col);
      const r = Number(div.dataset.row);
      const cell = cellData[r][c];
      applyCellVisual(div, cell);
      if (cell.isRegion && cell.revealed) div.classList.add("hidden-panel-cell");
    });
  }

  function explodeMine(triggerCell) {
    gameLocked = true;

    const mines = cellData.flat().filter((c) => c.isMine);
    const others = mines.filter((c) => c !== triggerCell);
    others.sort((a, b) => {
      const da = Math.hypot(a.col - triggerCell.col, a.row - triggerCell.row);
      const db = Math.hypot(b.col - triggerCell.col, b.row - triggerCell.row);
      return da - db;
    });
    const chain = [triggerCell, ...others];

    const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stagger = Math.max(12, Math.min(45, Math.round(900 / chain.length)));

    if (!prefersReducedMotion) {
      boardEl.classList.add("board-shake");
    }

    chain.forEach((cell, i) => {
      setTimeout(() => {
        cell.revealed = true;
        const div = boardEl.querySelector(`.cell[data-col="${cell.col}"][data-row="${cell.row}"]`);
        if (!div) return;
        div.classList.add("revealed", "mine");
        div.innerHTML = BOMB_ICON;
        div.classList.remove("boom");
        void div.offsetWidth;
        div.classList.add("boom");
      }, i * stagger);
    });

    showToast("BOOM — the whole board goes up. Resetting…");

    const totalDuration = chain.length * stagger + 700;
    setTimeout(() => {
      boardEl.classList.remove("board-shake");
      newBoard();
    }, totalDuration);
  }

  function newBoard() {
    const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fadeMs = prefersReducedMotion ? 0 : 260;

    boardEl.classList.add("board-fade-out");
    setTimeout(() => {
      gameLocked = false;
      firstClickDone = false;
      regionRevealed = {};
      layoutRegions();
      cellData = buildEmptyGrid();
      renderBoard();
      showToast("");
      requestAnimationFrame(() => boardEl.classList.remove("board-fade-out"));
    }, fadeMs);
  }

  function updateMineCounter() {
    if (!firstClickDone) {
      mineCounterEl.textContent = "?";
      return;
    }
    const flagged = cellData.flat().filter((c) => c.flagged).length;
    mineCounterEl.textContent = Math.max(0, mineTotal - flagged);
  }

  function updateProgress() {
    const found = Object.values(regionRevealed).filter(Boolean).length;
    progressCounterEl.textContent = found;
    if (found === TOTAL_SECTIONS) {
      showToast("You swept the whole board — thanks for exploring my portfolio! Feel free to reach out using the links up top.");
    }
  }

  function showToast(msg) {
    toastEl.textContent = msg;
  }

  function initResumeReveal() {
    const targets = document.querySelectorAll("#resume-view .reveal-on-scroll");
    if (!targets.length) return;
    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("in-view"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    targets.forEach((el) => observer.observe(el));
  }
  initResumeReveal();

  viewToggle.addEventListener("click", () => {
    const showingResume = resumeView.classList.toggle("hidden") === false;
    gameView.classList.toggle("hidden", showingResume);
    viewToggle.textContent = showingResume
      ? "Back to the Minesweeper board"
      : "Just show me the plain resume";
  });

  resetBtn.addEventListener("click", newBoard);
  revealBtn.addEventListener("click", revealAllSections);

  layoutRegions();
  cellData = buildEmptyGrid();
  renderBoard();
  updateMineCounter();
})();