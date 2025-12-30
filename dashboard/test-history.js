
import { auth, db, signOut } from '../firebase/config.js';
import { collection, query, where, getDocs, orderBy, limit, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// DOM Elements
const testHistoryContainer = document.getElementById('testHistoryContainer');
const statsBar = document.getElementById('statsBar');
const pagination = document.getElementById('pagination');
const pageInfo = document.getElementById('pageInfo');
const exportAllBtn = document.getElementById('exportAllBtn');

// Filter Elements
const searchInput = document.getElementById('searchInput');
const subjectFilter = document.getElementById('subjectFilter');
const dateFilter = document.getElementById('dateFilter');
const scoreRange = document.getElementById('scoreRange');
const scoreValue = document.getElementById('scoreValue');
const clearFilters = document.getElementById('clearFilters');

// Pagination Elements
const firstPage = document.getElementById('firstPage');
const prevPage = document.getElementById('prevPage');
const nextPage = document.getElementById('nextPage');
const lastPage = document.getElementById('lastPage');

// Delete Modal Elements
const deleteModal = document.getElementById('deleteModal');
const cancelDelete = document.getElementById('cancelDelete');
const confirmDelete = document.getElementById('confirmDelete');

// State
let allTestResults = [];
let filteredResults = [];
let currentPage = 1;
const resultsPerPage = 12;
let testToDelete = null;

// Subject icons mapping
const subjectIcons = {
    'Python': 'fab fa-python',
    'Unix_&_Shell_programming': 'fas fa-terminal',
    'Accounting_&_Financial_Management': 'fas fa-calculator',
    'Cyber-Security': 'fas fa-shield-alt',
    'Computer_Networks': 'fas fa-network-wired'
};

// Check authentication
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        // Not logged in, redirect to login
        window.location.href = '../login/login.html';
    } else {
        // Load all test history
        await loadTestHistory(user.uid);
        
        // Setup event listeners
        setupEventListeners();
    }
});

// Load test history from Firestore
async function loadTestHistory(userId) {
    try {
        showLoading();
        
        // Query test results for this user
        const testResultsRef = collection(db, 'testResults');
        const q = query(
            testResultsRef,
            where('userId', '==', userId)
            // Note: Remove orderBy if index not ready
            // orderBy('timestamp', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            showEmptyState();
            return;
        }
        
        // Process results
        allTestResults = [];
        
        querySnapshot.forEach((doc) => {
            const testData = doc.data();
            allTestResults.push({
                id: doc.id,
                ...testData,
                timestamp: testData.timestamp ? testData.timestamp.seconds * 1000 : Date.now()
            });
        });
        
        // Sort by timestamp (newest first)
        allTestResults.sort((a, b) => b.timestamp - a.timestamp);
        
        // Apply initial filters
        applyFilters();
        
    } catch (error) {
        console.error('Error loading test history:', error);
        showErrorState('Error loading test history. Please try again.');
    }
}

// Apply filters
function applyFilters() {
    let filtered = [...allTestResults];
    
    // Apply search filter
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (searchTerm) {
        filtered = filtered.filter(test => 
            (test.subject && test.subject.toLowerCase().includes(searchTerm)) ||
            (test.testId && test.testId.toLowerCase().includes(searchTerm)) ||
            (test.userName && test.userName.toLowerCase().includes(searchTerm))
        );
    }
    
    // Apply subject filter
    const subject = subjectFilter.value;
    if (subject) {
        filtered = filtered.filter(test => test.subject === subject);
    }
    
    // Apply date filter
    const dateRange = dateFilter.value;
    if (dateRange) {
        const now = new Date();
        let startDate;
        
        switch (dateRange) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                break;
            case 'year':
                startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                break;
        }
        
        if (startDate) {
            filtered = filtered.filter(test => test.timestamp >= startDate.getTime());
        }
    }
    
    // Apply score filter
    const minScore = parseInt(scoreRange.value);
    filtered = filtered.filter(test => test.score >= minScore);
    
    filteredResults = filtered;
    currentPage = 1; // Reset to first page
    
    // Update UI
    updateStatistics();
    renderTestHistory();
    updatePagination();
}

