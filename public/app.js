let activeTab = 'global';
let playersList = [];
let currentUser = null;

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
  await initAuth();
  await fetchPlayers();
  setupDivisionSelect();
  await updateDashboard();
  renderLineage('4'); // Initialize with 4-player division

  // Default date to today
  const dateInput = document.getElementById('matchDate');
  dateInput.value = new Date().toISOString().split('T')[0];

  // Event Listeners
  document.getElementById('divisionSelect').addEventListener('change', setupDivisionSelect);
  document.getElementById('modeDetailed').addEventListener('change', setupDivisionSelect);
  document.getElementById('modeSimple').addEventListener('change', setupDivisionSelect);
  const playerForm = document.getElementById('playerForm');
  if (playerForm) {
    playerForm.addEventListener('submit', handlePlayerSubmit);
  }
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

  // Init Gallery
  initGallery();

  // Page-level tab navigation
  document.querySelectorAll('.page-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetPage = e.target.getAttribute('data-page');

      // Toggle active button
      document.querySelectorAll('.page-tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');

      // Toggle active page content
      document.querySelectorAll('.page-content').forEach(page => page.classList.remove('active'));
      const targetEl = document.getElementById('page-' + targetPage);
      if (targetEl) targetEl.classList.add('active');
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
  const isSimpleMode = document.getElementById('modeSimple').checked;
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'placement-header';

  if (isSimpleMode) {
    header.innerHTML = `
      <span>Role</span>
      <span>Player</span>
    `;
    header.style.gridTemplateColumns = "1fr 2fr";
  } else {
    header.innerHTML = `
      <span>Player</span>
      <span title="Victory Points">VP</span>
      <span title="Settlements">Settlements</span>
      <span title="Cities">Cities</span>
      <span title="Metropolis">Metro</span>
      <span title="Longest Road">Road</span>
    `;
    header.style.gridTemplateColumns = "";
  }
  container.appendChild(header);

  for (let i = 1; i <= div; i++) {
    const row = document.createElement('div');
    row.className = 'placement-row';

    if (isSimpleMode) {
      row.style.gridTemplateColumns = "1fr 2fr";
      const roleLabel = document.createElement('div');
      roleLabel.className = 'rank-label';
      roleLabel.innerText = i === 1 ? 'Winner' : 'Participant';
      row.appendChild(roleLabel);
    } else {
      row.style.gridTemplateColumns = "";
    }

    const playerSelect = document.createElement('select');
    playerSelect.className = 'player-select';
    playerSelect.required = true;
    playerSelect.innerHTML = `<option value="">-- Player --</option>` +
      playersList.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    row.appendChild(playerSelect);

    if (!isSimpleMode) {
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
      settlementsInput.min = '0';
      settlementsInput.max = '5';
      settlementsInput.className = 'settlements-input';

      const citiesInput = document.createElement('input');
      citiesInput.type = 'number';
      citiesInput.placeholder = 'City';
      citiesInput.min = '0';
      citiesInput.max = '4';
      citiesInput.className = 'cities-input';

      const metropolisInput = document.createElement('input');
      metropolisInput.type = 'number';
      metropolisInput.placeholder = 'Metro';
      metropolisInput.min = '0';
      metropolisInput.max = '3';
      metropolisInput.className = 'metropolis-input';

      const longestRoadCheckbox = document.createElement('input');
      longestRoadCheckbox.type = 'checkbox';
      longestRoadCheckbox.className = 'longest-road-checkbox';

      row.appendChild(vpInput);
      row.appendChild(settlementsInput);
      row.appendChild(citiesInput);
      row.appendChild(metropolisInput);
      row.appendChild(longestRoadCheckbox);
    }

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
  await renderMatchHistory();
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
      tbody.innerHTML = '<tr><td colspan="13">No matches recorded yet.</td></tr>';
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
          <td>${player.avgVps}</td>
          <td>${player.avgMiscPoints}</td>
          <td>${player.avgSettlements}</td>
          <td>${player.avgCities}</td>
          <td>${player.avgMetropolises}</td>
          <td>${player.longestRoadRate}</td>
          <td><small>${placementStr || 'None'}</small></td>
        `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="13">Error loading leaderboards.</td></tr>';
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
            <h3>${div}-Player Victor</h3>
            <div class="holder-name">${escapeHtml(crown.currentHolderName)}</div>
            <div class="defenses-info">${crown.defensesCount} Defense${crown.defensesCount !== 1 ? 's' : ''}</div>
          </div>
        `;
        crownsContainer.appendChild(badge);

        if (crown.interimHolderId) {
          const interimBadge = document.createElement('div');
          interimBadge.className = 'crown-badge interim-badge';
          interimBadge.innerHTML = `
            <img src="images/scroll.webp" alt="Scroll" class="scroll-img">
            <div class="scroll-content">
              <h3>${div}-Player Victor INTERIM</h3>
              <div class="holder-name interim-text">${escapeHtml(crown.interimHolderName)}</div>
              <div class="defenses-info">${crown.interimConsecutiveWins} Consecutive Win${crown.interimConsecutiveWins !== 1 ? 's' : ''}</div>
            </div>
          `;
          crownsContainer.appendChild(interimBadge);
        }
      } else {
        badge.innerHTML = `
          <img src="images/scroll.webp" alt="Scroll" class="scroll-img">
          <div class="scroll-content">
            <h3>${div}-Player Victor</h3>
            <div class="holder-name vacant-text">Vacant</div>
            <div class="defenses-info">No champion crowned yet</div>
          </div>
        `;
        crownsContainer.appendChild(badge);
      }
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
      const interimTag = reign.wasInterim ? ' <span class="interim-tag" style="color:#a8b2c1; font-size:0.8em;">(Promoted from Interim)</span>' : '';

      item.innerHTML = `
        <div class="reign-title">${reign.division}-Player ${reign.division === 6 ? 'Belt' : 'Crown'}: ${escapeHtml(reign.playerName)}${interimTag}</div>
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
  const isSimpleMatch = document.getElementById('modeSimple').checked;

  for (let i = 0; i < rows.length; i++) {
    const select = rows[i].querySelector('.player-select');
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

    if (isSimpleMatch) {
      placements.push({
        playerId,
        playerName,
        place: i === 0 ? 1 : 2,
        victoryPoints: null,
        settlements: null,
        cities: null,
        metropolis: null,
        longestRoad: null
      });
    } else {
      const vpVal = rows[i].querySelector('.vp-input').value;
      const settlementsVal = rows[i].querySelector('.settlements-input').value;
      const citiesVal = rows[i].querySelector('.cities-input').value;
      const metropolisVal = rows[i].querySelector('.metropolis-input').value;
      const longestRoadChecked = rows[i].querySelector('.longest-road-checkbox').checked;

      const hasStats = settlementsVal !== '' || citiesVal !== '' || metropolisVal !== '';

      placements.push({
        playerId,
        playerName,
        victoryPoints: parseInt(vpVal, 10),
        settlements: hasStats ? (parseInt(settlementsVal, 10) || 0) : null,
        cities: hasStats ? (parseInt(citiesVal, 10) || 0) : null,
        metropolis: hasStats ? (parseInt(metropolisVal, 10) || 0) : null,
        longestRoad: hasStats ? longestRoadChecked : null
      });
    }
  }

  if (!isSimpleMatch) {
    // Sort placements dynamically by victory points descending
    placements.sort((a, b) => b.victoryPoints - a.victoryPoints);

    // Assign place values with standard competition ranking
    let currentRank = 1;
    placements.forEach((p, idx) => {
      if (idx > 0 && p.victoryPoints < placements[idx - 1].victoryPoints) {
        currentRank = idx + 1;
      }
      p.place = currentRank;
    });
  }

  const dateVal = document.getElementById('matchDate').value;
  let playedAt;
  if (dateVal) {
    if (dateVal.includes('T')) {
      playedAt = new Date(dateVal).toISOString();
    } else {
      playedAt = new Date(dateVal + 'T12:00:00Z').toISOString();
    }
  }

  try {
    const res = await fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ division, placements, playedAt, isSimpleMatch })
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

      let currentTieRank = 0;
      stats.forEach((p, idx) => {
        if (idx > 0 && p.totalWins < stats[idx - 1].totalWins) {
          currentTieRank++;
        }
        p.tieRank = currentTieRank;
      });

      const hexWidth = 160;
      const hexHeight = hexWidth * (Math.sqrt(3) / 2);
      const renderWidth = hexWidth;
      const renderHeight = hexHeight;

      const neighborDirs = [
        { q: 1, r: -1 }, { q: 1, r: 0 }, { q: 0, r: 1 },
        { q: -1, r: 1 }, { q: -1, r: 0 }, { q: 0, r: -1 }
      ];

      let totalLandHexes = 19; // Standard Catan board size
      if (stats.length > 19) totalLandHexes = 37;
      if (stats.length > 37) totalLandHexes = 61; // Optional expansion

      const allLandHexes = [];
      for (let i = 0; i < totalLandHexes && i < hexCoords.length; i++) {
        const coord = hexCoords[i];
        if (i < stats.length) {
          allLandHexes.push({ player: stats[i], q: coord.q, r: coord.r, type: 'land', rank: i });
        } else {
          allLandHexes.push({ player: null, q: coord.q, r: coord.r, type: 'desert', rank: i });
        }
      }

      const occupiedMap = new Set(allLandHexes.map(h => `${h.q},${h.r}`));
      const waterMap = new Set();
      const waterHexes = [];

      allLandHexes.forEach(h => {
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

      const allHexes = [...allLandHexes, ...waterHexes];

      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;

      const colStep = hexWidth * 0.748; // Slight tightening for seamless touch without subpixel gap
      const rowStep = hexHeight * 0.998;

      allHexes.forEach(h => {
        h.x = h.q * colStep;
        h.y = (h.r * rowStep) + (h.q * (rowStep / 2));

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
          const resource = h.player.tilePreference || resourceTypes[h.rank % resourceTypes.length];
          hex.classList.add(`hex-${resource}`);

          const wins = h.player.totalWins || 0;
          const isRed = h.player.tieRank === 0 || wins >= 5;
          const numClass = isRed ? 'token-number is-red' : 'token-number';
          const dotClass = isRed ? 'token-dot is-red' : 'token-dot';

          const dotCount = Math.max(1, 5 - h.player.tieRank);
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
        } else if (h.type === 'desert') {
          hex.classList.add('hex-desert');
          hex.innerHTML = `<div class="hex-inner"></div>`;
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

async function renderMatchHistory() {
  const tbody = document.getElementById('matchHistoryBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4">Loading match history...</td></tr>';

  try {
    const res = await fetch('/api/matches');
    const matches = await res.json();

    tbody.innerHTML = '';
    if (!matches || matches.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">No matches played yet.</td></tr>';
      return;
    }

    // Sort matches chronologically desc (most recent first)
    matches.sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt));

    matches.forEach(match => {
      const tr = document.createElement('tr');

      const dateStr = new Date(match.playedAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      });

      const winner = match.placements.find(p => p.place === 1);
      const winnerName = winner ? winner.playerName : 'Unknown';

      // Build placements detailed details (VP, settlements, cities, metros, roads)
      const placementsStr = match.placements
        .sort((a, b) => a.place - b.place)
        .map(p => {
          const stats = [];
          stats.push(`${p.victoryPoints || 13}VP`);
          if (p.settlements !== null && p.settlements !== undefined) stats.push(`${p.settlements} Set`);
          if (p.cities !== null && p.cities !== undefined) stats.push(`${p.cities} City`);
          if (p.metropolis !== null && p.metropolis !== undefined) stats.push(`${p.metropolis} Metro`);
          if (p.longestRoad) stats.push(`Road`);
          const placeSuffix = p.place === 1 ? 'st' : p.place === 2 ? 'nd' : p.place === 3 ? 'rd' : 'th';
          return `<strong>${p.place}${placeSuffix}:</strong> ${escapeHtml(p.playerName)} (${stats.join(', ')})`;
        })
        .join('<br>');

      tr.innerHTML = `
        <td>${dateStr}</td>
        <td>${match.division}-Player</td>
        <td><strong>${escapeHtml(winnerName)}</strong></td>
        <td style="text-align: left;"><small>${placementsStr}</small></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="4">Error loading match history.</td></tr>';
  }
}

