import { auth, db } from '../firebase/config.js';
import { collection, getDocs, query, where, orderBy, limit, getDoc, doc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// DOM Elements
const subjectTabs = document.getElementById('subjectTabs');
const testsContainer = document.getElementById('testsContainer');
const leaderboardContainer = document.getElementById('leaderboardContainer');
const statsBar = document.getElementById('statsBar');
const refreshBtn = document.getElementById('refreshBtn');

// Subject icons mapping
const subjectIcons = {
    'Python': 'fab fa-python',
    'Unix_&_Shell_programming': 'fas fa-terminal',
    'Accounting_&_Financial_Management': 'fas fa-calculator',
    'Cyber-Security': 'fas fa-shield-alt',
    'Computer_Networks': 'fas fa-network-wired'
};

// State
let currentSubject = 'Python';
let currentTest = null;
let currentView = 'all-time';
let allLeaderboardData = [];
let filteredData = [];
let currentPage = 1;
const entriesPerPage = 20;

// Initialize
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = '../login/login.html';
    } else {
        await loadSubjectTests(currentSubject);
        setupEventListeners();
    }
});

// Load tests for a subject
async function loadSubjectTests(subject) {
    try {
        showTestsLoading();
        updateStatsBar(subject);
        
        // Get all tests for this subject
        const testsRef = collection(db, subject);
        const querySnapshot = await getDocs(testsRef);
        
        if (querySnapshot.empty) {
            showNoTests(subject);
            return;
        }
        
        const tests = [];
        querySnapshot.forEach((doc) => {
            tests.push({
                id: doc.id,
                name: formatTestName(doc.id),
                data: doc.data()
            });
        });
        
        // Sort tests by name
        tests.sort((a, b) => a.name.localeCompare(b.name));
        
        displayTests(tests);
        hideLeaderboard();
        
    } catch (error) {
        console.error('Error loading tests:', error);
        showTestsError('Failed to load tests. Please try again.');
    }
}

// Display tests in grid
function displayTests(tests) {
    const subjectDisplay = formatSubjectName(currentSubject);
    
    let testsHTML = `
        <h2 style="margin-bottom: 20px; color: var(--text-primary); font-size: 22px; display: flex; align-items: center; gap: 10px;">
            <i class="${subjectIcons[currentSubject] || 'fas fa-book'}"></i>
            ${subjectDisplay} - Available Tests
        </h2>
        <div class="tests-grid">
    `;
    

     const reversedTests = [...tests].reverse();
    reversedTests.forEach((test, index) => {
        // Get question count
        const questionCount = getQuestionCount(test.data);
        
        testsHTML += `
            <div class="test-card ${currentTest?.id === test.id ? 'selected' : ''}" 
                 data-test-id="${test.id}"
                 style="animation-delay: ${index * 0.05}s;">
                <div class="test-header">
                    <div>
                        <div class="test-name">${test.name}</div>
                        <div class="test-id">ID: ${test.id}</div>
                    </div>
                </div>
                
                <div class="test-stats">
                    <div class="stat-item">
                        <i class="fas fa-question-circle"></i>
                        <span>${questionCount} Questions</span>
                    </div>
                </div>
                
                <button class="test-action view-leaderboard-btn" data-test-id="${test.id}">
                    <i class="fas fa-chart-bar"></i>
                    View Leaderboard
                </button>
            </div>
        `;
    });
    
    testsHTML += '</div>';
    testsContainer.innerHTML = testsHTML;
    
    // Add click handlers
    document.querySelectorAll('.view-leaderboard-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const testId = btn.dataset.testId;
            loadLeaderboard(testId);
        });
    });
    
    document.querySelectorAll('.test-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('view-leaderboard-btn')) {
                const testId = card.dataset.testId;
                loadLeaderboard(testId);
            }
        });
    });
}