// Update statistics
function updateStatistics() {
    if (filteredResults.length === 0) {
        statsBar.innerHTML = '';
        return;
    }
    
    // Calculate statistics
    const totalTests = filteredResults.length;
    const totalScore = filteredResults.reduce((sum, test) => sum + (test.score || 0), 0);
    const avgScore = totalTests > 0 ? (totalScore / totalTests).toFixed(1) : 0;
    
    const totalQuestions = filteredResults.reduce((sum, test) => sum + (test.totalQuestions || 0), 0);
    const correctAnswers = filteredResults.reduce((sum, test) => sum + (test.correctAnswers || 0), 0);
    
    const totalTime = filteredResults.reduce((sum, test) => sum + (test.timeSpent || 0), 0);
    
    // Get best and worst scores
    const scores = filteredResults.map(test => test.score || 0);
    const bestScore = Math.max(...scores);
    const worstScore = Math.min(...scores);
    
    const statsHTML = `
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-file-alt"></i>
            </div>
            <div class="stat-value">${totalTests}</div>
            <div class="stat-label">Total Tests</div>
        </div>
        
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-chart-line"></i>
            </div>
            <div class="stat-value">${avgScore}%</div>
            <div class="stat-label">Average Score</div>
        </div>
        
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-check-circle"></i>
            </div>
            <div class="stat-value">${correctAnswers}/${totalQuestions}</div>
            <div class="stat-label">Correct Answers</div>
        </div>
        
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-clock"></i>
            </div>
            <div class="stat-value">${formatTotalTime(totalTime)}</div>
            <div class="stat-label">Total Time</div>
        </div>
        
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-trophy"></i>
            </div>
            <div class="stat-value">${bestScore}%</div>
            <div class="stat-label">Best Score</div>
        </div>
        
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-chart-bar"></i>
            </div>
            <div class="stat-value">${worstScore}%</div>
            <div class="stat-label">Worst Score</div>
        </div>
    `;
    
    statsBar.innerHTML = statsHTML;
}

// Render test history
function renderTestHistory() {
    if (filteredResults.length === 0) {
        showEmptyState();
        return;
    }
    
    // Calculate pagination
    const startIndex = (currentPage - 1) * resultsPerPage;
    const endIndex = startIndex + resultsPerPage;
    const pageResults = filteredResults.slice(startIndex, endIndex);
    
    let historyHTML = '<div class="test-history-grid">';
    
    pageResults.forEach((test, index) => {
        // Format date
        const date = new Date(test.timestamp).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Get subject icon
        const subjectIcon = getSubjectIcon(test.subject);
        
        // Calculate color based on score
        const scoreColor = getScoreColor(test.score);
        
        // Check if this is recent (last 7 days)
        const isRecent = (Date.now() - test.timestamp) < (7 * 24 * 60 * 60 * 1000);
        
        historyHTML += `
            <div class="test-card ${isRecent ? 'highlight' : ''}" id="test-${test.id}">
                <div class="test-header">
                    <div class="test-subject">
                        <i class="${subjectIcon}"></i>
                        ${test.subject || 'Unknown Subject'}
                    </div>
                    <div class="test-date">${date}</div>
                </div>
                
                <div class="test-score-container">
                    <div class="test-score" style="color: ${scoreColor};">${test.score?.toFixed(1) || '0'}%</div>
                    <div class="score-label">Overall Score</div>
                </div>
                
                <div class="test-details">
                    <div class="detail-item">
                        <i class="fas fa-question-circle"></i>
                        <span>${test.totalQuestions || 0} Questions</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-check-circle"></i>
                        <span>${test.correctAnswers || 0} Correct</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-clock"></i>
                        <span>${formatTime(test.timeSpent || 0)}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-user"></i>
                        <span>${test.userName || 'You'}</span>
                    </div>
                </div>
                
                <div class="test-actions">
                    <button class="test-btn review" onclick="viewTestReview('${test.id}')">
                        <i class="fas fa-chart-bar"></i>
                        Review
                    </button>
                    <button class="test-btn retry" onclick="retryTest('${test.subject}', '${test.testId}')">
                        <i class="fas fa-redo"></i>
                        Retry
                    </button>
                    <button class="test-btn delete" onclick="showDeleteModal('${test.id}', '${test.subject}')">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                </div>
            </div>
        `;
    });
    
    historyHTML += '</div>';
    testHistoryContainer.innerHTML = historyHTML;
    pagination.style.display = 'flex';
}