// ==========================================
// MEMORIES GALLERY CODE
// ==========================================
let galleryImages = [];
let currentSlideIndex = 0;

async function initGallery() {
  const fileInput = document.getElementById('galleryFileInput');
  const fileLabel = document.getElementById('fileNameLabel');
  const dateInput = document.getElementById('galleryDateInput');
  const form = document.getElementById('galleryForm');

  // Set default date to today
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  // Update file input name label on change
  if (fileInput && fileLabel) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      fileLabel.innerText = file ? file.name : 'No file chosen';
    });
  }

  // Slide navigation
  document.getElementById('galleryPrevBtn')?.addEventListener('click', () => {
    navigateSlider(-1);
  });
  document.getElementById('galleryNextBtn')?.addEventListener('click', () => {
    navigateSlider(1);
  });

  // Handle image upload submission
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const fileInput = document.getElementById('galleryFileInput');
      const dateInput = document.getElementById('galleryDateInput');
      const descInput = document.getElementById('galleryDescInput');
      const submitBtn = form.querySelector('button[type="submit"]');

      let imageSource = '';

      if (fileInput.files.length > 0) {
        // Read file as base64
        try {
          submitBtn.disabled = true;
          submitBtn.innerText = 'Uploading Photo...';
          imageSource = await readFileAsBase64(fileInput.files[0]);
        } catch (err) {
          alert('Failed to read image file.');
          submitBtn.disabled = false;
          submitBtn.innerText = 'Add to Photos';
          return;
        }
      } else {
        alert('Please choose an image file.');
        return;
      }

      const payload = {
        image: imageSource,
        date: dateInput.value,
        description: descInput.value || ''
      };

      try {
        const res = await fetch('/api/gallery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Server error uploading image');
        }

        const newImage = await res.json();

        // Reset form and reload gallery
        form.reset();
        if (fileLabel) fileLabel.innerText = 'No file chosen';
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

        await fetchGalleryImages();

        // Show the newly added slide (which is sorted by date)
        const newIdx = galleryImages.findIndex(img => img.id === newImage.id);
        if (newIdx !== -1) {
          currentSlideIndex = newIdx;
        } else {
          currentSlideIndex = galleryImages.length - 1; // Fallback to end
        }
        renderSlider();
      } catch (err) {
        console.error(err);
        alert(`Error: ${err.message}`);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Add to Photos';
      }
    });
  }

  await fetchGalleryImages();
  renderSlider();
}

