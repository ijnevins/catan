let activeTab = 'global';
let playersList = [];

// Axial coordinates list for standard spiral hex board layout
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

document.addEventListener('DOMContentLoaded', async () => {
  await fetchPlayers();
  setupDivisionSelect();
  await updateDashboard();

  // Default date to today
  const dateInput = document.getElementById('matchDate');
  dateInput.value = new Date().toISOString().split('T')[0];

  // Event Listeners
  document.getElementById('divisionSelect').addEventListener('change', setupDivisionSelect);
  document.getElementById('playerForm').addEventListener('submit', handlePlayerSubmit);
  document.getElementById('matchForm').addEventListener('submit', handleMatchSubmit);

  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      activeTab = e.target.getAttribute('data-div');
      renderLeaderboard();
    });
  });
});

async function fetchPlayers() {
  try {
    const res = await fetch('/api/players');
    playersList = await res.json();
  } catch (err) {
    console.error('Error fetching players:', err);
  }
}

function setupDivisionSelect() {
  const div = parseInt(document.getElementById('divisionSelect').value, 10);
  const container = document.getElementById('placementInputsContainer');
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'placement-header';
  header.innerHTML = `
    <span>Rank</span>
    <span>Player</span>
    <span title="Victory Points">VP</span>
    <span title="Settlements">Settlements</span>
    <span title="Cities">Cities</span>
    <span title="Metropolis">Metro</span>
    <span title="Longest Road">Road</span>
  `;
  container.appendChild(header);

  for (let i = 1; i <= div; i++) {
    const row = document.createElement('div');
    row.className = 'placement-row';
    
    const label = document.createElement('span');
    label.innerText = `${i}${getOrdinal(i)}`;
    label.className = 'rank-label';

    const playerSelect = document.createElement('select');
    playerSelect.className = 'player-select';
    playerSelect.required = true;
    playerSelect.innerHTML = `<option value="">-- Player --</option>` +
      playersList.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    const vpInput = document.createElement('input');
    vpInput.type = 'number';
    vpInput.placeholder = 'VP';
    vpInput.required = true;
    vpInput.min = '0';
    vpInput.max = '15';
    vpInput.className = 'vp-input';

    const settlementsInput = document.createElement('input');
    settlementsInput.type = 'number';
    settlementsInput.placeholder = 'Set';
    settlementsInput.required = true;
    settlementsInput.min = '0';
    settlementsInput.max = '5';
    settlementsInput.value = '0';
    settlementsInput.className = 'settlements-input';

    const citiesInput = document.createElement('input');
    citiesInput.type = 'number';
    citiesInput.placeholder = 'City';
    citiesInput.required = true;
    citiesInput.min = '0';
    citiesInput.max = '4';
    citiesInput.value = '0';
    citiesInput.className = 'cities-input';

    const metropolisInput = document.createElement('input');
    metropolisInput.type = 'number';
    metropolisInput.placeholder = 'Metro';
    metropolisInput.required = true;
    metropolisInput.min = '0';
    metropolisInput.max = '3';
    metropolisInput.value = '0';
    metropolisInput.className = 'metropolis-input';

    const longestRoadCheckbox = document.createElement('input');
    longestRoadCheckbox.type = 'checkbox';
    longestRoadCheckbox.className = 'longest-road-checkbox';

    row.appendChild(label);
    row.appendChild(playerSelect);
    row.appendChild(vpInput);
    row.appendChild(settlementsInput);
    row.appendChild(citiesInput);
    row.appendChild(metropolisInput);
    row.appendChild(longestRoadCheckbox);
    container.appendChild(row);
  }
}

function getOrdinal(n) {
  if (n === 1) return 'st';
  if (n === 2) return 'nd';
  if (n === 3) return 'rd';
  return 'th';
}

async function updateDashboard() {
  await fetchPlayers();
  setupDivisionSelect();
  await renderLeaderboard();
  await renderCrownsAndLineage();
  renderHexBoard(playersList);
}

