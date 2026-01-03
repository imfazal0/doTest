import { auth, db } from "../firebase/config.js";
import { saveTestResults } from "./app.js";
// Add Firestore imports
import { 
  doc, 
  getDoc, 
  setDoc 
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

export let currentTest = null;
let currentQuestionIndex = 0;
let userAnswers = [];
let score = 0;
let timer = null;
let timeLeft = 1800; // 30 minutes in seconds
let startTime = null;

// Review variables
let reviewQuestions = [];
let currentReviewIndex = 0;
let userReviewAnswers = [];

export function startTest(examData, subject, testId) {
  // Ensure examData is an array
  if (!Array.isArray(examData)) {
    console.error("Exam data is not an array:", examData);
    showToast("Error: Invalid test format", "error");
    return;
  }
  
  if (examData.length === 0) {
    console.error("Exam data is empty");
    showToast("Error: No questions in this test", "error");
    return;
  }
  
  currentTest = {
    data: examData,
    subject: subject,
    testId: testId,
    totalQuestions: examData.length
  };
  
  currentQuestionIndex = 0;
  userAnswers = new Array(examData.length).fill(null);
  score = 0;
  startTime = Date.now();
  
  // Reset and start timer
  resetTimer();
  startTimer();
  
  // Initialize question navigation
  initTest();
  
  // Load first question
  loadQuestion(currentQuestionIndex);
  updateProgress();
  updateQuestionCounter();
  
  // Initialize review functionality
  initReview();
  initAllInOneReview();
}

export function resetTest() {
  currentTest = null;
  currentQuestionIndex = 0;
  userAnswers = [];
  score = 0;
  clearInterval(timer);
}

function loadQuestion(index) {
  if (!currentTest || !currentTest.data[index]) {
    console.error("No question data available for index:", index);
    return;
  }
  
  const question = currentTest.data[index];
  
  // Update question number
  document.getElementById('questionNo').textContent = `Q${index + 1}`;
  document.getElementById('currentQuestion').textContent = index + 1;
  
  // Update question text
  document.getElementById('question').textContent = question.question || "Question not available";
  
  // Update options
  const optionsContainer = document.getElementById('opt-div-in');
  let optionsHTML = '';
  
  // Handle different option formats
  let options = {};
  
  if (question.options && typeof question.options === 'object') {
    // Format: { "a": "option text", "b": "option text", ... }
    options = question.options;
  } else if (question.option1 && question.option2 && question.option3 && question.option4) {
    // Format: separate option fields
    options = {
      "A": question.option1,
      "B": question.option2,
      "C": question.option3,
      "D": question.option4
    };
  } else {
    // Default options
    options = {
      "A": "Option A",
      "B": "Option B", 
      "C": "Option C",
      "D": "Option D"
    };
  }
  
  // Convert option keys to uppercase for display
  const optionKeys = Object.keys(options);
  const displayKeys = optionKeys.map(key => key.toUpperCase());
  
  // Create option elements
  optionKeys.forEach((key, i) => {
    const displayKey = displayKeys[i];
    const isSelected = userAnswers[index] === displayKey;
    
    optionsHTML += `
      <div data-value="${displayKey}" class="opt-common ${isSelected ? 'selected' : ''}">
        <div class="opt-logo">${displayKey}</div>
        <div class="opt-data">${options[key]}</div>
      </div>
    `;
  });
  
  optionsContainer.innerHTML = optionsHTML;
  
  // Update next button text
  const nextButton = document.getElementById('next_button');
  if (index === currentTest.totalQuestions - 1) {
    nextButton.innerHTML = 'Submit Test <i class="fas fa-check"></i>';
  } else {
    nextButton.innerHTML = 'Next Question <i class="fas fa-arrow-right"></i>';
  }
  
  // Update previous button state
  const prevButton = document.getElementById('prevButton');
  if (prevButton) {
    prevButton.disabled = index === 0;
  }
  
  // Add option selection handlers
  setupOptionSelection();
  
  // Update total questions display
  document.getElementById('totalQuestionsCount').textContent = currentTest.totalQuestions;
  document.getElementById('totalQuestions').textContent = currentTest.totalQuestions;
}

function setupOptionSelection() {
  const options = document.querySelectorAll('.opt-common');
  options.forEach(option => {
    option.addEventListener('click', () => {
      // Remove selected class from all options
      options.forEach(opt => opt.classList.remove('selected'));
      
      // Add selected class to clicked option
      option.classList.add('selected');
      
      // Store user's answer
      const selectedOption = option.dataset.value;
      userAnswers[currentQuestionIndex] = selectedOption;
      
      // Enable next button with animation
      const nextButton = document.getElementById('next_button');
      nextButton.disabled = false;
      nextButton.style.animation = 'pulse 0.5s ease';
      setTimeout(() => {
        nextButton.style.animation = '';
      }, 500);
      
      // Provide visual feedback
      showToast("Answer selected", "success");
    });
  });
}

function updateProgress() {
  if (!currentTest) return;
  
  const progress = ((currentQuestionIndex + 1) / currentTest.totalQuestions) * 100;
  const progressFill = document.getElementById('progressFill');
  const progressPercent = document.getElementById('progressPercent');
  
  progressFill.style.width = `${progress}%`;
  progressPercent.textContent = `${Math.round(progress)}%`;
}

function updateQuestionCounter() {
  if (!currentTest) return;
  
  document.getElementById('totalQuestionsCount').textContent = currentTest.totalQuestions;
  document.getElementById('currentQuestion').textContent = currentQuestionIndex + 1;
}

function startTimer() {
  clearInterval(timer);
  
  // Update timer display immediately
  updateTimerDisplay();
  
  timer = setInterval(() => {
    timeLeft--;
    
    // Update timer display
    updateTimerDisplay();
    
    // Time's up
    if (timeLeft <= 0) {
      clearInterval(timer);
      timeLeft = 0;
      
      // Force finish the test
      finishTest();
      showToast("Time's up! Test submitted automatically.", "warning");
    }
    
    // Warning when 5 minutes left
    if (timeLeft === 300) { // 5 minutes = 300 seconds
      showToast("5 minutes remaining!", "warning");
    }
    
    // Warning when 1 minute left
    if (timeLeft === 60) {
      showToast("1 minute remaining!", "warning");
    }
  }, 1000);
}

function updateTimerDisplay() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  
  // Try multiple selectors to find the timer element
  let timerElement = document.getElementById('timerDisplay');
  
  if (!timerElement) {
    // Fallback to class selector
    const testInfoItems = document.querySelectorAll('.test-info-item');
    if (testInfoItems.length >= 4) {
      timerElement = testInfoItems[3].querySelector('.test-info-value');
    }
  }
  
  if (timerElement) {
    timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}

function resetTimer() {
  timeLeft = 1800; // Reset to 30 minutes
  clearInterval(timer);
  
  // Update display
  updateTimerDisplay();
}

// Initialize test
export function initTest() {
  addQuestionNavigation();
  
  // Next button handler
  const nextButton = document.getElementById('next_button');
  nextButton.disabled = true;
  nextButton.addEventListener('click', handleNext);
  
  // Add keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardNavigation);
}

function addQuestionNavigation() {
  const buttonDiv = document.querySelector('.button');
  if (!buttonDiv.querySelector('#prevButton')) {
    const prevButton = document.createElement('button');
    prevButton.id = 'prevButton';
    prevButton.innerHTML = '<i class="fas fa-arrow-left"></i> Previous';
    prevButton.className = 'prev-btn';
    prevButton.disabled = true;
    
    prevButton.addEventListener('click', () => {
      if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        loadQuestion(currentQuestionIndex);
        updateProgress();
      }
    });
    
    // Insert before the next button
    const nextButton = document.getElementById('next_button');
    buttonDiv.insertBefore(prevButton, nextButton);
  }
}

