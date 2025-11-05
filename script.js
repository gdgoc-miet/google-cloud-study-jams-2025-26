// Constants
const CSV_PATH = 'data.csv';
const POLL_INTERVAL = 60000; // Check for updates every minute
const TIER_THRESHOLDS = {
    tier1: 100, // 100 students needed
    tier2: 70,  // 70 students needed
    tier3: 50   // 50 students needed
};

// State
let participants = [];
let lastModified = null;

// DOM Elements
const leaderboardEl = document.getElementById('leaderboard');
const searchInput = document.getElementById('searchInput');
const filterType = document.getElementById('filterType');
const loadingEl = document.getElementById('loading');
const lastUpdatedEl = document.getElementById('lastUpdated');
const tier1Progress = document.getElementById('tier1-progress');
const tier2Progress = document.getElementById('tier2-progress');
const tier3Progress = document.getElementById('tier3-progress');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    await loadData();
    searchInput.addEventListener('input', handleFilters);
    filterType.addEventListener('change', handleFilters);
    // Start polling for updates
    setInterval(checkForUpdates, POLL_INTERVAL);
}

function updateTierProgress() {
    const completedParticipants = participants.filter(p => p.allCompleted);
    const total = completedParticipants.length;

    // Update tier progress
    tier1Progress.innerHTML = `
        <div class="flex justify-between items-center">
            <span>${total}/${TIER_THRESHOLDS.tier1} Students</span>
            <span class="font-bold">${Math.round((total/TIER_THRESHOLDS.tier1) * 100)}%</span>
        </div>
        <div class="w-full bg-white/30 rounded-full h-2 mt-2">
            <div class="bg-white rounded-full h-2" style="width: ${Math.min(100, (total/TIER_THRESHOLDS.tier1) * 100)}%"></div>
        </div>
    `;

    tier2Progress.innerHTML = `
        <div class="flex justify-between items-center">
            <span>${total}/${TIER_THRESHOLDS.tier2} Students</span>
            <span class="font-bold">${Math.round((total/TIER_THRESHOLDS.tier2) * 100)}%</span>
        </div>
        <div class="w-full bg-white/30 rounded-full h-2 mt-2">
            <div class="bg-white rounded-full h-2" style="width: ${Math.min(100, (total/TIER_THRESHOLDS.tier2) * 100)}%"></div>
        </div>
    `;

    tier3Progress.innerHTML = `
        <div class="flex justify-between items-center">
            <span>${total}/${TIER_THRESHOLDS.tier3} Students</span>
            <span class="font-bold">${Math.round((total/TIER_THRESHOLDS.tier3) * 100)}%</span>
        </div>
        <div class="w-full bg-white/30 rounded-full h-2 mt-2">
            <div class="bg-white rounded-full h-2" style="width: ${Math.min(100, (total/TIER_THRESHOLDS.tier3) * 100)}%"></div>
        </div>
    `;
}

async function loadData() {
    try {
        const response = await fetch(CSV_PATH);
        const csvText = await response.text();
        
        // Update last modified time
        const headerDate = response.headers.get('last-modified');
        if (headerDate) {
            lastModified = new Date(headerDate);
            updateLastModified();
        }

        // Parse CSV
        const results = Papa.parse(csvText, { 
            header: true,
            skipEmptyLines: true,
            error: (error) => {
                throw new Error(`CSV parsing failed: ${error.message}`);
            }
        });
        
        if (results.errors.length > 0) {
            throw new Error(`CSV parsing had errors: ${results.errors[0].message}`);
        }
        
        // Transform data
        participants = results.data
            .map((row, index) => ({
                originalIndex: index,
                name: row['User Name'],
                accessStatus: row['Access Code Redemption Status'],
                totalBadges: parseInt(row['# of Skill Badges Completed']) || 0,
                badgeNames: row['Names of Completed Skill Badges'].split('|').filter(Boolean),
                allCompleted: row['All Skill Badges & Games Completed'] === 'Yes',
                arcadeCount: parseInt(row['# of Arcade Games Completed']) || 0,
                arcadeNames: row['Names of Completed Arcade Games'].split('|').filter(Boolean)
            }))
            .filter(p => p.name); // Remove empty rows

        // Sort by total badges (descending) and preserve order for ties
        participants.sort((a, b) => {
            if (b.totalBadges === a.totalBadges) {
                return a.originalIndex - b.originalIndex;
            }
            return b.totalBadges - a.totalBadges;
        });

        renderLeaderboard();
        updateTierProgress();
        loadingEl.style.display = 'none';
    } catch (error) {
        console.error('Error loading data:', error);
        loadingEl.innerHTML = `<p class="text-red-600">Error loading leaderboard data: ${error.message}</p>
            <p class="text-sm text-gray-600 mt-2">Please check your network connection and try refreshing the page.</p>`;
    }
}