async function renderLeaderboard() {
  const endpoint = activeTab === 'global' ? '/api/stats' : `/api/stats/${activeTab}`;
  const tbody = document.getElementById('leaderboardBody');
    tbody.innerHTML = '<tr><td colspan="11">Loading stats...</td></tr>';

    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      const stats = data.playerStats;

      tbody.innerHTML = '';
      if (!stats || stats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11">No matches recorded yet.</td></tr>';
        return;
      }

      stats.forEach(player => {
        const tr = document.createElement('tr');
        const winRatePct = (player.winRate * 100).toFixed(1) + '%';
        const placementStr = Object.entries(player.placements)
          .filter(([place, count]) => count > 0)
          .map(([place, count]) => `${place}${getOrdinal(parseInt(place))}: ${count}`)
          .join(', ');

        tr.innerHTML = `
          <td><strong>${escapeHtml(player.name)}</strong></td>
          <td>${player.totalWins}</td>
          <td>${player.totalLosses}</td>
          <td>${winRatePct}</td>
          <td>${player.currentStreak} (${player.maxStreak})</td>
          <td>${player.totalSettlements || 0}</td>
          <td>${player.totalCities || 0}</td>
          <td>${player.totalMetropolises || 0}</td>
          <td>${player.totalLongestRoads || 0}</td>
          <td><small>${placementStr || 'None'}</small></td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="11">Error loading leaderboards.</td></tr>';
    }
}

async function renderCrownsAndLineage() {
  const crownsContainer = document.getElementById('crownsContainer');
  const timeline = document.getElementById('lineageTimeline');
  crownsContainer.innerHTML = 'Loading crowns...';
  timeline.innerHTML = 'Loading lineage...';

  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    
    const crowns = data.crowns;
    const reigns = data.reigns;

    // Render Crown Badges
    crownsContainer.innerHTML = '';
    [4, 5, 6].forEach(div => {
      const crown = crowns.find(c => c.division === div);
      const badge = document.createElement('div');
      badge.className = 'crown-badge';
      
      if (crown) {
        badge.innerHTML = `
          <img src="images/scroll.webp" alt="Scroll" class="scroll-img">
          <div class="scroll-content">
            <span class="crown-icon">👑</span>
            <h3>${div}-Player Crown</h3>
            <div class="holder-name">${escapeHtml(crown.currentHolderName)}</div>
            <div class="defenses-info">⚔️ ${crown.defensesCount} Defense${crown.defensesCount !== 1 ? 's' : ''}</div>
          </div>
        `;
      } else {
        badge.innerHTML = `
          <img src="images/scroll.webp" alt="Scroll" class="scroll-img">
          <div class="scroll-content">
            <span class="crown-icon">🏰</span>
            <h3>${div}-Player Crown</h3>
            <div class="holder-name vacant-text">Vacant</div>
            <div class="defenses-info">No champion crowned yet</div>
          </div>
        `;
      }
      crownsContainer.appendChild(badge);
    });

    // Render Lineage Timeline
    timeline.innerHTML = '';
    if (!reigns || reigns.length === 0) {
      timeline.innerHTML = '<p>No crown reign lineage recorded.</p>';
      return;
    }

    // Sort reigns by start date desc
    const sortedReigns = [...reigns].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

    sortedReigns.forEach(reign => {
      const item = document.createElement('div');
      item.className = 'timeline-item';
      
      const dateStr = new Date(reign.startedAt).toLocaleDateString();
      const activeLabel = reign.endedAt ? `Reigned until ${new Date(reign.endedAt).toLocaleDateString()}` : 'CURRENT CHAMPION';
      
      item.innerHTML = `
        <div class="reign-title">${reign.division}-Player Crown: ${escapeHtml(reign.playerName)}</div>
        <div class="reign-details">
          Started: ${dateStr} | ${activeLabel} <br>
          Successful Defenses: <strong>${reign.successfulDefenses}</strong>
        </div>
      `;
      timeline.appendChild(item);
    });

  } catch (err) {
    crownsContainer.innerHTML = 'Error loading crowns.';
    timeline.innerHTML = 'Error loading lineage.';
  }
}

async function handlePlayerSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('playerNameInput');
  const name = input.value.trim();
  if (!name) return;

  try {
    const res = await fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    
    if (!res.ok) {
      const errData = await res.json();
      alert(errData.error || 'Failed to create player');
      return;
    }

    input.value = '';
    await updateDashboard();
  } catch (err) {
    alert('Error creating player');
  }
}

async function handleMatchSubmit(e) {
  e.preventDefault();
  const division = parseInt(document.getElementById('divisionSelect').value, 10);
  const rows = document.querySelectorAll('.placement-row');
  const placements = [];
  const chosenPlayerIds = new Set();

  for (let i = 0; i < rows.length; i++) {
    const select = rows[i].querySelector('.player-select');
    const vpVal = rows[i].querySelector('.vp-input').value;
    const settlementsVal = rows[i].querySelector('.settlements-input').value;
    const citiesVal = rows[i].querySelector('.cities-input').value;
    const metropolisVal = rows[i].querySelector('.metropolis-input').value;
    const longestRoadChecked = rows[i].querySelector('.longest-road-checkbox').checked;
    
    const playerId = select.value;
    const playerName = select.options[select.selectedIndex].text;

    if (!playerId) {
      alert('Please assign a player to all placements');
      return;
    }
    if (chosenPlayerIds.has(playerId)) {
      alert('Each player can only be assigned to one placement per match');
      return;
    }
    chosenPlayerIds.add(playerId);

    placements.push({
      playerId,
      playerName,
      place: i + 1,
      victoryPoints: parseInt(vpVal, 10),
      settlements: parseInt(settlementsVal, 10) || 0,
      cities: parseInt(citiesVal, 10) || 0,
      metropolis: parseInt(metropolisVal, 10) || 0,
      longestRoad: longestRoadChecked
    });
  }

  const dateVal = document.getElementById('matchDate').value;
  const playedAt = dateVal ? new Date(dateVal + 'T12:00:00Z').toISOString() : undefined;

  try {
    const res = await fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ division, placements, playedAt })
    });

    if (!res.ok) {
      const errData = await res.json();
      alert(errData.error || 'Failed to record match');
      return;
    }

    await updateDashboard();
  } catch (err) {
    alert('Error recording match');
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.innerText = str;
  return div.innerHTML;
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

  fetch('/api/stats')
    .then(res => res.json())
    .then(data => {
      const stats = data.playerStats;
      
      const hexWidth = 120;
      const hexHeight = 104;
      const renderWidth = 124;
      const renderHeight = 108;

      const neighborDirs = [
        { q: 1, r: -1 }, { q: 1, r: 0 }, { q: 0, r: 1 },
        { q: -1, r: 1 }, { q: -1, r: 0 }, { q: 0, r: -1 }
      ];

      const playerHexes = stats.map((player, index) => {
        const coord = hexCoords[index % hexCoords.length];
        return { player, q: coord.q, r: coord.r, type: 'land', rank: index };
      });

      const occupiedMap = new Set(playerHexes.map(h => `${h.q},${h.r}`));
      const waterMap = new Set();
      const waterHexes = [];

      playerHexes.forEach(h => {
        neighborDirs.forEach(d => {
          const nq = h.q + d.q;
          const nr = h.r + d.r;
          const key = `${nq},${nr}`;
          if (!occupiedMap.has(key) && !waterMap.has(key)) {
            waterMap.add(key);
            waterHexes.push({ q: nq, r: nr, type: 'water' });
          }
        });
      });

      const allHexes = [...playerHexes, ...waterHexes];

      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;

      allHexes.forEach(h => {
        h.x = h.q * (hexWidth * 0.73);
        h.y = (h.r * (hexHeight * 0.975)) + (h.q * ((hexHeight * 0.975) / 2));

        if (h.x < minX) minX = h.x;
        if (h.x > maxX) maxX = h.x;
        if (h.y < minY) minY = h.y;
        if (h.y > maxY) maxY = h.y;
      });

      const paddingX = renderWidth;
      const paddingY = renderHeight;
      const boardWidth = (maxX - minX) + paddingX;
      const boardHeight = (maxY - minY) + paddingY;

      container.style.width = `${boardWidth}px`;
      container.style.height = `${boardHeight}px`;

      const resourceTypes = ['wheat', 'forest', 'clay', 'ore', 'pasture'];

      allHexes.forEach(h => {
        const left = h.x - minX;
        const top = h.y - minY;

        const hex = document.createElement('div');
        hex.className = 'catan-hex';

        if (h.type === 'land') {
          const resource = resourceTypes[h.rank % resourceTypes.length];
          hex.classList.add(`hex-${resource}`);

          const wins = h.player.totalWins || 0;
          const isRed = h.rank === 0 || wins >= 5;
          const numClass = isRed ? 'token-number is-red' : 'token-number';
          const dotClass = isRed ? 'token-dot is-red' : 'token-dot';

          const dotCount = wins === 0 ? 1 : Math.min(5, Math.max(1, wins + 1));
          let dotsHtml = '';
          for (let i = 0; i < dotCount; i++) {
            dotsHtml += `<div class="${dotClass}"></div>`;
          }

          hex.innerHTML = `
            <div class="hex-inner">
              <div class="hex-player-name">${escapeHtml(h.player.name)}</div>
              <div class="hex-token">
                <div class="${numClass}">${wins}</div>
                <div class="token-dots">${dotsHtml}</div>
              </div>
            </div>
          `;
        } else {
          hex.classList.add('hex-water');
          hex.innerHTML = `<div class="hex-inner"></div>`;
        }

        hex.style.left = `${left}px`;
        hex.style.top = `${top}px`;
        hex.style.width = `${renderWidth}px`;
        hex.style.height = `${renderHeight}px`;

        container.appendChild(hex);
      });
    })
    .catch(err => {
      console.error('Error rendering hex board:', err);
    });
}