function handleNext() {
  if (!currentTest) return;
  
  // Always store the current answer (even if null/undefined)
  const currentQuestionIndexSaved = currentQuestionIndex;
  const userAnswer = userAnswers[currentQuestionIndexSaved];
  
  // Check if last question or not
  if (currentQuestionIndexSaved < currentTest.totalQuestions - 1) {
    // Move to next question
    currentQuestionIndex++;
    loadQuestion(currentQuestionIndex);
    updateProgress();
    
    // Disable next button until an option is selected for the new question
    document.getElementById('next_button').disabled = true;
  } else {
    // This is the last question - finish the test
    finishTest();
  }
}

function getCorrectAnswer(question) {
  // Try different possible field names for correct answer
  const possibleKeys = ['correctAnswer', 'correct_ans', 'answer', 'correct', 'correct_option', 'right_answer'];
  
  for (const key of possibleKeys) {
    if (question[key] !== undefined && question[key] !== null) {
      return question[key].toString().toUpperCase();
    }
  }
  
  // If no match found, check options structure
  if (question.options && typeof question.options === 'object') {
    // Some questions might store answer as a key in options
    const answerKey = possibleKeys.find(key => question[key]);
    if (answerKey && question.options[question[answerKey]]) {
      return question[answerKey].toString().toUpperCase();
    }
  }
  
  console.warn('Could not find correct answer for question:', question);
  return null;
}

function handleKeyboardNavigation(e) {
  if (!currentTest) return;
  
  // Number keys 1-4 for options
  if (e.key >= '1' && e.key <= '4') {
    const optionIndex = parseInt(e.key) - 1;
    const optionKeys = ['A', 'B', 'C', 'D'];
    const options = document.querySelectorAll('.opt-common');
    
    if (options[optionIndex]) {
      options[optionIndex].click();
    }
  }
  
  // Enter for next question
  if (e.key === 'Enter' && !document.getElementById('next_button').disabled) {
    document.getElementById('next_button').click();
  }
  
  // Arrow keys for navigation
  if (e.key === 'ArrowRight') {
    if (currentQuestionIndex < currentTest.totalQuestions - 1) {
      if (!document.getElementById('next_button').disabled) {
        document.getElementById('next_button').click();
      }
    }
  }
  
  if (e.key === 'ArrowLeft' && currentQuestionIndex > 0) {
    document.getElementById('prevButton').click();
  }
  
  // Space bar to select/deselect
  if (e.key === ' ' && document.activeElement.classList.contains('opt-common')) {
    document.activeElement.click();
    e.preventDefault();
  }
}