// Load leaderboard for a test
async function loadLeaderboard(testId) {
    try {
        showLeaderboardLoading();
        
        // Update selected test
        document.querySelectorAll('.test-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.querySelector(`.test-card[data-test-id="${testId}"]`)?.classList.add('selected');
        
        currentTest = {
            subject: currentSubject,
            id: testId,
            name: formatTestName(testId)
        };
        
        // Load leaderboard data
        await fetchLeaderboardData(testId);
        
        // Update UI
        updateLeaderboardTitle();
        showLeaderboard();
        
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        showToast('Failed to load leaderboard data', 'error');
    }
}

// Fetch leaderboard data from Firestore
async function fetchLeaderboardData(testId) {
    try {
        // Query test results for this subject and test
        const testResultsRef = collection(db, 'testResults');
        const q = query(
            testResultsRef,
            where('subject', '==', currentSubject),
            where('testId', '==', testId)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            showEmptyLeaderboard();
            return;
        }
        
        // Process results
        const results = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            results.push({
                id: doc.id,
                userName: data.userName || 'Anonymous',
                score: data.score || 0,
                timeSpent: data.timeSpent || 0,
                timestamp: data.timestamp?.seconds ? new Date(data.timestamp.seconds * 1000) : new Date(),
                userId: data.userId
            });
        });
        
        // Process and rank results
        processLeaderboardData(results);
        
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        throw error;
    }
}

// Process and rank leaderboard data
function processLeaderboardData(results) {
    // Group by user, keep best score per user
    const userBestScores = {};
    
    results.forEach(result => {
        const userId = result.userId;
        
        if (!userBestScores[userId]) {
            userBestScores[userId] = result;
        } else {
            // Compare and keep best score
            const currentBest = userBestScores[userId];
            
            // First compare scores
            if (result.score > currentBest.score) {
                userBestScores[userId] = result;
            } 
            // If scores are equal, compare time (lower is better)
            else if (Math.abs(result.score - currentBest.score) < 0.01) {
                if (result.timeSpent < currentBest.timeSpent) {
                    userBestScores[userId] = result;
                }
                // If time is equal, keep the earlier attempt
                else if (result.timeSpent === currentBest.timeSpent) {
                    if (result.timestamp < currentBest.timestamp) {
                        userBestScores[userId] = result;
                    }
                }
            }
        }
    });
    
    // Convert to array and sort
    let leaderboardArray = Object.values(userBestScores);
    
    // Sort by score (descending), then time (ascending), then date (ascending)
    leaderboardArray.sort((a, b) => {
        // Compare scores (higher is better)
        if (Math.abs(b.score - a.score) > 0.01) {
            return b.score - a.score;
        }
        
        // If scores are equal (within 0.01), compare time (lower is better)
        if (a.timeSpent !== b.timeSpent) {
            return a.timeSpent - b.timeSpent;
        }
        
        // If time is equal, compare date (earlier is better)
        return a.timestamp - b.timestamp;
    });
    
    // Apply time filter based on current view
    const now = new Date();
    let startDate = null;
    
    switch (currentView) {
        case 'weekly':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
            break;
        case 'monthly':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            break;
    }
    
    if (startDate) {
        leaderboardArray = leaderboardArray.filter(entry => 
            entry.timestamp >= startDate
        );
    }
    
    allLeaderboardData = leaderboardArray;
    filteredData = [...allLeaderboardData];
    
    // Update statistics
    updateLeaderboardStats();
    
    // Display leaderboard
    renderLeaderboard();
}