// Update pagination
function updatePagination() {
    const totalPages = Math.ceil(filteredResults.length / resultsPerPage);
    
    // Update page info
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    
    // Update button states
    firstPage.disabled = currentPage === 1;
    prevPage.disabled = currentPage === 1;
    nextPage.disabled = currentPage === totalPages;
    lastPage.disabled = currentPage === totalPages;
    
    // Show/hide pagination
    pagination.style.display = totalPages > 1 ? 'flex' : 'none';
}

// Setup event listeners
function setupEventListeners() {
    // Filter event listeners
    searchInput.addEventListener('input', debounce(applyFilters, 300));
    subjectFilter.addEventListener('change', applyFilters);
    dateFilter.addEventListener('change', applyFilters);
    scoreRange.addEventListener('input', () => {
        scoreValue.textContent = `${scoreRange.value}%`;
        applyFilters();
    });
    
    // Clear filters
    clearFilters.addEventListener('click', () => {
        searchInput.value = '';
        subjectFilter.value = '';
        dateFilter.value = '';
        scoreRange.value = 0;
        scoreValue.textContent = '0%';
        applyFilters();
    });
    
    // Pagination event listeners
    firstPage.addEventListener('click', () => {
        currentPage = 1;
        renderTestHistory();
        updatePagination();
        scrollToTop();
    });
    
    prevPage.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTestHistory();
            updatePagination();
            scrollToTop();
        }
    });
    
    nextPage.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredResults.length / resultsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderTestHistory();
            updatePagination();
            scrollToTop();
        }
    });
    
    lastPage.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredResults.length / resultsPerPage);
        currentPage = totalPages;
        renderTestHistory();
        updatePagination();
        scrollToTop();
    });
    
    // Export button
    exportAllBtn.addEventListener('click', exportAllData);
    
    // Delete modal
    cancelDelete.addEventListener('click', () => {
        deleteModal.classList.remove('show');
        testToDelete = null;
    });
    
    confirmDelete.addEventListener('click', deleteTestResult);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            deleteModal.classList.remove('show');
            testToDelete = null;
        }
    });
}