async function finishTest() {
  clearInterval(timer);
  
  // Calculate time spent
  const endTime = Date.now();
  const timeSpentSeconds = Math.floor((endTime - startTime) / 1000);
  const timeSpentMinutes = Math.floor(timeSpentSeconds / 60);
  
  // Calculate score properly at the end by checking all questions
  score = 0;
  for (let i = 0; i < currentTest.totalQuestions; i++) {
    const question = currentTest.data[i];
    const correctAnswer = getCorrectAnswer(question);
    const userAnswer = userAnswers[i];
    
    // Only count if user answered and answer is correct
    if (userAnswer && correctAnswer && 
        userAnswer.toString().toUpperCase() === correctAnswer.toString().toUpperCase()) {
      score++;
    }
  }
  
  const percentage = (score / currentTest.totalQuestions) * 100;
  const formattedPercentage = percentage.toFixed(2);
  
  // Get grade message
  let gradeMessage = '';
  let gradeIcon = '';
  if (percentage >= 90) {
    gradeMessage = 'Excellent! 🎉';
    gradeIcon = 'fas fa-trophy';
  } else if (percentage >= 75) {
    gradeMessage = 'Great job! 👍';
    gradeIcon = 'fas fa-star';
  } else if (percentage >= 60) {
    gradeMessage = 'Good effort!';
    gradeIcon = 'fas fa-thumbs-up';
  } else {
    gradeMessage = 'Keep practicing! 📚';
    gradeIcon = 'fas fa-book';
  }
  
  // Update results modal
  document.getElementById('finalScore').textContent = `${formattedPercentage}%`;
  document.getElementById('resultsMessage').innerHTML = `
    <i class="${gradeIcon}" style="font-size: 48px; color: #f59e0b; margin-bottom: 10px; display: block;"></i>
    <h3 style="margin-bottom: 10px;">${gradeMessage}</h3>
    You answered <strong>${score} out of ${currentTest.totalQuestions}</strong> questions correctly.
  `;
  
  // Save test results
  try {
    const user = auth.currentUser;
    if (user) {
      // Save test results first
      await saveTestResults(
        currentTest.data,
        userAnswers,
        score,
        currentTest.subject,
        currentTest.testId,
        timeSpentMinutes
      );
      
      // Now update leaderboard with the same user object
      await updateLeaderboard(user, currentTest.data, percentage, timeSpentMinutes);
    }
  } catch (error) {
    console.error('Error saving test results:', error);
  }
  
  // Show results modal
  document.getElementById('resultsModal').classList.add('show');
  
  // Initialize review buttons if not already
  initReviewButton();
}
// ========== REVIEW FUNCTIONALITY ==========

// Initialize review button in results modal
function initReviewButton() {
    const resultsActions = document.querySelector('.results-actions');
    const closeBtn = document.getElementById('closeResultsBtn');
    
    // Check if review button already exists
    if (document.getElementById('reviewBtn')) return;
    
    // Create review button
    const reviewBtn = document.createElement('button');
    reviewBtn.id = 'reviewBtn';
    reviewBtn.className = 'review-btn';
    reviewBtn.innerHTML = '<i class="fas fa-chart-bar"></i> Review Answers';
    reviewBtn.style.cssText = `
        background: linear-gradient(135deg, #4f46e5, #3730a3);
        color: white;
        border: none;
        padding: 16px;
        border-radius: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
    `;
    
    // Add hover effect
    reviewBtn.addEventListener('mouseenter', () => {
        reviewBtn.style.transform = 'translateY(-2px)';
        reviewBtn.style.boxShadow = '0 8px 20px rgba(79, 70, 229, 0.3)';
    });
    
    reviewBtn.addEventListener('mouseleave', () => {
        reviewBtn.style.transform = 'translateY(0)';
        reviewBtn.style.boxShadow = 'none';
    });
    
    // Add click handler
    reviewBtn.addEventListener('click', () => {
        document.getElementById('resultsModal').classList.remove('show');
        showReview();
    });
    
    // Insert before close button
    closeBtn.parentNode.insertBefore(reviewBtn, closeBtn);
}

// Initialize review functionality
export function initReview() {
    // Add close review button handler
    const closeReviewBtn = document.getElementById('closeReviewBtn');
    if (closeReviewBtn) {
        closeReviewBtn.addEventListener('click', () => {
            // handleNext()
            document.getElementById('reviewModal').classList.remove('show');
             document.getElementById('resultsModal').classList.add('show');
        });
    }
    
    // Add review navigation handlers
    const prevReviewBtn = document.getElementById('prevReviewBtn');
    const nextReviewBtn = document.getElementById('nextReviewBtn');
    if (prevReviewBtn) {
        prevReviewBtn.addEventListener('click', showPreviousReviewQuestion);
    }
    if (nextReviewBtn) {
        nextReviewBtn.addEventListener('click', showNextReviewQuestion);
    }
    
    // Add question jump handler
    const questionJumpSelect = document.getElementById('questionJumpSelect');
    if (questionJumpSelect) {
        questionJumpSelect.addEventListener('change', (e) => {
            const index = parseInt(e.target.value);
            if (!isNaN(index)) {
                showReviewQuestion(index);
            }
        });
    }
    
    // Add print handler
    const printReviewBtn = document.getElementById('printReviewBtn');
    if (printReviewBtn) {
        printReviewBtn.addEventListener('click', printReview);
    }
    
    // Add keyboard navigation for review
    document.addEventListener('keydown', handleReviewKeyboardNavigation);
}

// Show review screen
function showReview() {
    if (!currentTest) {
        console.error('No test data available for review');
        return;
    }
    
    // Prepare review data
    prepareReviewData();
    
    // Show review modal
    document.getElementById('reviewModal').classList.add('show');
    
    // Show first question
    showReviewQuestion(0);
    
    // Update navigation
    updateReviewNavigation();
}

// Prepare review data
function prepareReviewData() {
    reviewQuestions = currentTest.data;
    userReviewAnswers = [...userAnswers];
    
    // Calculate stats
    calculateReviewStats();
    
    // Populate question jump select
    populateQuestionJumpSelect();
    
    // Populate question navigation dots
    populateQuestionNavigationDots();
}