async function fetchGalleryImages() {
  try {
    const res = await fetch('/api/gallery');
    galleryImages = await res.json();
  } catch (err) {
    console.error('Error fetching gallery images:', err);
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

function navigateSlider(direction) {
  if (galleryImages.length <= 1) return;
  let newIdx = currentSlideIndex + direction;
  if (newIdx < 0) {
    newIdx = galleryImages.length - 1;
  } else if (newIdx >= galleryImages.length) {
    newIdx = 0;
  }
  showSlide(newIdx);
}

function showSlide(index) {
  if (galleryImages.length === 0) return;
  currentSlideIndex = index;

  // Update slides
  const slides = document.querySelectorAll('.gallery-slide');
  slides.forEach((slide, idx) => {
    if (idx === index) {
      slide.classList.add('active');
    } else {
      slide.classList.remove('active');
    }
  });

  // Update dots
  const dots = document.querySelectorAll('.gallery-dot');
  dots.forEach((dot, idx) => {
    if (idx === index) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });
}

function renderSlider() {
  const slider = document.getElementById('gallerySlider');
  const dotsContainer = document.getElementById('galleryDots');
  if (!slider || !dotsContainer) return;

  slider.innerHTML = '';
  dotsContainer.innerHTML = '';

  if (galleryImages.length === 0) {
    slider.innerHTML = `
      <div class="gallery-slide-placeholder">
        <p>No memories logged yet. Add the first picture below!</p>
      </div>
    `;
    return;
  }

  // Cap currentSlideIndex inside valid bounds
  if (currentSlideIndex >= galleryImages.length) {
    currentSlideIndex = Math.max(0, galleryImages.length - 1);
  }

  galleryImages.forEach((img, idx) => {
    const slide = document.createElement('div');
    slide.className = `gallery-slide ${idx === currentSlideIndex ? 'active' : ''}`;

    // Format Date (YYYY-MM-DD to friendly string)
    let friendlyDate = img.date;
    try {
      const parts = img.date.split('-');
      if (parts.length === 3) {
        // Use UTC-friendly date creation to avoid local timezone shifts
        const dateObj = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
        friendlyDate = dateObj.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'UTC'
        });
      }
    } catch (e) {
      // Fallback
    }

    slide.innerHTML = `
      <img src="${img.imageUrl}" alt="${escapeHtml(img.description || 'Catan memory')}" onerror="this.src='https://placehold.co/800x400/1a1510/dfd7c2?text=Image+Load+Failed'">
      <div class="gallery-slide-caption">
        <span class="gallery-slide-date">${escapeHtml(friendlyDate)}</span>
        <span class="gallery-slide-desc">${escapeHtml(img.description || 'No caption')}</span>
      </div>
    `;
    slider.appendChild(slide);

    // Create Dot
    const dot = document.createElement('div');
    dot.className = `gallery-dot ${idx === currentSlideIndex ? 'active' : ''}`;
    dot.addEventListener('click', () => {
      showSlide(idx);
    });
    dotsContainer.appendChild(dot);
  });
}