// Display leaderboard
function renderLeaderboard() {
    if (filteredData.length === 0) {
        showEmptyLeaderboard();
        return;
    }
    
    // Calculate pagination
    const startIndex = (currentPage - 1) * entriesPerPage;
    const endIndex = startIndex + entriesPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);
    
    const currentUser = auth.currentUser;
    
    // Desktop table view
    let tableHTML = '';
    let cardsHTML = '';
    
    pageData.forEach((entry, index) => {
        const globalIndex = startIndex + index;
        const rank = globalIndex + 1;
        const isCurrentUser = currentUser && entry.userId === currentUser.uid;
        
        // Format score with 2 decimal places
        const formattedScore = entry.score.toFixed(2);
        
        // Format time
        const formattedTime = formatTime(entry.timeSpent);
        
        // Format date
        const formattedDate = formatDate(entry.timestamp);
        
        // Determine rank class and medal
        let rankClass = '';
        let rankMedal = '';
        
        if (rank === 1) {
            rankClass = 'rank-1';
            rankMedal = '🥇';
        } else if (rank === 2) {
            rankClass = 'rank-2';
            rankMedal = '🥈';
        } else if (rank === 3) {
            rankClass = 'rank-3';
            rankMedal = '🥉';
        }
        
        // Determine score class
        let scoreClass = 'score-medium';
        if (entry.score >= 80) scoreClass = 'score-high';
        else if (entry.score < 50) scoreClass = 'score-low';
        
        // Table row
        tableHTML += `
            <tr class="${isCurrentUser ? 'current-user' : ''}">
                <td class="rank-cell ${rankClass}">
                    <span class="rank-medal">${rankMedal}</span>
                    ${rank}
                </td>
                <td class="name-cell">${entry.userName}</td>
                <td class="score-cell ${scoreClass}">${formattedScore}%</td>
                <td class="time-cell">${formattedTime}</td>
                <td class="date-cell">${formattedDate}</td>
            </tr>
        `;
        
        // Mobile card
        cardsHTML += `
            <div class="leaderboard-card ${isCurrentUser ? 'current-user' : ''}">
                <div class="card-header">
                    <div class="card-rank ${rankClass}">
                        <span class="rank-medal">${rankMedal}</span>
                        #${rank}
                    </div>
                    <div class="card-name">${entry.userName}</div>
                </div>
                <div class="card-stats">
                    <div class="card-stat">
                        <div class="card-label">Score</div>
                        <div class="card-value ${scoreClass}">${formattedScore}%</div>
                    </div>
                    <div class="card-stat">
                        <div class="card-label">Time</div>
                        <div class="card-value">${formattedTime}</div>
                    </div>
                    <div class="card-stat">
                        <div class="card-label">Date</div>
                        <div class="card-value">${formatDateShort(entry.timestamp)}</div>
                    </div>
                    <div class="card-stat">
                        <div class="card-label">Rank</div>
                        <div class="card-value">Top ${Math.round((rank / filteredData.length) * 100)}%</div>
                    </div>
                </div>
            </div>
        `;
    });
    
    document.getElementById('leaderboardBody').innerHTML = tableHTML;
    document.getElementById('leaderboardCards').innerHTML = cardsHTML;
    
    // Update pagination
    updatePagination();
    
    // Show pagination if needed
    const pagination = document.getElementById('pagination');
    pagination.style.display = filteredData.length > entriesPerPage ? 'flex' : 'none';
}

// Update leaderboard statistics
function updateLeaderboardStats() {
    if (filteredData.length === 0) {
        updateStatsBar(currentSubject);
        return;
    }
    
    // Calculate statistics
    const totalParticipants = filteredData.length;
    const currentUser = auth.currentUser;
    
    // Find current user's rank
    let userRank = null;
    let userScore = null;
    
    if (currentUser) {
        const userEntry = filteredData.find(entry => entry.userId === currentUser.uid);
        if (userEntry) {
            userRank = filteredData.findIndex(entry => entry.userId === currentUser.uid) + 1;
            userScore = userEntry.score.toFixed(2);
        }
    }
    
    // Calculate averages
    const avgScore = filteredData.reduce((sum, entry) => sum + entry.score, 0) / totalParticipants;
    const avgTime = filteredData.reduce((sum, entry) => sum + entry.timeSpent, 0) / totalParticipants;
    const topScore = filteredData[0]?.score || 0;
    
    // Update stats bar
    const statsHTML = `
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-users"></i>
            </div>
            <div class="stat-value">${totalParticipants}</div>
            <div class="stat-label">Participants</div>
        </div>
        
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-chart-line"></i>
            </div>
            <div class="stat-value">${avgScore.toFixed(2)}%</div>
            <div class="stat-label">Avg Score</div>
        </div>
        
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-trophy"></i>
            </div>
            <div class="stat-value">${topScore.toFixed(2)}%</div>
            <div class="stat-label">Top Score</div>
        </div>
        
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-medal"></i>
            </div>
            <div class="stat-value">${userRank ? `#${userRank}` : 'N/A'}</div>
            <div class="stat-label">Your Rank</div>
        </div>
    `;
    
    statsBar.innerHTML = statsHTML;
}

// Update leaderboard title
function updateLeaderboardTitle() {
    const title = document.getElementById('leaderboardTitle');
    const subtitle = document.getElementById('leaderboardSubtitle');
    
    if (currentTest) {
        title.textContent = `${formatTestName(currentTest.id)} - Leaderboard`;
        subtitle.textContent = `${formatSubjectName(currentSubject)} • ${currentView.replace('-', ' ').toUpperCase()}`;
    }
}

// Update pagination
function updatePagination() {
    const totalPages = Math.ceil(filteredData.length / entriesPerPage);
    
    // Update page info
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
    
    // Update button states
    document.getElementById('firstPage').disabled = currentPage === 1;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
    document.getElementById('lastPage').disabled = currentPage === totalPages;
}

// Setup event listeners
function setupEventListeners() {
    // Subject tabs
    subjectTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.subject-tab');
        if (tab) {
            const subject = tab.dataset.subject;
            switchSubject(subject);
        }
    });
    
    // View controls
    document.querySelectorAll('.view-btn[data-view]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const view = e.target.closest('.view-btn').dataset.view;
            switchView(view);
        });
    });
    
    // Search input
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', debounce(() => {
        filterLeaderboard(searchInput.value);
    }, 300));
    
    // Export button
    document.getElementById('exportBtn').addEventListener('click', exportLeaderboard);
    
    // Refresh button
    refreshBtn.addEventListener('click', async () => {
        if (currentTest) {
            await loadLeaderboard(currentTest.id);
        } else {
            await loadSubjectTests(currentSubject);
        }
        showToast('Data refreshed successfully', 'success');
    });
    
    // Pagination
    document.getElementById('firstPage').addEventListener('click', () => {
        currentPage = 1;
        renderLeaderboard();
        scrollToLeaderboard();
    });
    
    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderLeaderboard();
            scrollToLeaderboard();
        }
    });
    
    document.getElementById('nextPage').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredData.length / entriesPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderLeaderboard();
            scrollToLeaderboard();
        }
    });
    
    document.getElementById('lastPage').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredData.length / entriesPerPage);
        currentPage = totalPages;
        renderLeaderboard();
        scrollToLeaderboard();
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl + F to focus search
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            searchInput.focus();
        }
        
        // Escape to clear search
        if (e.key === 'Escape') {
            searchInput.value = '';
            filterLeaderboard('');
        }
    });
}

// Switch subject
async function switchSubject(subject) {
    if (subject === currentSubject) return;
    
    // Update UI
    document.querySelectorAll('.subject-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`.subject-tab[data-subject="${subject}"]`).classList.add('active');
    
    // Update state
    currentSubject = subject;
    currentTest = null;
    currentPage = 1;
    
    // Load new subject's tests
    await loadSubjectTests(subject);
    
    showToast(`Switched to ${formatSubjectName(subject)}`, 'info');
}

// Switch view (all-time, weekly, monthly)
function switchView(view) {
    if (view === currentView) return;
    
    // Update UI
    document.querySelectorAll('.view-btn[data-view]').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.view-btn[data-view="${view}"]`).classList.add('active');
    
    // Update state
    currentView = view;
    currentPage = 1;
    
    // Re-process data with new filter
    if (allLeaderboardData.length > 0) {
        processLeaderboardData(allLeaderboardData);
    }
    
    showToast(`Showing ${view.replace('-', ' ')} results`, 'info');
}