// Export all data
function exportAllData() {
    try {
        if (filteredResults.length === 0) {
            alert('No test data to export.');
            return;
        }
        
        // Prepare CSV data
        let csvContent = "data:text/csv;charset=utf-8,";
        
        // Add headers
        csvContent += "Date,Subject,Test Name,Score,Total Questions,Correct Answers,Time Spent,User\n";
        
        // Add data rows
        filteredResults.forEach(test => {
            const date = new Date(test.timestamp).toLocaleDateString();
            const row = [
                `"${date}"`,
                `"${test.subject || ''}"`,
                `"${test.testId || ''}"`,
                `"${test.score || 0}%"`,
                `"${test.totalQuestions || 0}"`,
                `"${test.correctAnswers || 0}"`,
                `"${formatTime(test.timeSpent || 0)}"`,
                `"${test.userName || ''}"`
            ].join(',');
            
            csvContent += row + "\n";
        });
        
        // Create download link
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `dotest-history-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        
        // Trigger download
        link.click();
        document.body.removeChild(link);
        
        // Show success message
        showToast('Test history exported successfully!', 'success');
        
    } catch (error) {
        console.error('Error exporting data:', error);
        alert('Error exporting data. Please try again.');
    }
}

// Show delete confirmation modal
function showDeleteModal(testId, subject) {
    testToDelete = testId;
    deleteModal.classList.add('show');
}
window.showDeleteModal = showDeleteModal;


// Delete test result
async function deleteTestResult() {
    if (!testToDelete) return;
    
    try {
        // Delete from Firestore
        await deleteDoc(doc(db, "testResults", testToDelete));
        
        // Remove from local arrays
        allTestResults = allTestResults.filter(test => test.id !== testToDelete);
        filteredResults = filteredResults.filter(test => test.id !== testToDelete);
        
        // Update UI
        applyFilters();
        
        // Close modal
        deleteModal.classList.remove('show');
        testToDelete = null;
        
        // Show success message
        showToast('Test result deleted successfully!', 'success');
        
    } catch (error) {
        console.error('Error deleting test result:', error);
        showToast('Error deleting test result. Please try again.', 'error');
    }
}

// View test review
window.viewTestReview = function(testId) {
    // Get test data
    const test = allTestResults.find(t => t.id === testId);
    if (!test) {
        showToast('Test data not found.', 'error');
        return;
    }
    
    // Prepare review data
    const reportData = {
        testData: test.questions || [],
        userAnswers: test.userAnswers || [],
        subject: test.subject,
        testId: test.testId,
        score: test.score || 0,
        totalQuestions: test.totalQuestions || 0,
        timeSpent: test.timeSpent || 0
    };
    
    // Store data in localStorage
    localStorage.setItem('testReportData', JSON.stringify(reportData));
    
    // Redirect to print report page
    window.open(`../printReport/printReport.html?testId=${testId}`, '_blank');
};

// Retry test
window.retryTest = function(subject, testId) {
    // Store test info for retry
    sessionStorage.setItem('retryTest', JSON.stringify({
        subject: subject,
        testId: testId
    }));
    
    // Redirect to main test page
    window.location.href = '../index.html';
};

// Helper functions
function showLoading() {
    testHistoryContainer.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading your test history...</div>
        </div>
    `;
    statsBar.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading statistics...</div>
        </div>
    `;
    pagination.style.display = 'none';
}

function showEmptyState() {
    testHistoryContainer.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-file-alt"></i>
            <h3>No Test History Found</h3>
            <p>No test results match your current filters.</p>
            <div class="empty-state-actions">
                <button class="clear-filters" onclick="clearFilters.click()" style="padding: 12px 24px;">
                    <i class="fas fa-filter"></i> Clear Filters
                </button>
                <a href="../index.html" style="padding: 12px 24px; background: var(--primary); color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">
                    <i class="fas fa-play"></i> Take a Test
                </a>
            </div>
        </div>
    `;
    pagination.style.display = 'none';
}

function showErrorState(message) {
    testHistoryContainer.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error Loading History</h3>
            <p>${message}</p>
            <button onclick="location.reload()" style="margin-top: 20px; padding: 12px 24px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer;">
                <i class="fas fa-redo"></i> Try Again
            </button>
        </div>
    `;
    pagination.style.display = 'none';
}

function getSubjectIcon(subject) {
    return subjectIcons[subject] || 'fas fa-book';
}

function getScoreColor(score) {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
}

function formatTime(minutes) {
    if (!minutes) return '0m';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) {
        return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
}

function formatTotalTime(minutes) {
    if (!minutes) return '0h';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) {
        return `${hrs}h ${mins}m`;
    }
    return '<1h';
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Debounce function for search
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

// Toast notification
function showToast(message, type = 'info') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Set icon based on type
    let icon = 'info-circle';
    let bgColor = '#4f46e5';
    
    if (type === 'warning') {
        icon = 'exclamation-triangle';
        bgColor = '#f59e0b';
    } else if (type === 'success') {
        icon = 'check-circle';
        bgColor = '#10b981';
    } else if (type === 'error') {
        icon = 'times-circle';
        bgColor = '#ef4444';
    }
    
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    // Add styles
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 1001;
        animation: slideIn 0.3s ease;
        font-family: 'Roboto', sans-serif;
        font-weight: 500;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        max-width: 400px;
    `;
    
    // Add to document
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// Add CSS for toast animations
if (!document.querySelector('#toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}