// --- Authentication Management ---
async function initAuth() {
  const token = localStorage.getItem('catan_token');
  if (token) {
    await fetchCurrentUser();
  } else {
    renderAuthBar();
  }

  // Bind UI buttons
  const showLoginBtn = document.getElementById('showLoginBtn');
  const showRegisterBtn = document.getElementById('showRegisterBtn');
  const loginModal = document.getElementById('loginModal');
  const registerModal = document.getElementById('registerModal');
  const closeLoginModal = document.getElementById('closeLoginModal');
  const closeRegisterModal = document.getElementById('closeRegisterModal');

  if (showLoginBtn) {
    showLoginBtn.addEventListener('click', () => {
      document.getElementById('loginError').style.display = 'none';
      document.getElementById('loginForm').reset();
      loginModal.classList.add('active');
    });
  }

  if (showRegisterBtn) {
    showRegisterBtn.addEventListener('click', async () => {
      document.getElementById('registerError').style.display = 'none';
      document.getElementById('registerForm').reset();
      await populateUnlinkedPlayers();
      registerModal.classList.add('active');
    });
  }

  if (closeLoginModal) {
    closeLoginModal.addEventListener('click', () => {
      loginModal.classList.remove('active');
    });
  }

  if (closeRegisterModal) {
    closeRegisterModal.addEventListener('click', () => {
      registerModal.classList.remove('active');
    });
  }

  // Radio button toggle for register modal
  const linkExistingRadio = document.getElementById('linkExisting');
  const linkNewRadio = document.getElementById('linkNew');
  const existingPlayerGroup = document.getElementById('existingPlayerGroup');
  const newPlayerGroup = document.getElementById('newPlayerGroup');

  if (linkExistingRadio && linkNewRadio) {
    linkExistingRadio.addEventListener('change', () => {
      existingPlayerGroup.style.display = 'block';
      newPlayerGroup.style.display = 'none';
      document.getElementById('registerPlayerSelect').required = true;
      document.getElementById('registerPlayerName').required = false;
    });

    linkNewRadio.addEventListener('change', () => {
      existingPlayerGroup.style.display = 'none';
      newPlayerGroup.style.display = 'block';
      document.getElementById('registerPlayerSelect').required = false;
      document.getElementById('registerPlayerName').required = true;
    });
  }

  // Form submits
  document.getElementById('loginForm').addEventListener('submit', handleLoginSubmit);
  document.getElementById('registerForm').addEventListener('submit', handleRegisterSubmit);
}