// Calculate review statistics
function calculateReviewStats() {
    if (!reviewQuestions.length) return;
    
    let correct = 0;
    let incorrect = 0;
    let skipped = 0;
    let totalMarks = 0;
    let obtainedMarks = 0;
    
    reviewQuestions.forEach((question, index) => {
        const userAnswer = userReviewAnswers[index];
        const correctAnswer = getCorrectAnswer(question);
        const marks = question.marks || 1;
        
        totalMarks += marks;
        
        if (!userAnswer) {
            skipped++;
        } else if (userAnswer === correctAnswer) {
            correct++;
            obtainedMarks += marks;
        } else {
            incorrect++;
        }
    });
    
    const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;
    
    // Update stats display
    const statsHTML = `
        <div class="stat-box stat-correct">
            <div class="stat-value">${correct}</div>
            <div class="stat-label">Correct</div>
        </div>
        <div class="stat-box stat-incorrect">
            <div class="stat-value">${incorrect}</div>
            <div class="stat-label">Incorrect</div>
        </div>
        <div class="stat-box stat-skipped">
            <div class="stat-value">${skipped}</div>
            <div class="stat-label">Skipped</div>
        </div>
        <div class="stat-box stat-score">
            <div class="stat-value">${percentage.toFixed(1)}%</div>
            <div class="stat-label">Score</div>
        </div>
    `;
    
    document.getElementById('reviewStats').innerHTML = statsHTML;
    
    // Update score breakdown
    document.getElementById('scorePercentage').textContent = `${percentage.toFixed(1)}%`;
    document.getElementById('scoreFill').style.width = `${percentage}%`;
    document.getElementById('totalScoreLabel').textContent = `${obtainedMarks}/${totalMarks}`;
    document.getElementById('maxScoreLabel').textContent = totalMarks;
}

// Populate question jump select
function populateQuestionJumpSelect() {
    const select = document.getElementById('questionJumpSelect');
    select.innerHTML = '';
    
    reviewQuestions.forEach((_, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `Question ${index + 1}`;
        select.appendChild(option);
    });
}

// Populate question navigation dots
function populateQuestionNavigationDots() {
    const dotsContainer = document.getElementById('questionDots');
    dotsContainer.innerHTML = '';
    
    reviewQuestions.forEach((question, index) => {
        const dot = document.createElement('div');
        dot.className = 'question-dot';
        dot.textContent = index + 1;
        dot.dataset.index = index;
        
        const userAnswer = userReviewAnswers[index];
        const correctAnswer = getCorrectAnswer(question);
        
        if (!userAnswer) {
            dot.classList.add('skipped');
        } else if (userAnswer === correctAnswer) {
            dot.classList.add('correct');
        } else {
            dot.classList.add('incorrect');
        }
        
        if (index === currentReviewIndex) {
            dot.classList.add('current');
        }
        
        dot.addEventListener('click', () => {
            showReviewQuestion(index);
        });
        
        dotsContainer.appendChild(dot);
    });
}

// Show specific review question
function showReviewQuestion(index) {
    if (index < 0 || index >= reviewQuestions.length) return;
    
    currentReviewIndex = index;
    const question = reviewQuestions[index];
    const userAnswer = userReviewAnswers[index];
    const correctAnswer = getCorrectAnswer(question);
    
    // Determine question status
    let status = '';
    let statusClass = '';
    let statusText = '';
    
    if (!userAnswer) {
        status = 'skipped';
        statusClass = 'skipped';
        statusText = 'SKIPPED';
    } else if (userAnswer === correctAnswer) {
        status = 'correct';
        statusClass = 'correct';
        statusText = 'CORRECT';
    } else {
        status = 'incorrect';
        statusClass = 'incorrect';
        statusText = 'INCORRECT';
    }
    
    // Get options
    let options = {};
    if (question.options && typeof question.options === 'object') {
        options = question.options;
    } else if (question.option1 && question.option2 && question.option3 && question.option4) {
        options = {
            "A": question.option1,
            "B": question.option2,
            "C": question.option3,
            "D": question.option4
        };
    }
    
    // Build options HTML
    let optionsHTML = '';
    Object.keys(options).forEach(key => {
        const isUserSelected = userAnswer === key.toUpperCase();
        const isCorrectAnswer = correctAnswer === key.toUpperCase();
        
        let optionClass = 'review-option';
        if (isUserSelected && isCorrectAnswer) {
            optionClass += ' user-selected correct-answer';
        } else if (isUserSelected && !isCorrectAnswer) {
            optionClass += ' user-selected incorrect-selected';
        } else if (!isUserSelected && isCorrectAnswer) {
            optionClass += ' correct-answer';
        } else if (isUserSelected) {
            optionClass += ' user-selected';
        }
        
        optionsHTML += `
            <div class="${optionClass}">
                <div class="option-indicator">${key.toUpperCase()}</div>
                <div class="option-text">${options[key]}</div>
                ${isUserSelected ? '<i class="fas fa-user" style="color: #4f46e5;"></i>' : ''}
                ${isCorrectAnswer && !isUserSelected ? '<i class="fas fa-check" style="color: #10b981;"></i>' : ''}
            </div>
        `;
    });
    
    // Build explanation HTML if available
    let explanationHTML = '';
    if (question.explanation) {
        explanationHTML = `
            <div class="explanation-section">
                <h4><i class="fas fa-lightbulb"></i> Explanation</h4>
                <div class="explanation-content">${question.explanation}</div>
            </div>
        `;
    }
    
    // Build feedback HTML
    let feedbackHTML = '';
    if (userAnswer) {
        if (userAnswer === correctAnswer) {
            feedbackHTML = `
                <div class="review-answer-feedback">
                    <div class="feedback-header">
                        <i class="fas fa-check-circle" style="color: #10b981;"></i>
                        Correct Answer!
                    </div>
                    <div class="feedback-text">
                        You selected the correct answer. ${question.marks || 1} mark${question.marks === 1 ? '' : 's'} awarded.
                    </div>
                </div>
            `;
        } else {
            feedbackHTML = `
                <div class="review-answer-feedback">
                    <div class="feedback-header">
                        <i class="fas fa-times-circle" style="color: #ef4444;"></i>
                        Incorrect Answer
                    </div>
                    <div class="feedback-text">
                        You selected ${userAnswer}. The correct answer is ${correctAnswer}.
                    </div>
                </div>
            `;
        }
    } else {
        feedbackHTML = `
            <div class="review-answer-feedback">
                <div class="feedback-header">
                    <i class="fas fa-question-circle" style="color: #f59e0b;"></i>
                    Not Answered
                </div>
                <div class="feedback-text">
                    You did not answer this question. The correct answer is ${correctAnswer}.
                </div>
            </div>
        `;
    }
    
    // Build complete question HTML
    const questionHTML = `
        <div class="review-question-item ${statusClass}">
            <div class="question-header">
                <div class="question-number">Question ${index + 1} of ${reviewQuestions.length}</div>
                <div class="question-status status-${status}">${statusText}</div>
            </div>
            
            <div class="question-text">${question.question}</div>
            
            <div class="review-options">
                ${optionsHTML}
            </div>
            
            ${feedbackHTML}
            ${explanationHTML}
            
            <div style="margin-top: 20px; font-size: 14px; color: #64748b; display: flex; justify-content: space-between;">
                <span><i class="fas fa-star"></i> Marks: ${question.marks || 1}</span>
                <span>Question ID: ${question.id || 'q' + (index + 1)}</span>
            </div>
        </div>
    `;
    
    document.getElementById('reviewQuestions').innerHTML = questionHTML;
    
    // Update navigation
    updateReviewNavigation();
    updateQuestionNavigationDots();
    
    // Update jump select
    document.getElementById('questionJumpSelect').value = index;
    
    // Scroll to top of questions
    document.getElementById('reviewQuestions').scrollTop = 0;
}