function renderLeaderboard(filteredParticipants = participants) {
    leaderboardEl.innerHTML = filteredParticipants
        .map((participant, index) => `
            <div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div class="flex flex-wrap items-start justify-between gap-4">
                    <div class="flex items-center gap-4">
                        <span class="text-2xl font-bold text-gray-500">#${index + 1}</span>
                        <h2 class="text-xl font-semibold text-gray-900">${participant.name}</h2>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-sm text-gray-600">Access Code:</span>
                        <span class="font-medium ${participant.accessStatus === 'Yes' ? 'text-green-600' : 'text-red-600'}">
                            ${participant.accessStatus === 'Yes' ? 'Redeemed ✅' : 'Not Redeemed ❌'}
                        </span>
                    </div>
                </div>

                <div class="mt-4 grid sm:grid-cols-2 gap-4">
                    <div>
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-gray-600">Skill Badges:</span>
                            <span class="font-semibold">${participant.totalBadges}</span>
                        </div>
                        ${participant.badgeNames.length > 0 ? `
                            <details class="cursor-pointer">
                                <summary class="text-blue-600 hover:text-blue-700">View Skill Badge List ▼</summary>
                                <ul class="mt-2 ml-4 text-sm text-gray-600 list-disc">
                                    ${participant.badgeNames.map(badge => `<li>${badge}</li>`).join('')}
                                </ul>
                            </details>
                        ` : ''}
                    </div>

                    <div>
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-gray-600">Arcade Games:</span>
                            <span class="font-semibold">${participant.arcadeCount}</span>
                        </div>
                        ${participant.arcadeNames.length > 0 ? `
                            <details class="cursor-pointer">
                                <summary class="text-blue-600 hover:text-blue-700">View Arcade Game List ▼</summary>
                                <ul class="mt-2 ml-4 text-sm text-gray-600 list-disc">
                                    ${participant.arcadeNames.map(game => `<li>${game}</li>`).join('')}
                                </ul>
                            </details>
                        ` : ''}
                    </div>
                </div>

                <div class="mt-4 text-sm">
                    <span class="text-gray-600">All Skill Badges & Games Completed:</span>
                    <span class="ml-2 font-medium ${participant.allCompleted ? 'text-green-600' : 'text-yellow-600'}">
                        ${participant.allCompleted ? 'Yes ✅' : 'No ⏳'}
                    </span>
                </div>
            </div>
        `)
        .join('');
}

function handleFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    const filterValue = filterType.value;
    
    let filtered = participants.filter(p => 
        p.name.toLowerCase().includes(searchTerm)
    );
    
    // Apply status filter
    switch(filterValue) {
        case 'completed':
            filtered = filtered.filter(p => p.allCompleted);
            break;
        case 'inProgress':
            filtered = filtered.filter(p => p.totalBadges > 0 && !p.allCompleted);
            break;
        case 'notStarted':
            filtered = filtered.filter(p => p.totalBadges === 0);
            break;
    }
    
    renderLeaderboard(filtered);
}

async function checkForUpdates() {
    try {
        const response = await fetch(CSV_PATH, { method: 'HEAD' });
        const newLastModified = response.headers.get('last-modified');
        
        if (newLastModified && new Date(newLastModified) > lastModified) {
            await loadData(); // Reload if file has changed
        }
    } catch (error) {
        console.error('Error checking for updates:', error);
    }
}

function updateLastModified() {
    if (lastModified) {
        lastUpdatedEl.textContent = `Last updated: ${lastModified.toLocaleString()}`;
    }
}
