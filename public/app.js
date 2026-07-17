let activeTab = 'global';
let playersList = [];

document.addEventListener('DOMContentLoaded', async () => {
  await fetchPlayers();
  setupDivisionSelect();
  await updateDashboard();

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

  for (let i = 1; i <= div; i++) {
    const row = document.createElement('div');
    row.className = 'placement-row';
    
    const label = document.createElement('span');
    label.innerText = `${i}${getOrdinal(i)} Place:`;
    label.style.width = '80px';
    label.style.fontWeight = 'bold';

    const playerSelect = document.createElement('select');
    playerSelect.className = 'player-select';
    playerSelect.required = true;
    playerSelect.innerHTML = `<option value="">-- Choose Player --</option>` +
      playersList.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    const vpInput = document.createElement('input');
    vpInput.type = 'number';
    vpInput.placeholder = 'VP Score';
    vpInput.required = true;
    vpInput.min = '0';
    vpInput.max = '15';
    vpInput.className = 'vp-input';

    row.appendChild(label);
    row.appendChild(playerSelect);
    row.appendChild(vpInput);
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
}

async function renderLeaderboard() {
  const endpoint = activeTab === 'global' ? '/api/stats' : `/api/stats/${activeTab}`;
  const tbody = document.getElementById('leaderboardBody');
  tbody.innerHTML = '<tr><td colspan="6">Loading stats...</td></tr>';

  try {
    const res = await fetch(endpoint);
    const data = await res.json();
    const stats = data.playerStats;

    tbody.innerHTML = '';
    if (!stats || stats.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6">No matches recorded yet.</td></tr>';
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
        <td><small>${placementStr || 'None'}</small></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6">Error loading leaderboards.</td></tr>';
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
          <h3>${div}-Player Crown</h3>
          <div class="holder-name">${escapeHtml(crown.currentHolderName)}</div>
          <div>Defenses: <strong>${crown.defensesCount}</strong></div>
        `;
      } else {
        badge.innerHTML = `
          <h3>${div}-Player Crown</h3>
          <div class="holder-name" style="color:#777; font-size:1rem;">Vacant</div>
          <div>No champion crowned yet</div>
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
      victoryPoints: parseInt(vpVal, 10)
    });
  }

  try {
    const res = await fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ division, placements })
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