// Update review navigation buttons
function updateReviewNavigation() {
    const prevBtn = document.getElementById('prevReviewBtn');
    const nextBtn = document.getElementById('nextReviewBtn');
    
    if (prevBtn) prevBtn.disabled = currentReviewIndex === 0;
    if (nextBtn) nextBtn.disabled = currentReviewIndex === reviewQuestions.length - 1;
    
    if (reviewQuestions.length === 1) {
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
    } else {
        if (prevBtn) prevBtn.style.display = 'flex';
        if (nextBtn) nextBtn.style.display = 'flex';
    }
}

// Update question navigation dots
function updateQuestionNavigationDots() {
    const dots = document.querySelectorAll('.question-dot');
    dots.forEach((dot, index) => {
        dot.classList.remove('current');
        if (index === currentReviewIndex) {
            dot.classList.add('current');
        }
    });
}

// Show previous review question
function showPreviousReviewQuestion() {
    if (currentReviewIndex > 0) {
        showReviewQuestion(currentReviewIndex - 1);
    }
}

// Show next review question
function showNextReviewQuestion() {
    if (currentReviewIndex < reviewQuestions.length - 1) {
        showReviewQuestion(currentReviewIndex + 1);
    }
}

// Toggle question navigation sidebar
function toggleQuestionNavigation() {
    const nav = document.getElementById('questionNavigation');
    if (nav) {
        nav.classList.toggle('show');
    }
}

// Print review
function redirectToPrintReport() {
    if (!currentTest) {
        showToast('No test data available for printing', 'error');
        return;
    }
    
    // Prepare report data
    const reportData = {
        testData: currentTest.data,
        userAnswers: userAnswers,
        subject: currentTest.subject,
        testId: currentTest.testId,
        score: (score / currentTest.totalQuestions) * 100,
        totalQuestions: currentTest.totalQuestions,
        timeSpent: Math.floor((1800 - timeLeft) / 60) // Convert seconds to minutes
    };
    
    // Store data in localStorage
    localStorage.setItem('testReportData', JSON.stringify(reportData));
    
    // Calculate percentage for redirect parameters
    const percentage = (score / currentTest.totalQuestions) * 100;
    
    // Redirect to print report page
    const printUrl = `./printReport/printReport.html?subject=${encodeURIComponent(currentTest.subject)}&testId=${encodeURIComponent(currentTest.testId)}&score=${percentage.toFixed(1)}`;
    window.open(printUrl, '_blank');
}

// Update the printReview function to use redirect
function printReview() {
    redirectToPrintReport();
}

// Handle keyboard navigation in review
function handleReviewKeyboardNavigation(e) {
    const reviewModal = document.getElementById('reviewModal');
    if (!reviewModal || !reviewModal.classList.contains('show')) return;
    
    // Left arrow - previous question
    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        showPreviousReviewQuestion();
    }
    
    // Right arrow - next question
    if (e.key === 'ArrowRight') {
        e.preventDefault();
        showNextReviewQuestion();
    }
    
    // Number keys 1-9 - jump to question
    if (e.key >= '1' && e.key <= '9') {
        const num = parseInt(e.key);
        if (num <= reviewQuestions.length) {
            e.preventDefault();
            showReviewQuestion(num - 1);
        }
    }
    
    // Escape - close review
    if (e.key === 'Escape') {
        e.preventDefault();
        document.getElementById('reviewModal').classList.remove('show');
    }
    
    // Space - toggle navigation
    if (e.key === ' ' && e.ctrlKey) {
        e.preventDefault();
        toggleQuestionNavigation();
    }
}

// ========== ALL-IN-ONE REVIEW FUNCTIONALITY ==========