async function fetchCurrentUser() {
  const token = localStorage.getItem('catan_token');
  if (!token) {
    currentUser = null;
    renderAuthBar();
    return;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.ok) {
      const data = await res.json();
      currentUser = data; // contains user and player details
    } else {
      localStorage.removeItem('catan_token');
      currentUser = null;
    }
  } catch (err) {
    console.error('Error fetching current user:', err);
    currentUser = null;
  }
  renderAuthBar();
}

function renderAuthBar() {
  const authBar = document.getElementById('authBar');
  const authWelcome = document.getElementById('authWelcome');
  const authActions = document.getElementById('authActions');
  if (!authBar || !authWelcome || !authActions) return;

  if (currentUser && currentUser.user) {
    const user = currentUser.user;
    const player = currentUser.player;
    const playerName = player ? player.name : 'Unlinked';

    authWelcome.innerHTML = `Welcome, <strong>${escapeHtml(user.username)}</strong>! (Linked Player: <strong>${escapeHtml(playerName)}</strong>)`;

    authActions.innerHTML = `
      <div class="profile-settings">
        <label for="tilePrefSelect">Hex Skin:</label>
        <select id="tilePrefSelect" class="tile-pref-select">
          <option value="wheat" ${user.tilePreference === 'wheat' ? 'selected' : ''}>Wheat</option>
          <option value="clay" ${user.tilePreference === 'clay' ? 'selected' : ''}>Clay</option>
          <option value="forest" ${user.tilePreference === 'forest' ? 'selected' : ''}>Forest</option>
          <option value="ore" ${user.tilePreference === 'ore' ? 'selected' : ''}>Ore</option>
          <option value="pasture" ${user.tilePreference === 'pasture' ? 'selected' : ''}>Pasture</option>
          <option value="desert" ${user.tilePreference === 'desert' ? 'selected' : ''}>Desert</option>
        </select>
      </div>
      <button class="auth-btn btn-logout" id="logoutBtn">Logout</button>
    `;

    document.getElementById('tilePrefSelect').addEventListener('change', handleTilePreferenceChange);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  } else {
    authWelcome.innerText = 'Welcome! Log in to customize your tile preference.';
    authActions.innerHTML = `
      <button class="auth-btn" id="showLoginBtn">Login</button>
      <button class="auth-btn" id="showRegisterBtn">Register</button>
    `;
    // Re-bind listeners as buttons were recreated
    document.getElementById('showLoginBtn').addEventListener('click', () => {
      document.getElementById('loginError').style.display = 'none';
      document.getElementById('loginForm').reset();
      document.getElementById('loginModal').classList.add('active');
    });
    document.getElementById('showRegisterBtn').addEventListener('click', async () => {
      document.getElementById('registerError').style.display = 'none';
      document.getElementById('registerForm').reset();
      await populateUnlinkedPlayers();
      document.getElementById('registerModal').classList.add('active');
    });
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  const errDiv = document.getElementById('loginError');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('catan_token', data.token);
      document.getElementById('loginModal').classList.remove('active');
      await fetchCurrentUser();
      await updateDashboard();
    } else {
      const err = await res.json();
      errDiv.innerText = err.error || 'Login failed';
      errDiv.style.display = 'block';
    }
  } catch (err) {
    errDiv.innerText = 'Network error during login';
    errDiv.style.display = 'block';
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('registerUsername').value;
  const password = document.getElementById('registerPassword').value;
  const linkType = document.querySelector('input[name="linkType"]:checked').value;
  const errDiv = document.getElementById('registerError');

  const bodyData = { username, password };
  if (linkType === 'existing') {
    bodyData.playerId = document.getElementById('registerPlayerSelect').value;
    if (!bodyData.playerId) {
      errDiv.innerText = 'Please select a player to link to';
      errDiv.style.display = 'block';
      return;
    }
  } else {
    bodyData.newPlayerName = document.getElementById('registerPlayerName').value;
    if (!bodyData.newPlayerName || !bodyData.newPlayerName.trim()) {
      errDiv.innerText = 'Please enter a name for the new player';
      errDiv.style.display = 'block';
      return;
    }
  }

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('catan_token', data.token);
      document.getElementById('registerModal').classList.remove('active');
      await fetchCurrentUser();
      await updateDashboard();
    } else {
      const err = await res.json();
      errDiv.innerText = err.error || 'Registration failed';
      errDiv.style.display = 'block';
    }
  } catch (err) {
    errDiv.innerText = 'Network error during registration';
    errDiv.style.display = 'block';
  }
}

