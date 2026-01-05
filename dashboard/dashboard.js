import { auth, db, signOut } from '../firebase/config.js';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    orderBy, 
    limit,
    doc,
    getDoc 
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const userAvatar = document.getElementById('userAvatar');
const logoutBtn = document.getElementById('logoutBtn');
const testHistoryContainer = document.getElementById('testHistoryContainer');

// Stats elements
const totalTests = document.getElementById('totalTests');
const avgScore = document.getElementById('avgScore');
const totalTime = document.getElementById('totalTime');
const streak = document.getElementById('streak');

// Check authentication
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        // Not logged in, redirect to login
        window.location.href = '../login/login.html';
    } else {
        // Update user info
        updateUserInfo(user);
        
        // Load test history
        await loadTestHistory(user.uid);
        
        // Load statistics
        await loadStatistics(user.uid);
    }
});

// Update user information in header
function updateUserInfo(user) {
    userName.textContent = user.displayName || 'User';
    userEmail.textContent = user.email || 'No email';
    
    if (user.photoURL) {
        userAvatar.src = user.photoURL;
    } else {
        // Default avatar based on first letter
        const firstLetter = user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U';
        userAvatar.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%234f46e5"/><text x="50" y="60" text-anchor="middle" fill="white" font-size="50" font-family="Arial">${firstLetter}</text></svg>`;
    }
    
    // Store user info in localStorage for quick access
    localStorage.setItem('user', JSON.stringify({
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL
    }));
}

// Load test history from Firestore
async function loadTestHistory(userId) {
    try {
        // Query test results for this user
        const testResultsRef = collection(db, 'testResults');
        const q = query(
            testResultsRef,
            where('userId', '==', userId),
            orderBy('timestamp', 'desc'),
            limit(5)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            showEmptyState();
            return;
        }
        
        let testHistoryHTML = '';
        
        querySnapshot.forEach((doc) => {
            const testData = doc.data();
            
            // Format date
            const date = testData.timestamp ? 
                new Date(testData.timestamp.seconds * 1000).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }) : 'Recent';
            
            // Get subject icon
            const subjectIcon = getSubjectIcon(testData.subject);
            
            // Calculate color based on score
            const scoreColor = getScoreColor(testData.score);
            
            testHistoryHTML += `
                <div class="test-card" data-test-result-id="${doc.id}">
                    <div class="test-header">
                        <div class="test-subject">
                            <i class="${subjectIcon}"></i>
                            ${testData.subject || 'Unknown Subject'}
                        </div>
                        <div class="test-date">${date}</div>
                    </div>
                    
                    <div class="test-score" style="color: ${scoreColor};">${testData.score?.toFixed(1) || '0'}%</div>
                    
                    <div class="test-details">
                        <span><i class="fas fa-question-circle"></i> ${testData.totalQuestions || 0} Questions</span>
                        <span><i class="fas fa-check-circle"></i> ${testData.correctAnswers || 0} Correct</span>
                        <span><i class="fas fa-clock"></i> ${formatTime(testData.timeSpent || 0)}</span>
                    </div>
                    
                    <div class="test-actions">
                        <button class="test-btn review" onclick="viewTestReview('${doc.id}')">
                            <i class="fas fa-chart-bar"></i>
                            Review
                        </button>
                        <button class="test-btn retry" onclick="retryTest('${testData.subject}', '${testData.testId}')">
                            <i class="fas fa-redo"></i>
                            Retry
                        </button>
                    </div>
                </div>
            `;
        });
        
        testHistoryContainer.innerHTML = `
            <div class="history-grid">
                ${testHistoryHTML}
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading test history:', error);
        testHistoryContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error Loading History</h3>
                <p>Unable to load your test history. Please try again later.</p>
            </div>
        `;
    }
}