// Initialize all-in-one review
export function initAllInOneReview() {
    const retryBtn = document.getElementById('retryBtn');
    const closeBtn = document.getElementById('closeResultsBtn');
    
    // Create review all button
    const reviewAllBtn = document.createElement('button');
    reviewAllBtn.id = 'reviewAllBtn';
    reviewAllBtn.className = 'review-all-btn';
    reviewAllBtn.innerHTML = '<i class="fas fa-list-check"></i> Detailed Review';
    reviewAllBtn.style.cssText = `
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        border: none;
        padding: 16px;
        border-radius: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
    `;
    
    reviewAllBtn.addEventListener('mouseenter', () => {
        reviewAllBtn.style.transform = 'translateY(-2px)';
        reviewAllBtn.style.boxShadow = '0 8px 20px rgba(16, 185, 129, 0.3)';
    });
    
    reviewAllBtn.addEventListener('mouseleave', () => {
        reviewAllBtn.style.transform = 'translateY(0)';
        reviewAllBtn.style.boxShadow = 'none';
    });
    
    // Insert before close button
    if (closeBtn && closeBtn.parentNode) {
        closeBtn.parentNode.insertBefore(reviewAllBtn, closeBtn);
    }
    
    // Add click handler
    reviewAllBtn.addEventListener('click', () => {
        document.getElementById('resultsModal').classList.remove('show');
        showAllInOneReview();
    });
    
    // Initialize close buttons
    const closeReviewAllBtn = document.getElementById('closeReviewAllBtn');
    if (closeReviewAllBtn) {
        closeReviewAllBtn.addEventListener('click', () => {
            // handleNext()
            document.getElementById('reviewAllContainer').classList.remove('show');
             document.getElementById('resultsModal').classList.add('show');
        });
    }
    
    const closeReviewAllBtn2 = document.getElementById('closeReviewAllBtn2');
    if (closeReviewAllBtn2) {
        closeReviewAllBtn2.addEventListener('click', () => {
            document.getElementById('reviewAllContainer').classList.remove('show');
        });
    }
    
    // Print button
    const printReviewAllBtn = document.getElementById('printReviewAllBtn');
    if (printReviewAllBtn) {
        printReviewAllBtn.addEventListener('click', printAllReview);
    }
    
    // Download button
    const downloadReviewBtn = document.getElementById('downloadReviewBtn');
    if (downloadReviewBtn) {
        downloadReviewBtn.addEventListener('click', downloadReviewPDF);
    }
    
    // Scroll to top button
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    if (scrollToTopBtn) {
        scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
    
    // Show scroll to top button when scrolling
    window.addEventListener('scroll', toggleScrollToTop);
    
    // Add keyboard shortcut for closing review (Escape)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('reviewAllContainer').classList.contains('show')) {
            document.getElementById('reviewAllContainer').classList.remove('show');
        }
    });
}

// Show all-in-one review
function showAllInOneReview() {
    if (!currentTest) {
        console.error('No test data available for review');
        return;
    }
    
    // Prepare review data
    prepareReviewData();
    
    // Update subject info
    const reviewSubject = document.getElementById('reviewSubject');
    if (reviewSubject) {
        reviewSubject.textContent = 
            `Subject: ${currentTest.subject || 'N/A'} | Test: ${currentTest.testId || 'N/A'}`;
    }
    
    // Update print info
    const printSubject = document.getElementById('printSubject');
    const printTest = document.getElementById('printTest');
    const printDate = document.getElementById('printDate');
    
    if (printSubject) printSubject.textContent = currentTest.subject || 'N/A';
    if (printTest) printTest.textContent = currentTest.testId || 'N/A';
    if (printDate) printDate.textContent = new Date().toLocaleDateString();
    
    // Build review content
    buildAllInOneReviewContent();
    
    // Show review container
    document.getElementById('reviewAllContainer').classList.add('show');
    
    // Show quick stats bar after a delay
    setTimeout(() => {
        const quickStatsBar = document.getElementById('quickStatsBar');
        if (quickStatsBar) {
            quickStatsBar.classList.add('show');
        }
    }, 1000);
}