async function handleLogout() {
  const token = localStorage.getItem('catan_token');
  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {
      console.error('Error invalidating session on server:', e);
    }
  }
  localStorage.removeItem('catan_token');
  currentUser = null;
  renderAuthBar();
  await updateDashboard();
}

async function handleTilePreferenceChange(e) {
  const tilePreference = e.target.value;
  const token = localStorage.getItem('catan_token');
  if (!token) return;

  try {
    const res = await fetch('/api/auth/profile/tile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ tilePreference })
    });

    if (res.ok) {
      const data = await res.json();
      currentUser.user.tilePreference = data.user.tilePreference;
      await updateDashboard();
    } else {
      alert('Failed to update tile preference');
    }
  } catch (err) {
    console.error('Error updating tile preference:', err);
  }
}

async function populateUnlinkedPlayers() {
  const select = document.getElementById('registerPlayerSelect');
  if (!select) return;

  try {
    const res = await fetch('/api/auth/unlinked-players');
    const players = await res.json();

    select.innerHTML = '<option value="">-- Select Player --</option>' +
      players.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  } catch (err) {
    console.error('Error fetching unlinked players:', err);
  }
}

// --- LINEAGE VISUALIZER ---
document.querySelectorAll('#lineageTabs .tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('#lineageTabs .tab-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    renderLineage(e.target.dataset.div);
  });
});

