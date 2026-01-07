import { getData, getDocument, convertExamObjectToArray } from "./app.js";
import { startTest, resetTest } from "./test.logic.js";

const stb = document.getElementById('view-all-test-view');
const backBtn = document.getElementById('backBtn');
const testBox = document.getElementById('testBox');
const loading = document.getElementById('loading');
const emptyState = document.getElementById('emptyState');
const testContent = document.getElementById('testContent');
const subjectName = document.getElementById('subjectName');

let currentSubject = null;

// Subject icons mapping
const subjectIcons = {
  'Python': 'fab fa-python',
  'Unix_&_Shell_programming': 'fas fa-terminal',
  'Accounting_&_Financial_Management': 'fas fa-calculator',
  'Cyber-Security': 'fas fa-shield-alt',
  'Computer_Networks': 'fas fa-network-wired',
  'JavaScript': "fa-brands fa-js"
  
};

stb.addEventListener("click", async (e) => {
  if (e.target.tagName === 'P') {
    const selectedSubject = e.target.dataset.value;
    currentSubject = selectedSubject;
    
    // Update UI
    showLoading();
    subjectName.textContent = formatSubjectName(selectedSubject);
    
    try {
      // Get tests for this subject
      const tests = await getData(selectedSubject);
      
      if (tests.length === 0) {
        showTestSelection(selectedSubject, tests);
      } else {
        showTestSelection(selectedSubject, tests);
      }
    } catch (error) {
      console.error("Error loading tests:", error);
      showError("Failed to load tests. Please try again.");
    }
  }
});

function showLoading() {
  emptyState.style.display = 'none';
  testContent.style.display = 'none';
  loading.classList.add('show');
}

function hideLoading() {
  loading.classList.remove('show');
}

function showError(message) {
  hideLoading();
  emptyState.innerHTML = `
    <i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i>
    <h3>Error Loading Tests</h3>
    <p>${message}</p>
    <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer;">
      Retry
    </button>
  `;
  emptyState.style.display = 'block';
}

function showTestSelection(subjectName, tests) {
  hideLoading();
  backBtn.classList.add('show');
  
  const icon = subjectIcons[subjectName] || 'fas fa-book';
  let temp = '';
  
  if (tests.length === 0) {
    temp = `
      <div class="empty-state" style="padding: 40px 20px;">
        <i class="fas fa-folder-open"></i>
        <h3>No Tests Available</h3>
        <p>There are no tests available for this subject yet.</p>
      </div>
    `;
  } else {
     const reversedTests = [...tests].reverse();

    reversedTests.forEach((test, index) => {
      // Extract test name from the ID
      const displayName = formatTestName(test.id);
      
      temp += `
        <p data-value="${test.id}" class="test-item" style="animation-delay: ${index * 0.1}s;">
          <i class="fas fa-file-alt"></i>
          ${displayName}
          <span class="test-meta">
            ${getQuestionCount(test.data)} Questions
          </span>
        </p>
      `;
    });
  }
  
  // Update the subject selection view
  document.getElementById("view-all-test-view").innerHTML = `
    <div class="all_test" id="all_test">
      <div class="subject-header" style="margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid var(--border);">
        <h3 style="display: flex; align-items: center; gap: 12px; color: var(--text-primary);">
          <i class="${icon}"></i>
          ${formatSubjectName(subjectName)}
        </h3>
        <p style="color: var(--text-secondary); font-size: 14px; margin-top: 8px;">
          Select a test to begin
        </p>
      </div>
      ${temp}
    </div>
  `;
  
  setupTestSelection(subjectName);
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

function setupTestSelection(subjectName) {
  const allTest = document.getElementById('all_test');
  
  // Remove existing listeners
  const newAllTest = allTest.cloneNode(true);
  allTest.parentNode.replaceChild(newAllTest, allTest);
  
  // Add new listener
  newAllTest.addEventListener("click", async (e) => {
    const testItem = e.target.closest('.test-item');
    if (testItem) {
      const testId = testItem.dataset.value;
      
      showLoading();
      testContent.style.display = 'none';
      
      try {
        const data = await getDocument(subjectName, testId);
        
        if (data && data.exam) {
          // Convert exam object to array
          const examArray = convertExamObjectToArray(data.exam);
          
          if (examArray.length > 0) {
            // Start the test
            startTest(examArray, subjectName, testId);
            
            // Update test info
            document.getElementById('testName').textContent = formatTestName(testId);
            document.getElementById('totalQuestions').textContent = examArray.length;
            
            // Show test content
            hideLoading();
            testContent.style.display = 'block';
            emptyState.style.display = 'none';
            
            // Scroll to top
            testBox.scrollIntoView({ behavior: 'smooth' });
          } else {
            showError("No questions found in this test.");
          }
        } else {
          showError("Test data is empty or invalid.");
        }
      } catch (error) {
        console.error("Error loading test:", error);
        showError("Failed to load test. Please try another one.");
      }
    }
  });
}

// Back button functionality
backBtn.addEventListener("click", () => {
  resetUI();
  resetTest();
});

function resetUI() {
  backBtn.classList.remove('show');
  testContent.style.display = 'none';
  emptyState.style.display = 'block';
  
  // Reset subject selection view to original
  const originalHTML = `
    <p data-value="Python">
      <i class="fab fa-python"></i>
      Python Programming
    </p>
    <p data-value="Unix_&_Shell_programming">
      <i class="fas fa-terminal"></i>
      Unix & Shell Programming
    </p>
    <p data-value="Accounting_&_Financial_Management">
      <i class="fas fa-calculator"></i>
      Accounting & Financial Management
    </p>
    <p data-value="Cyber-Security">
      <i class="fas fa-shield-alt"></i>
      Cyber Security
    </p>
    <p data-value="Computer_Networks">
      <i class="fas fa-network-wired"></i>
      Computer Networks
    </p>
    <p data-value="JavaScript">
      <i class="fa-brands fa-js"></i>
      JavaScript
    </p>
  `;
  
  document.getElementById("view-all-test-view").innerHTML = originalHTML;
}

// Add to window for debugging
window.resetUI = resetUI;
window.currentSubject = () => currentSubject;