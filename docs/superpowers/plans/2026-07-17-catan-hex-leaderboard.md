# Catan Hex Grid Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all emojis from the application, and add a dynamic hexagonal board layout at the top of the dashboard where each player is represented by a Catan resource hex showing their total wins.

**Architecture:** Modifying `public/index.html` to remove emojis and add the board container, `public/style.css` to add clip-path hex shapes and Catan card resource colors, and `public/app.js` to lay out hexes dynamically in a growing spiral honeycomb.

**Tech Stack:** HTML5, CSS3, Vanilla JS.

---

### Task 1: HTML updates & Emoji Removal

We need to clear emojis from all headers, buttons, cards, and add the layout container for the new board.

**Files:**
- Modify: `public/index.html:1-92`

- [ ] **Step 1: Edit public/index.html to remove emojis and add the hex board container**
  Update the main structure:
  ```html
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Catan Match & Crown Tracker</title>
    <link rel="stylesheet" href="style.css">
  </head>
  <body>
    <header class="tactile-header">
      <h1>CATAN LINEAL CHAMPIONSHIP</h1>
      <p>The Catan Almanac of victors, settlements, and reigning champions</p>
    </header>

    <main class="dashboard-grid">
      <!-- DYNAMIC HEX BOARD SECTION -->
      <section class="catan-card board-box">
        <h2 class="section-title">Catan League Board</h2>
        <div class="board-wrapper">
          <div id="hexBoardContainer" class="hex-board-container">
            <!-- Dynamically populated hexes -->
          </div>
        </div>
      </section>

      <!-- DIVISION CROWNS SECTION -->
      <section class="catan-card board-box">
        <h2 class="section-title">Current Division Crowns</h2>
        <div class="crowns-row" id="crownsContainer">
          <!-- Populated by JS -->
        </div>
      </section>

      <!-- LOG A MATCH SECTION -->
      <section class="catan-card log-box">
        <h2 class="section-title">Log a Match</h2>
        <form id="matchForm">
          <div class="form-group">
            <label for="divisionSelect">Game Division:</label>
            <select id="divisionSelect" required>
              <option value="4" selected>4-Player Division</option>
              <option value="5">5-Player Division</option>
              <option value="6">6-Player Division</option>
            </select>
          </div>

          <div class="form-group">
            <label>Placements (1st is Winner):</label>
            <div id="placementInputsContainer">
              <!-- Dynamically populated placement forms -->
            </div>
          </div>

          <button type="submit" class="retro-btn btn-primary">Lock Match Record</button>
        </form>
      </section>

      <!-- LEADERBOARDS & STATS -->
      <section class="catan-card stats-box">
        <h2 class="section-title">Leaderboard & Player Stats</h2>
        
        <div class="division-tabs">
          <button class="tab-btn active" data-div="global">Global</button>
          <button class="tab-btn" data-div="4">4-Player</button>
          <button class="tab-btn" data-div="5">5-Player</button>
          <button class="tab-btn" data-div="6">6-Player</button>
        </div>

        <div class="table-container">
          <table class="retro-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Wins</th>
                <th>Losses</th>
                <th>Win Rate</th>
                <th>Streak (Max)</th>
                <th>Placements (1st/2nd/3rd...)</th>
              </tr>
            </thead>
            <tbody id="leaderboardBody">
              <!-- Dynamic Leaderboard content -->
            </tbody>
          </table>
        </div>
      </section>

      <!-- ADD NEW PLAYER -->
      <section class="catan-card player-box">
        <h2 class="section-title">Add Player</h2>
        <form id="playerForm">
          <div class="form-group">
            <label for="playerNameInput">Player Name:</label>
            <input type="text" id="playerNameInput" placeholder="Enter name..." required>
          </div>
          <button type="submit" class="retro-btn btn-secondary">Register Player</button>
        </form>
      </section>

      <!-- CROWN LINEAGE TIMELINE -->
      <section class="catan-card lineage-box">
        <h2 class="section-title">Crown Lineage History</h2>
        <div id="lineageTimeline" class="timeline">
          <!-- Dynamic Lineage records -->
        </div>
      </section>
    </main>

    <footer class="tactile-footer">
      <p>Hexes, clay, and wheat. Long live the Crown holder.</p>
    </footer>

    <script src="app.js"></script>
  </body>
  </html>
  ```

- [ ] **Step 2: Verify in browser**
  Ensure the page loads with no emojis in headers, titles, or forms.