// Build all-in-one review content
function buildAllInOneReviewContent() {
    // Calculate statistics
    let correct = 0;
    let incorrect = 0;
    let skipped = 0;
    let totalMarks = 0;
    let obtainedMarks = 0;
    
    reviewQuestions.forEach((question, index) => {
        const userAnswer = userReviewAnswers[index];
        const correctAnswer = getCorrectAnswer(question);
        const marks = question.marks || 1;
        
        totalMarks += marks;
        
        if (!userAnswer) {
            skipped++;
        } else if (userAnswer === correctAnswer) {
            correct++;
            obtainedMarks += marks;
        } else {
            incorrect++;
        }
    });
    
    const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;
    const totalQuestions = reviewQuestions.length;
    
    // Build stats HTML
    const statsHTML = `
        <div class="review-stat-item">
            <div class="review-stat-value">${totalQuestions}</div>
            <div class="review-stat-label">Total Questions</div>
        </div>
        <div class="review-stat-item">
            <div class="review-stat-value">${correct}</div>
            <div class="review-stat-label">Correct</div>
        </div>
        <div class="review-stat-item">
            <div class="review-stat-value">${incorrect}</div>
            <div class="review-stat-label">Incorrect</div>
        </div>
        <div class="review-stat-item">
            <div class="review-stat-value">${skipped}</div>
            <div class="review-stat-label">Skipped</div>
        </div>
    `;
    
    const reviewAllStats = document.getElementById('reviewAllStats');
    if (reviewAllStats) {
        reviewAllStats.innerHTML = statsHTML;
    }
    
    // Build summary card
    const summaryHTML = `
        <h3><i class="fas fa-trophy"></i> Performance Summary</h3>
        <div class="review-score-circle">
            <div class="review-score-percent">${percentage.toFixed(1)}%</div>
            <div class="review-score-label">Score</div>
        </div>
        <div class="review-answers-summary">
            <div class="review-summary-item correct">
                <div class="review-summary-value">${correct}</div>
                <div class="review-summary-label">Correct Answers</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                    ${((correct / totalQuestions) * 100).toFixed(1)}% of total
                </div>
            </div>
            <div class="review-summary-item incorrect">
                <div class="review-summary-value">${incorrect}</div>
                <div class="review-summary-label">Incorrect Answers</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                    ${((incorrect / totalQuestions) * 100).toFixed(1)}% of total
                </div>
            </div>
            <div class="review-summary-item skipped">
                <div class="review-summary-value">${skipped}</div>
                <div class="review-summary-label">Skipped Questions</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                    ${((skipped / totalQuestions) * 100).toFixed(1)}% of total
                </div>
            </div>
        </div>
        <div style="margin-top: 20px; font-size: 14px; color: #475569; display:flex; justify-content:center; gap:10px">
            <p><strong>Marks:</strong> ${obtainedMarks}/${totalMarks} (${percentage.toFixed(1)}%)</p>
            <p><strong>Time Spent:</strong> ${formatTimeSpent()}</p>
            <p><strong>Accuracy:</strong> ${correct > 0 ? ((correct / (correct + incorrect)) * 100).toFixed(1) : 0}%</p>
        </div>
    `;
    
    const reviewSummaryCard = document.getElementById('reviewSummaryCard');
    if (reviewSummaryCard) {
        reviewSummaryCard.innerHTML = summaryHTML;
    }
    
    // Build all questions
    const questionsHTML = reviewQuestions.map((question, index) => {
        return buildQuestionReviewHTML(question, index);
    }).join('');
    
    const reviewAllQuestions = document.getElementById('reviewAllQuestions');
    if (reviewAllQuestions) {
        reviewAllQuestions.innerHTML = questionsHTML;
    }
    
    // Build quick stats bar
    const quickStatsHTML = `
        <div class="quick-stat correct">
            <div class="quick-stat-icon">
                <i class="fas fa-check"></i>
            </div>
            <span>${correct} Correct</span>
        </div>
        <div class="quick-stat incorrect">
            <div class="quick-stat-icon">
                <i class="fas fa-times"></i>
            </div>
            <span>${incorrect} Incorrect</span>
        </div>
        <div class="quick-stat skipped">
            <div class="quick-stat-icon">
                <i class="fas fa-question"></i>
            </div>
            <span>${skipped} Skipped</span>
        </div>
        <div class="quick-stat score">
            <div class="quick-stat-icon">
                <i class="fas fa-star"></i>
            </div>
            <span>${percentage.toFixed(1)}% Score</span>
        </div>
    `;
    
    const quickStatsBar = document.getElementById('quickStatsBar');
    if (quickStatsBar) {
        quickStatsBar.innerHTML = quickStatsHTML;
    }
}

// Build individual question review HTML
function buildQuestionReviewHTML(question, index) {
    const userAnswer = userReviewAnswers[index];
    const correctAnswer = getCorrectAnswer(question);
    
    // Determine question status
    let status = '';
    let statusClass = '';
    let statusText = '';
    let badgeClass = '';
    
    if (!userAnswer) {
        status = 'skipped';
        statusClass = 'skipped';
        statusText = 'Skipped';
        badgeClass = 'badge-skipped';
    } else if (userAnswer === correctAnswer) {
        status = 'correct';
        statusClass = 'correct';
        statusText = 'Correct';
        badgeClass = 'badge-correct';
    } else {
        status = 'incorrect';
        statusClass = 'incorrect';
        statusText = 'Incorrect';
        badgeClass = 'badge-incorrect';
    }
    
    // Get options
    let options = {};
    if (question.options && typeof question.options === 'object') {
        options = question.options;
    } else if (question.option1 && question.option2 && question.option3 && question.option4) {
        options = {
            "A": question.option1,
            "B": question.option2,
            "C": question.option3,
            "D": question.option4
        };
    }
    
    // Build options HTML
    let optionsHTML = '';
    Object.keys(options).forEach(key => {
        const isUserSelected = userAnswer === key.toUpperCase();
        const isCorrectAnswer = correctAnswer === key.toUpperCase();
        
        let optionClass = 'review-option-all';
        
        if (isUserSelected && isCorrectAnswer) {
            optionClass += ' user-answer correct-answer';
        } else if (isUserSelected && !isCorrectAnswer) {
            optionClass += ' user-answer incorrect-answer';
        } else if (!isUserSelected && isCorrectAnswer) {
            optionClass += ' correct-answer';
        } else if (isUserSelected) {
            optionClass += ' user-answer';
        }
        
        optionsHTML += `
            <div class="${optionClass}">
                <div class="option-indicator-all">${key.toUpperCase()}</div>
                <div class="option-text-all">${options[key]}</div>
                <div class="option-icons">
                    ${isUserSelected ? '<div class="option-icon user" title="Your Answer"><i class="fas fa-user"></i></div>' : ''}
                    ${isCorrectAnswer ? '<div class="option-icon correct" title="Correct Answer"><i class="fas fa-check"></i></div>' : ''}
                    ${isUserSelected && !isCorrectAnswer ? '<div class="option-icon incorrect" title="Incorrect Answer"><i class="fas fa-times"></i></div>' : ''}
                </div>
            </div>
        `;
    });
    
    // Build feedback HTML
    let feedbackHTML = '';
    if (userAnswer) {
        if (userAnswer === correctAnswer) {
            feedbackHTML = `
                <div class="answer-feedback-all">
                    <div class="feedback-header-all">
                        <i class="fas fa-check-circle" style="color: #10b981;"></i>
                        <span>Correct Answer!</span>
                    </div>
                    <div class="feedback-text-all">
                        You selected the correct option <strong>${userAnswer}</strong>.
                        <br>Marks awarded: <strong>${question.marks || 1}</strong>
                    </div>
                </div>
            `;
        } else {
            feedbackHTML = `
                <div class="answer-feedback-all">
                    <div class="feedback-header-all">
                        <i class="fas fa-times-circle" style="color: #ef4444;"></i>
                        <span>Incorrect Answer</span>
                    </div>
                    <div class="feedback-text-all">
                        You selected <strong>${userAnswer}</strong>. The correct answer is <strong>${correctAnswer}</strong>.
                        <br>Correct answer: <strong>${options[correctAnswer.toLowerCase()] || 'N/A'}</strong>
                    </div>
                </div>
            `;
        }
    } else {
        feedbackHTML = `
            <div class="answer-feedback-all">
                <div class="feedback-header-all">
                    <i class="fas fa-question-circle" style="color: #f59e0b;"></i>
                    <span>Not Answered</span>
                </div>
                <div class="feedback-text-all">
                    You did not answer this question.
                    <br>Correct answer: <strong>${correctAnswer}</strong> - ${options[correctAnswer.toLowerCase()] || 'N/A'}
                </div>
            </div>
        `;
    }
    
    // Build explanation HTML if available
    let explanationHTML = '';
    if (question.explanation) {
        explanationHTML = `
            <div class="explanation-all">
                <h4><i class="fas fa-lightbulb"></i> Explanation</h4>
                <div class="explanation-content-all">${question.explanation}</div>
            </div>
        `;
    }
    
    return `
        <div class="review-all-question ${statusClass}" id="reviewQuestion${index}">
            <div class="question-header-review">
                <div class="question-number-review">
                    <span>Q${index + 1}</span>
                    <div class="question-status-badge ${badgeClass}">${statusText}</div>
                </div>
                <div class="question-marks-review">
                    <i class="fas fa-star"></i>
                    <span>${question.marks || 1} mark${question.marks === 1 ? '' : 's'}</span>
                </div>
            </div>
            
            <div class="question-text-review">${question.question}</div>
            
            <div class="review-options-all">
                ${optionsHTML}
            </div>
            
            ${feedbackHTML}
            ${explanationHTML}
        </div>
    `;
}