// Filter leaderboard by search term
function filterLeaderboard(searchTerm) {
    if (!searchTerm.trim()) {
        filteredData = [...allLeaderboardData];
    } else {
        const term = searchTerm.toLowerCase().trim();
        filteredData = allLeaderboardData.filter(entry => 
            entry.userName.toLowerCase().includes(term)
        );
    }
    
    currentPage = 1;
    renderLeaderboard();
}

// Export leaderboard data
function exportLeaderboard() {
    if (filteredData.length === 0) {
        showToast('No data to export', 'warning');
        return;
    }
    
    try {
        // Prepare CSV content
        const subjectDisplay = formatSubjectName(currentSubject);
        const testDisplay = currentTest ? formatTestName(currentTest.id) : 'All Tests';
        const viewDisplay = currentView.replace('-', ' ').toUpperCase();
        
        let csvContent = "data:text/csv;charset=utf-8,";
        
        // Add headers
        csvContent += "Subject,Test,View,Rank,User Name,Score (%),Time Spent (minutes),Date\n";
        
        // Add data rows
        filteredData.forEach((entry, index) => {
            const row = [
                `"${subjectDisplay}"`,
                `"${testDisplay}"`,
                `"${viewDisplay}"`,
                `"${index + 1}"`,
                `"${entry.userName}"`,
                `"${entry.score.toFixed(2)}"`,
                `"${entry.timeSpent}"`,
                `"${entry.timestamp.toISOString().split('T')[0]}"`
            ].join(',');
            
            csvContent += row + "\n";
        });
        
        // Create download link
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `dotest-leaderboard-${currentSubject}-${currentTest?.id || 'all'}-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        
        // Trigger download
        link.click();
        document.body.removeChild(link);
        
        showToast('Leaderboard exported successfully!', 'success');
        
    } catch (error) {
        console.error('Error exporting leaderboard:', error);
        showToast('Error exporting data', 'error');
    }
}

// Helper functions
function formatSubjectName(subject) {
    return subject
        .replace(/_/g, ' ')
        .replace(/&/g, ' & ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

function formatTestName(testName) {
    return testName
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .replace(/(?:^|\s)\S/g, a => a.toUpperCase());
}

function getQuestionCount(testData) {
    if (!testData || !testData.exam) return '?';
    
    try {
        const exam = typeof testData.exam === 'string' ? JSON.parse(testData.exam) : testData.exam;
        return Object.keys(exam).length;
    } catch (e) {
        return '?';
    }
}

function formatTime(minutes) {
    if (!minutes || minutes === 0) return '0m';
    
    const hrs = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const secs = Math.round((minutes % 1) * 60);
    
    if (hrs > 0) {
        return `${hrs}h ${mins}m`;
    } else if (mins > 0) {
        return `${mins}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

function formatDate(date) {
    if (!date) return 'N/A';
    
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return 'Today';
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }
}

function formatDateShort(date) {
    if (!date) return 'N/A';
    
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function scrollToLeaderboard() {
    leaderboardContainer.scrollIntoView({ behavior: 'smooth' });
}

// UI State Management
function showTestsLoading() {
    testsContainer.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading tests for ${formatSubjectName(currentSubject)}...</div>
        </div>
    `;
}

function showTestsError(message) {
    testsContainer.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error Loading Tests</h3>
            <p>${message}</p>
            <button onclick="location.reload()" style="margin-top: 20px; padding: 12px 24px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer;">
                <i class="fas fa-redo"></i> Reload Page
            </button>
        </div>
    `;
}

function showNoTests(subject) {
    testsContainer.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-folder-open"></i>
            <h3>No Tests Available</h3>
            <p>There are no tests available for ${formatSubjectName(subject)} yet.</p>
            <a href="../index.html" style="margin-top: 20px; padding: 12px 24px; background: var(--primary); color: white; text-decoration: none; border-radius: 8px; display: inline-block;">
                <i class="fas fa-plus"></i> Create New Test
            </a>
        </div>
    `;
}

function showLeaderboardLoading() {
    const leaderboardBody = document.getElementById('leaderboardBody');
    const leaderboardCards = document.getElementById('leaderboardCards');
    
    leaderboardBody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align: center; padding: 60px 20px;">
                <div class="loading-spinner" style="margin: 0 auto 20px;"></div>
                <div class="loading-text">Loading leaderboard data...</div>
            </td>
        </tr>
    `;
    
    leaderboardCards.innerHTML = `
        <div class="loading-container" style="padding: 40px 20px;">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading leaderboard data...</div>
        </div>
    `;
}

function showEmptyLeaderboard() {
    const leaderboardBody = document.getElementById('leaderboardBody');
    const leaderboardCards = document.getElementById('leaderboardCards');
    
    leaderboardBody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align: center; padding: 60px 20px;">
                <div class="empty-state" style="padding: 0;">
                    <i class="fas fa-chart-bar"></i>
                    <h3>No Leaderboard Data</h3>
                    <p>No one has taken this test yet. Be the first!</p>
                </div>
            </td>
        </tr>
    `;
    
    leaderboardCards.innerHTML = `
        <div class="empty-state" style="padding: 40px 20px;">
            <i class="fas fa-chart-bar"></i>
            <h3>No Leaderboard Data</h3>
            <p>No one has taken this test yet. Be the first!</p>
        </div>
    `;
    
    document.getElementById('pagination').style.display = 'none';
}

function showLeaderboard() {
    leaderboardContainer.classList.add('show');
}

function hideLeaderboard() {
    leaderboardContainer.classList.remove('show');
}

function updateStatsBar(subject) {
    statsBar.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon">
                <i class="${subjectIcons[subject] || 'fas fa-book'}"></i>
            </div>
            <div class="stat-value">${formatSubjectName(subject)}</div>
            <div class="stat-label">Selected Subject</div>
        </div>
        
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-trophy"></i>
            </div>
            <div class="stat-value">--</div>
            <div class="stat-label">Your Best Score</div>
        </div>
        
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-chart-line"></i>
            </div>
            <div class="stat-value">--</div>
            <div class="stat-label">Average Score</div>
        </div>
        
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-medal"></i>
            </div>
            <div class="stat-value">--</div>
            <div class="stat-label">Your Rank</div>
        </div>
    `;
}

function showToast(message, type = 'info') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Set icon
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    if (type === 'error') icon = 'times-circle';
    
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    // Add to document
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}   