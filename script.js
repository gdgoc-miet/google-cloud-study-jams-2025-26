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
    // Count participants who are marked as fully complete
    const completedParticipants = participants.filter(p => p.allCompleted);
    const total = completedParticipants.length;
    
    // Log tier progress calculation
    console.log(`Total completed participants: ${total}`);

    // Update tier progress
    const t1Percent = Math.round((total/TIER_THRESHOLDS.tier1) * 100);
    tier1Progress.innerHTML = `
        <div class="flex justify-between items-center mb-2">
            <span class="font-semibold">${total}/${TIER_THRESHOLDS.tier1} Students</span>
            <span class="font-bold">${t1Percent}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-3">
            <div class="bg-[#EA4335] rounded-full h-3 transition-all duration-500" 
                 style="width: ${Math.min(100, t1Percent)}%"></div>
        </div>
    `;

    const t2Percent = Math.round((total/TIER_THRESHOLDS.tier2) * 100);
    tier2Progress.innerHTML = `
        <div class="flex justify-between items-center mb-2">
            <span class="font-semibold">${total}/${TIER_THRESHOLDS.tier2} Students</span>
            <span class="font-bold">${t2Percent}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-3">
            <div class="bg-[#34A853] rounded-full h-3 transition-all duration-500" 
                 style="width: ${Math.min(100, t2Percent)}%"></div>
        </div>
    `;

    const t3Percent = Math.round((total/TIER_THRESHOLDS.tier3) * 100);
    tier3Progress.innerHTML = `
        <div class="flex justify-between items-center mb-2">
            <span class="font-semibold">${total}/${TIER_THRESHOLDS.tier3} Students</span>
            <span class="font-bold">${t3Percent}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-3">
            <div class="bg-[#4285F4] rounded-full h-3 transition-all duration-500" 
                 style="width: ${Math.min(100, t3Percent)}%"></div>
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
            .map((row, index) => {
                const totalBadges = parseInt(row['# of Skill Badges Completed']) || 0;
                const arcadeCount = parseInt(row['# of Arcade Games Completed']) || 0;
                const userName = (row['User Name'] || '').trim();
                const accessStatus = (row['Access Code Redemption Status'] || '').trim();
                const csvCompletionStatus = (row['All Skill Badges & Games Completed'] || '').trim().toLowerCase() === 'yes';
                
                // Log completion details for debugging
                if (csvCompletionStatus) {
                    console.log(`✅ Complete participant: ${userName}, Badges: ${totalBadges}, Arcade: ${arcadeCount}`);
                }

                return {
                    originalIndex: index,
                    name: userName,
                    accessStatus: accessStatus,
                    totalBadges: totalBadges,
                    badgeNames: (row['Names of Completed Skill Badges'] || '').split('|').filter(Boolean),
                    arcadeCount: arcadeCount,
                    arcadeNames: (row['Names of Completed Arcade Games'] || '').split('|').filter(Boolean),
                    // Use CSV's completion status (trusted source)
                    allCompleted: csvCompletionStatus
                };
            })
            .filter(p => p.name); // Remove empty rows

        // Sort by total progress (badges + arcade), then by original order for ties
        participants.sort((a, b) => {
            const aTotal = a.totalBadges + a.arcadeCount;
            const bTotal = b.totalBadges + b.arcadeCount;
            if (bTotal === aTotal) {
                return a.originalIndex - b.originalIndex;
            }
            return bTotal - aTotal;
        });

        // Assign ranks based on sorted order
        participants.forEach((p, index) => {
            p.rank = index + 1;
        });

        renderLeaderboard();
        updateTierProgress();
        updateFilterStats();
        loadingEl.style.display = 'none';
    } catch (error) {
        console.error('Error loading data:', error);
        loadingEl.innerHTML = `<p class="text-red-600">Error loading leaderboard data: ${error.message}</p>
            <p class="text-sm text-gray-600 mt-2">Please check your network connection and try refreshing the page.</p>`;
    }
}

function updateFilterStats() {
    const totalParticipants = participants.length;
    const notRedeemed = participants.filter(p => p.accessStatus.toLowerCase() !== 'yes').length;
    const redeemed = participants.filter(p => p.accessStatus.toLowerCase() === 'yes').length;
    const completed19Badges = participants.filter(p => p.totalBadges === 19).length;
    const completedArcade = participants.filter(p => p.arcadeCount >= 1).length;
    const completedBoth = participants.filter(p => p.allCompleted).length;
    // In progress means they have started but not completed everything
    const inProgress = participants.filter(p => 
        (p.totalBadges > 0 || p.arcadeCount > 0) && 
        !p.allCompleted
    ).length;

    document.getElementById('filterStats').innerHTML = `
        <div class="flex flex-wrap gap-4 text-sm">
            <span>Total Participants: <b>${totalParticipants}</b></span>
            <span>Redeemed: <b class="text-[#34A853]">${redeemed}</b></span>
            <span>Completed 19 Badges: <b class="text-[#4285F4]">${completed19Badges}</b></span>
            <span>Completed Arcade: <b class="text-[#FBBC04]">${completedArcade}</b></span>
            <span>Completed Both (19+1): <b class="text-[#34A853]">${completedBoth}</b></span>
        </div>
    `;
}

function renderLeaderboard(filteredParticipants = participants) {
    updateFilterStats();
    
    // Show filtered count if filtering is active
    const isFiltered = filteredParticipants.length < participants.length;
    if (isFiltered) {
        const filterCountEl = document.getElementById('filterStats');
        const currentStats = filterCountEl.innerHTML;
        filterCountEl.innerHTML = `
            <div class="flex flex-wrap gap-4 text-sm items-center">
                <span class="text-[#4285F4] font-semibold">Showing ${filteredParticipants.length} of ${participants.length} participants</span>
                <span class="text-gray-400">|</span>
                ${currentStats.replace('<div class="flex flex-wrap gap-4 text-sm">', '').replace('</div>', '')}
            </div>
        `;
    }
    
    leaderboardEl.innerHTML = filteredParticipants
        .map((participant) => `
            <div class="bg-white rounded-lg shadow-md px-6 py-4 hover:shadow-lg transition-shadow mb-3">
                <div class="flex items-stretch gap-4">
                    <div class="flex-1">
                    <!-- Content moved to start -->
                        <div class="flex flex-wrap items-start justify-between gap-4">
                            <div class="flex items-center gap-4">
                                <span class="text-2xl font-bold text-gray-500">#${participant.rank}</span>
                                <h2 class="text-xl font-semibold ${participant.accessStatus.toLowerCase() === 'yes' ? 'text-gray-900' : 'text-[#EA4335]'}">${participant.name}</h2>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-sm text-gray-600">Access Code:</span>
                                <span class="font-medium ${participant.accessStatus.toLowerCase() === 'yes' ? 'text-[#34A853]' : 'text-[#EA4335]'}">
                                    ${participant.accessStatus.toLowerCase() === 'yes' ? 'Redeemed ✅' : 'Not Redeemed ❌'}
                                </span>
                            </div>
                        </div>

                        <div class="mt-4 grid sm:grid-cols-2 gap-4">
                            <div>
                                <div class="flex items-center gap-2 mb-2">
                                    <span class="text-gray-600">Skill Badges:</span>
                                    <span class="font-semibold text-[#4285F4]">${participant.totalBadges}/19</span>
                                </div>
                                ${participant.badgeNames.length > 0 ? `
                                    <details class="cursor-pointer">
                                        <summary class="text-[#4285F4] hover:text-blue-700">View Skill Badge List ▼</summary>
                                        <ul class="mt-2 ml-4 text-sm text-gray-600 list-disc">
                                            ${participant.badgeNames.map(badge => `<li>${badge}</li>`).join('')}
                                        </ul>
                                    </details>
                                ` : ''}
                            </div>

                            <div>
                                <div class="flex items-center gap-2 mb-2">
                                    <span class="text-gray-600">Arcade Games:</span>
                                    <span class="font-semibold text-[#FBBC04]">${participant.arcadeCount}/1</span>
                                </div>
                                ${participant.arcadeNames.length > 0 ? `
                                    <details class="cursor-pointer">
                                        <summary class="text-[#4285F4] hover:text-blue-700">View Arcade Game List ▼</summary>
                                        <ul class="mt-2 ml-4 text-sm text-gray-600 list-disc">
                                            ${participant.arcadeNames.map(game => `<li>${game}</li>`).join('')}
                                        </ul>
                                    </details>
                                ` : ''}
                            </div>
                        </div>

                        <div class="mt-4 text-sm">
                            <span class="text-gray-600">Completion Status:</span>
                            <span class="ml-2 font-medium ${participant.allCompleted ? 'text-[#34A853]' : 'text-[#FBBC04]'}" 
                                  title="Required: 19 Skill Badges and 1 Arcade Game">
                                ${participant.allCompleted ? 
                                    'Completed ✅' : 
                                    `In Progress ⌛ (${participant.totalBadges + participant.arcadeCount}/20)`
                                }
                            </span>
                        </div>
                    </div>

                    <!-- Right: Progress Bar -->
                    <div class="flex-shrink-0 self-stretch flex items-stretch">
                        <div class="w-4 border-2 border-[#EA4335] bg-gray-100 rounded-full relative my-1">
                            <div class="absolute bottom-0 left-0 right-0 bg-[#34A853] rounded-full transition-all" 
                                 style="height: ${((participant.totalBadges + participant.arcadeCount) / 20) * 100}%;"
                                 title="${participant.totalBadges + participant.arcadeCount}/20 items completed">
                            </div>
                        </div>
                    </div>
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
            filtered = filtered.filter(p => (p.totalBadges > 0 || p.arcadeCount > 0) && !p.allCompleted);
            break;
        case 'notStarted':
            filtered = filtered.filter(p => p.totalBadges === 0 && p.arcadeCount === 0);
            break;
        case 'notRedeemed':
            filtered = filtered.filter(p => p.accessStatus.toLowerCase() !== 'yes');
            break;
        case 'redeemedNotStarted':
            filtered = filtered.filter(p => p.accessStatus.toLowerCase() === 'yes' && p.totalBadges === 0 && p.arcadeCount === 0);
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