async function renderLineage(division) {
  const container = document.getElementById('lineageContainer');
  const svg = document.getElementById('lineageSvg');
  // Clear nodes, paths, and roads
  container.querySelectorAll('.lineage-node').forEach(n => n.remove());
  container.querySelectorAll('.lineage-road').forEach(r => r.remove());
  svg.querySelectorAll('.lineage-path').forEach(p => p.remove());
  svg.style.display = 'none'; // Hide SVG entirely — we use road PNGs now

  try {
    const res = await fetch(`/api/crowns/timeline/${division}`);
    const data = await res.json();
    const timeline = data.timeline || [];

    if (timeline.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'lineage-node node-main';
      empty.style.top = '100px';
      empty.style.left = '50%';
      empty.innerHTML = `<div class="node-name">No Matches</div>`;
      container.appendChild(empty);
      container.style.height = '300px';
      return;
    }

    let currentY = 60;
    const yStep = 90;
    const leftMainX = '25%';
    const centerMainX = '50%';
    const rightMainX = '75%';
    const interimX = '85%';
    const mainWithInterimX = '15%';

    const nodes = [];
    const connections = [];

    let lastMainNode = null;
    let lastInterimNode = null;
    let snakePos = 0;

    timeline.forEach((match) => {
      const hasInterimState = match.interimUpdated || match.interimHolderAfter;
      const isUnification = match.interimHolderBefore && !match.interimHolderAfter && match.crownChallenged;

      let mainNode = null;
      if (match.crownChallenged || match.crownDefended || isUnification) {
        mainNode = document.createElement('div');
        mainNode.className = 'lineage-node ' + (isUnification ? 'node-unification' : 'node-main');
        mainNode.dataset.id = 'main_' + match.id;

        const dateStr = new Date(match.playedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const hp = match.placements.find(p => p.playerId === match.crownHolderAfter);
        const holderName = hp ? hp.playerName : 'Champ';
        const pieceImg = isUnification ? 'images/metro.png' : 'images/city.png';

        mainNode.innerHTML = `
          <img src="${pieceImg}" alt="${isUnification ? 'Unification' : 'Champion'}" class="piece-img">
          <div class="node-name">${escapeHtml(holderName)}</div>
          <div class="node-date">${dateStr}</div>
        `;

        mainNode.style.top = currentY + 'px';
        if (hasInterimState && !isUnification) {
          mainNode.style.left = mainWithInterimX;
        } else {
          if (snakePos === 0 || snakePos === 2) mainNode.style.left = centerMainX;
          else if (snakePos === 1) mainNode.style.left = rightMainX;
          else if (snakePos === 3) mainNode.style.left = leftMainX;
          snakePos = (snakePos + 1) % 4;
        }

        container.appendChild(mainNode);
        nodes.push({ id: mainNode.dataset.id, el: mainNode });

        if (lastMainNode) {
          connections.push({ from: lastMainNode.dataset.id, to: mainNode.dataset.id });
        }
        lastMainNode = mainNode;
      }

      let interimNode = null;
      if (match.interimUpdated && match.interimHolderAfter) {
        interimNode = document.createElement('div');
        interimNode.className = 'lineage-node node-interim';
        interimNode.dataset.id = 'interim_' + match.id;

        const dateStr = new Date(match.playedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const ip = match.placements.find(p => p.playerId === match.interimHolderAfter);
        const holderName = ip ? ip.playerName : 'Interim';

        interimNode.innerHTML = `
          <img src="images/settlement.png" alt="Interim" class="piece-img">
          <div class="node-name">${escapeHtml(holderName)}</div>
          <div class="node-date">${dateStr}</div>
        `;

        interimNode.style.top = currentY + 'px';
        interimNode.style.left = interimX;

        container.appendChild(interimNode);
        nodes.push({ id: interimNode.dataset.id, el: interimNode });

        if (lastInterimNode) {
          connections.push({ from: lastInterimNode.dataset.id, to: interimNode.dataset.id });
        } else if (lastMainNode && lastMainNode !== mainNode) {
          connections.push({ from: lastMainNode.dataset.id, to: interimNode.dataset.id });
        } else if (mainNode) {
          connections.push({ from: mainNode.dataset.id, to: interimNode.dataset.id });
        }
        lastInterimNode = interimNode;
      }

      if (isUnification && lastInterimNode && mainNode) {
        connections.push({ from: lastInterimNode.dataset.id, to: mainNode.dataset.id });
        lastInterimNode = null;
      }

      currentY += yStep;
    });
    // Size the SVG to match the full scrollable content
    const contentHeight = currentY + 50;
    container.style.height = contentHeight + 'px';
    svg.setAttribute('width', container.scrollWidth);
    svg.setAttribute('height', contentHeight);
    svg.style.height = contentHeight + 'px';

    setTimeout(() => drawArrows(connections, nodes, svg), 100);

  } catch (err) {
    console.error('Failed to load lineage', err);
  }
}

function drawArrows(connections, nodes, svg) {
  const container = document.getElementById('lineageContainer');
  // Remove old roads
  container.querySelectorAll('.lineage-road').forEach(r => r.remove());

  connections.forEach(conn => {
    const fromNode = nodes.find(n => n.id === conn.from);
    const toNode = nodes.find(n => n.id === conn.to);

    if (fromNode && toNode) {
      // Nodes use transform: translate(-50%, -50%) so their center is at (left, top)
      const startX = fromNode.el.offsetLeft;
      const startY = fromNode.el.offsetTop;
      const endX = toNode.el.offsetLeft;
      const endY = toNode.el.offsetTop;

      const dx = endX - startX;
      const dy = endY - startY;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length === 0) return;

      let angle = Math.atan2(dy, dx) * (180 / Math.PI);

      // Keep the road upright so the shadow is always on the bottom
      if (angle > 90) {
        angle -= 180;
      } else if (angle < -90) {
        angle += 180;
      }

      // We want a constant spacing between roads so they don't stretch
      const fixedSpacing = 75;
      // Minimum gap from the center of the nodes to the first/last road
      const minOffset = 65;

      let availablePath = length - (minOffset * 2);
      let roadCount = 1; // Always place at least one road
      if (availablePath >= 0) {
        roadCount = Math.floor(availablePath / fixedSpacing) + 1;
      }
      roadCount = Math.min(5, roadCount); // Cap at 5

      // Calculate how long the chain of roads is, then center it on the line
      const chainLength = (roadCount - 1) * fixedSpacing;
      const startDist = (length - chainLength) / 2;

      for (let i = 0; i < roadCount; i++) {
        const dist = startDist + (i * fixedSpacing);
        const ratio = dist / length;

        const roadX = startX + dx * ratio;
        const roadY = startY + dy * ratio;

        const roadEl = document.createElement('div');
        roadEl.className = 'lineage-road';
        roadEl.innerHTML = `<img src="images/road.png" alt="road">`;
        roadEl.style.left = roadX + 'px';
        roadEl.style.top = roadY + 'px';
        roadEl.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;

        container.appendChild(roadEl);
      }
    }
  });
}