- [ ] **Step 3: Commit HTML changes**
  Run: `git commit -am "style: remove emojis and add hex board container"`

---

### Task 2: Hex Grid CSS Styling

We will design point-topped hexagons with margins, Catan card resource colors, and Catan-style win token disks.

**Files:**
- Modify: `public/style.css:80-280`

- [ ] **Step 1: Add hexagonal classes to public/style.css**
  Append these styles to `public/style.css`:
  ```css
  /* Hex board container centered layout */
  .board-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    overflow-x: auto;
    padding: 20px 0;
  }

  .hex-board-container {
    position: relative;
    margin: 0 auto;
  }

  /* Clip-path Hexagon container */
  .catan-hex {
    position: absolute;
    background-color: var(--color-border);
    clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
    transition: transform 0.2s;
    user-select: none;
  }

  .catan-hex:hover {
    transform: scale(1.05);
    z-index: 10;
  }

  /* Inner wrapper to create border effect */
  .hex-inner {
    position: absolute;
    top: 4px;
    left: 4px;
    right: 4px;
    bottom: 4px;
    clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 12px;
    box-sizing: border-box;
    text-align: center;
  }

  /* Catan resource styles */
  .hex-wheat .hex-inner {
    background-color: var(--color-wheat);
    background-image: repeating-linear-gradient(45deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 2px, transparent 2px, transparent 10px);
  }

  .hex-forest .hex-inner {
    background-color: var(--color-forest);
    color: #fff;
  }

  .hex-clay .hex-inner {
    background-color: var(--color-clay);
    color: #fff;
  }

  .hex-ore .hex-inner {
    background-color: var(--color-ore);
    color: #fff;
  }

  .hex-pasture .hex-inner {
    background-color: #7CFC00; /* Light pasture green */
  }

  .hex-desert .hex-inner {
    background-color: #D2B48C; /* Tan desert */
  }

  /* Player name on hex */
  .hex-player-name {
    font-size: 0.85rem;
    font-weight: bold;
    font-family: var(--font-tactile);
    max-width: 90%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-shadow: 1px 1px 0px rgba(0,0,0,0.1);
  }

  .hex-forest .hex-player-name, .hex-clay .hex-player-name, .hex-ore .hex-player-name {
    text-shadow: 1px 1px 0px rgba(0,0,0,0.5);
  }

  /* Circular number token */
  .hex-token {
    background-color: var(--color-parchment);
    border: 2px solid var(--color-border);
    border-radius: 50%;
    width: 46px;
    height: 46px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-shadow: 2px 2px 0px rgba(0,0,0,0.3);
    margin-top: 6px;
  }

  .token-wins .wins-number {
    font-size: 1.15rem;
    font-weight: bold;
    font-family: var(--font-data);
    color: var(--color-ink);
  }

  .token-wins .wins-label {
    font-size: 0.55rem;
    font-family: var(--font-tactile);
    text-transform: uppercase;
    margin-top: -3px;
    color: #555;
  }

  .token-desert {
    background-color: transparent;
    border: none;
    box-shadow: none;
  }

  .token-desert .wins-number {
    font-size: 1.3rem;
    color: rgba(0,0,0,0.4);
  }

  .token-desert .wins-label {
    display: none;
  }
  ```

- [ ] **Step 2: Commit styling changes**
  Run: `git commit -am "style: add CSS hexagonal grids and resource designs"`

---

### Task 3: Spiral Honeycomb Layout Logic

We will implement a coordinate array and positioning algorithm in the client-side app to dynamically arrange players in spiral order based on their rank.

**Files:**
- Modify: `public/app.js:1-250`