// Load statistics
async function loadStatistics(userId) {
    try {
        const testResultsRef = collection(db, 'testResults');
        const q = query(
            testResultsRef,
            where('userId', '==', userId)
        );
        
        const querySnapshot = await getDocs(q);
        
        let totalTestsCount = 0;
        let totalScoreSum = 0;
        let totalTimeSpent = 0;
        let today = new Date();
        let streakCount = 0;
        let lastTestDate = null;
        
        querySnapshot.forEach((doc) => {
            const testData = doc.data();
            totalTestsCount++;
            
            if (testData.score) {
                totalScoreSum += testData.score;
            }
            
            if (testData.timeSpent) {
                totalTimeSpent += testData.timeSpent;
            }
            
            // Calculate streak (simplified - checks if tests were taken on consecutive days)
            if (testData.timestamp) {
                const testDate = new Date(testData.timestamp.seconds * 1000);
                const testDay = testDate.toDateString();
                
                if (!lastTestDate) {
                    lastTestDate = testDate;
                    streakCount = 1;
                } else {
                    const diffDays = Math.floor((today - testDate) / (1000 * 60 * 60 * 24));
                    if (diffDays === streakCount) {
                        streakCount++;
                    }
                }
            }
        });
        
        // Update stats
        totalTests.textContent = totalTestsCount;
        avgScore.textContent = totalTestsCount > 0 ? `${(totalScoreSum / totalTestsCount).toFixed(1)}%` : '0%';
        totalTime.textContent = formatTotalTime(totalTimeSpent);
        streak.textContent = streakCount;
        
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

// Helper functions
function showEmptyState() {
    testHistoryContainer.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-file-alt"></i>
            <h3>No Test History Yet</h3>
            <p>You haven't taken any tests yet. Start your learning journey by taking a test!</p>
            <a href="../index.html" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: var(--primary); color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">
                <i class="fas fa-play"></i> Take Your First Test
            </a>
        </div>
    `;
}

function getSubjectIcon(subject) {
    const icons = {
        'Python': 'fab fa-python',
        'Unix_&_Shell_programming': 'fas fa-terminal',
        'Accounting_&_Financial_Management': 'fas fa-calculator',
        'Cyber-Security': 'fas fa-shield-alt',
        'Computer_Networks': 'fas fa-network-wired'
    };
    
    return icons[subject] || 'fas fa-book';
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
        return `${hrs}h`;
    }
    return '<1h';
}

// Event Listeners
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        localStorage.removeItem('user');
        localStorage.removeItem('testReportData');
        sessionStorage.removeItem('currentTestReviewId');
        window.location.href = '../login/login.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Failed to logout. Please try again.');
    }
});

// Global functions for buttons
window.viewTestReview = async function(testResultId) {
    try {
        console.log('Opening test review for ID:', testResultId);
        
        // Get test result document from Firestore
        const testResultDoc = await getDoc(doc(db, 'testResults', testResultId));
        
        if (!testResultDoc.exists()) {
            alert('Test result not found');
            return;
        }
        
        const testResultData = testResultDoc.data();
        
        // Prepare the report data object
        const reportData = {
            testData: testResultData.questions || [],
            userAnswers: testResultData.userAnswers || [],
            subject: testResultData.subject || 'General',
            testId: testResultData.testId || 'unknown',
            score: testResultData.score || 0,
            totalQuestions: testResultData.totalQuestions || 0,
            correctAnswers: testResultData.correctAnswers || 0,
            timeSpent: testResultData.timeSpent || 0,
            timestamp: testResultData.timestamp || new Date(),
            testName: `${testResultData.subject || 'Test'} Review`
        };
        
        // Store in localStorage (this is what the printReport.html reads)
        localStorage.setItem('testReportData', JSON.stringify(reportData));
        
        // Open the print report page in a new tab
        window.open('../printReport/printReport.html', '_blank');
        
    } catch (error) {
        console.error('Error in viewTestReview:', error);
        alert('Failed to load test review. Please try again.');
    }
};

window.retryTest = function(subject, testId) {
    // Store test info for retry
    sessionStorage.setItem('retryTest', JSON.stringify({
        subject: subject,
        testId: testId
    }));
    
    // Redirect to main test page
    window.location.href = '../index.html';
};

// Add keyboard shortcut for logout (Ctrl+Q)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'q') {
        e.preventDefault();
        logoutBtn.click();
    }
});