// Format time spent
function formatTimeSpent() {
    const spentSeconds = 1800 - timeLeft;
    const minutes = Math.floor(spentSeconds / 60);
    const seconds = spentSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Print all review
function printAllReview() {
    redirectToPrintReport();
}

// Download review as PDF (simplified version using print)
function downloadReviewPDF() {
    showToast('Preparing PDF download...', 'info');
    
    // Create a print version and trigger print dialog
    printAllReview();
    
    // In a real implementation, you would use a PDF generation library like jsPDF
    // This is a simplified version that just opens the print dialog
}

// Toggle scroll to top button
function toggleScrollToTop() {
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    if (scrollToTopBtn) {
        if (window.scrollY > 500) {
            scrollToTopBtn.classList.add('show');
        } else {
            scrollToTopBtn.classList.remove('show');
        }
    }
}

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
    
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    
    .prev-btn {
      background: #e2e8f0;
      color: #1e293b;
      border: none;
      padding: 16px 24px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .prev-btn:hover:not(:disabled) {
      background: #818cf8;
      color: white;
    }
    
    .prev-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;
  document.head.appendChild(style);
}

// Add event listeners for results modal buttons
document.addEventListener('DOMContentLoaded', () => {
  // Retry button in results modal
  const retryBtn = document.getElementById('retryBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      if (currentTest) {
        startTest(currentTest.data, currentTest.subject, currentTest.testId);
        document.getElementById('resultsModal').classList.remove('show');
      }
    });
  }
  
  // Close results button
  const closeResultsBtn = document.getElementById('closeResultsBtn');
  if (closeResultsBtn) {
    closeResultsBtn.addEventListener('click', () => {
        location.reload();
      document.getElementById('resultsModal').classList.remove('show');
    });
  }
});



async function updateLeaderboard(user, testData, score, timeSpent) {
    try {
        console.log('Updating leaderboard for:', {
            user: user.uid,
            subject: currentTest.subject,
            testId: currentTest.testId,
            score: score,
            timeSpent: timeSpent
        });
        
        // Prepare leaderboard entry
        const leaderboardEntry = {
            userId: user.uid,
            userName: user.displayName || 'Anonymous',
            score: parseFloat(score.toFixed(2)), // Ensure 2 decimal places
            timeSpent: timeSpent,
            timestamp: new Date(),
            subject: currentTest.subject,
            testId: currentTest.testId
        };
        
        // Check if user already has an entry
        const existingEntryRef = doc(db, 'leaderboard', currentTest.subject, currentTest.testId, user.uid);
        const existingEntry = await getDoc(existingEntryRef);
        
        if (existingEntry.exists()) {
            const existingData = existingEntry.data();
            
            console.log('Existing entry found:', existingData);
            
            // Compare scores - only update if new score is better
            if (score > existingData.score) {
                // New score is better, update
                console.log('New score is better, updating...');
                await setDoc(existingEntryRef, leaderboardEntry);
            } else if (Math.abs(score - existingData.score) < 0.01) {
                // Scores are equal (within 0.01), check time
                if (timeSpent < existingData.timeSpent) {
                    // New time is better, update
                    console.log('Same score but better time, updating...');
                    await setDoc(existingEntryRef, leaderboardEntry);
                } else {
                    console.log('Same score and same/worse time, keeping existing entry');
                }
            } else {
                console.log('Existing score is better, keeping:', existingData.score);
            }
        } else {
            // First entry for this user, create new
            console.log('No existing entry, creating new...');
            await setDoc(existingEntryRef, leaderboardEntry);
        }
        
        console.log('Leaderboard updated successfully');
        
    } catch (error) {
        console.error('Error updating leaderboard:', error);
        // Don't show error to user, just log it
    }
}