- [ ] **Step 1: Update app.js to include hex rendering and remove front-end emojis**
  Implement the coordinates list, `renderHexBoard`, and remove emojis from lists:
  - Add coordinates mapping list.
  - Call `renderHexBoard` inside `updateDashboard()`.
  - Replace any emojis inside client-side templates (e.g. current crowns badges).
  
  ```javascript
  // Axial coordinates list for standard spiral hex board
  const hexCoords = [
    { q: 0, r: 0 }, // Center
    // Ring 1 (6 hexes)
    { q: 1, r: -1 }, { q: 1, r: 0 }, { q: 0, r: 1 },
    { q: -1, r: 1 }, { q: -1, r: 0 }, { q: 0, r: -1 },
    // Ring 2 (12 hexes)
    { q: 2, r: -2 }, { q: 2, r: -1 }, { q: 2, r: 0 }, { q: 1, r: 1 },
    { q: 0, r: 2 }, { q: -1, r: 2 }, { q: -2, r: 2 }, { q: -2, r: 1 },
    { q: -2, r: 0 }, { q: -1, r: -1 }, { q: 0, r: -2 }, { q: 1, r: -2 },
    // Ring 3 (18 hexes)
    { q: 3, r: -3 }, { q: 3, r: -2 }, { q: 3, r: -1 }, { q: 3, r: 0 },
    { q: 2, r: 1 }, { q: 1, r: 2 }, { q: 0, r: 3 }, { q: -1, r: 3 },
    { q: -2, r: 3 }, { q: -3, r: 3 }, { q: -3, r: 2 }, { q: -3, r: 1 },
    { q: -3, r: 0 }, { q: -2, r: -1 }, { q: -1, r: -2 }, { q: 0, r: -3 },
    { q: 1, r: -3 }, { q: 2, r: -3 }
  ];

  // Inside app.js
  async function updateDashboard() {
    await fetchPlayers();
    setupDivisionSelect();
    await renderLeaderboard();
    await renderCrownsAndLineage();
    renderHexBoard(playersList);
  }

  function renderHexBoard(players) {
    const container = document.getElementById('hexBoardContainer');
    container.innerHTML = '';

    if (players.length === 0) {
      container.innerHTML = '<p style="text-align:center; padding: 20px;">No players registered yet.</p>';
      container.style.width = 'auto';
      container.style.height = 'auto';
      return;
    }

    // Sort players by totalWins desc so top winner is in center (desert is 0 wins)
    // We can fetch stats from /api/stats to get exact wins, or calculate locally.
    // Let's query stats from endpoint so we have wins for each player.
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        const stats = data.playerStats;
        
        const hexWidth = 104;
        const hexHeight = 120;

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        const positions = stats.map((player, index) => {
          const coord = hexCoords[index % hexCoords.length];
          const x = (coord.q * hexWidth) + (coord.r * (hexWidth / 2));
          const y = coord.r * (hexHeight * 0.75);

          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;

          return { player, x, y };
        });

        const paddingX = hexWidth;
        const paddingY = hexHeight;
        const boardWidth = (maxX - minX) + paddingX;
        const boardHeight = (maxY - minY) + paddingY;

        container.style.width = `${boardWidth}px`;
        container.style.height = `${boardHeight}px`;

        positions.forEach(({ player, x, y }) => {
          const left = x - minX + (hexWidth / 2) - (hexWidth / 2);
          const top = y - minY + (hexHeight / 2) - (hexHeight / 2);

          const hex = document.createElement('div');
          hex.className = 'catan-hex';

          const resourceTypes = ['wheat', 'forest', 'clay', 'ore', 'pasture'];
          const rank = stats.indexOf(player);
          const resource = player.totalWins === 0 ? 'desert' : resourceTypes[rank % resourceTypes.length];
          hex.classList.add(`hex-${resource}`);

          hex.style.left = `${left}px`;
          hex.style.top = `${top}px`;
          hex.style.width = `${hexWidth}px`;
          hex.style.height = `${hexHeight}px`;

          const tokenClass = player.totalWins === 0 ? 'token-desert' : 'token-wins';
          const tokenVal = player.totalWins === 0 ? '0' : player.totalWins;

          hex.innerHTML = `
            <div class="hex-inner">
              <div class="hex-player-name">${escapeHtml(player.name)}</div>
              <div class="hex-token ${tokenClass}">
                <span class="wins-number">${tokenVal}</span>
                <span class="wins-label">wins</span>
              </div>
            </div>
          `;

          container.appendChild(hex);
        });
      })
      .catch(err => {
        console.error('Error rendering hex board:', err);
      });
  }
  ```

- [ ] **Step 2: Remove Emojis in dynamically rendered Crown badges in app.js**
  Remove emoji characters in `renderCrownsAndLineage()` method:
  `<h3>4-Player Crown</h3>` instead of `<h3>4-Player Crown 🏆</h3>` etc.

- [ ] **Step 3: Commit JS changes**
  Run: `git commit -am "feat: implement hex board render layout and emoji removals"`

---

## Handoff Choice

Plan complete and saved to `docs/superpowers/plans/2026-07-17-catan-hex-leaderboard.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
