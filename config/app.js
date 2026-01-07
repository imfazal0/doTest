import { db, auth } from "../firebase/config.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// Cache for better performance
const cache = new Map();

export async function getData(collectionName) {
  try {
    const colRef = collection(db, collectionName);
    const snapshot = await getDocs(colRef);
    
    const tests = [];
    snapshot.forEach(doc => {
      tests.push({
        id: doc.id,
        name: doc.id,
        data: doc.data()
      });
    });
    
    return tests;
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error;
  }
}

export async function getDocument(coll_name, test_name) {
  try {
    const colRef = doc(db, coll_name, test_name);
    const docSnap = await getDoc(colRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return data;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting document:", error);
    throw error;
  }
}

// Save test results to Firestore
export async function saveTestResults(testData, userAnswers, score, subject, testId, timeSpent) {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('No user logged in');
      return null;
    }

    // Calculate percentage
    const totalQuestions = testData.length;
    const percentage = (score / totalQuestions) * 100;
    
    const testResult = {
      userId: user.uid,
      userName: user.displayName,
      userEmail: user.email,
      subject: subject,
      testId: testId,
      score: percentage,
      totalQuestions: totalQuestions,
      correctAnswers: score,
      timestamp: serverTimestamp(),
      userAnswers: userAnswers,
      questions: testData,
      timeSpent: timeSpent
    };

    // Save to localStorage for quick access
    const userResults = JSON.parse(localStorage.getItem('userTestResults') || '[]');
    userResults.unshift(testResult);
    localStorage.setItem('userTestResults', JSON.stringify(userResults.slice(0, 50))); // Keep last 50 tests

    // Save to Firestore
    const docRef = await addDoc(collection(db, "testResults"), testResult);
    console.log("Test result saved with ID: ", docRef.id);
    
    // Also store in localStorage for dashboard to use
    localStorage.setItem('lastTestResult', JSON.stringify(testResult));
    
    return docRef.id;
    
  } catch (error) {
    console.error("Error saving test results:", error);
    return null;
  }
}

// Get user's test history
export async function getUserTestHistory(userId, limit = 10) {
  try {
    const testResultsRef = collection(db, 'testResults');
    const q = query(
      testResultsRef,
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(limit)
    );
    
    const querySnapshot = await getDocs(q);
    const results = [];
    
    querySnapshot.forEach((doc) => {
      results.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return results;
    
  } catch (error) {
    console.error("Error getting user test history:", error);
    return [];
  }
}

// Helper to convert object to array
export function convertExamObjectToArray(examObject) {
  if (!examObject) return [];
  
  // If it's already an array, return it
  if (Array.isArray(examObject)) return examObject;
  
  // If it's a string, parse it
  if (typeof examObject === 'string') {
    try {
      examObject = JSON.parse(examObject);
    } catch (e) {
      console.error("Error parsing exam string:", e);
      return [];
    }
  }
  
  // Convert object with q1, q2, q3 keys to array
  const questionsArray = [];
  const keys = Object.keys(examObject).sort((a, b) => {
    // Sort by question number: q1, q2, q3, etc.
    const numA = parseInt(a.replace('q', '')) || 0;
    const numB = parseInt(b.replace('q', '')) || 0;
    return numA - numB;
  });
  
  keys.forEach(key => {
    if (examObject[key] && typeof examObject[key] === 'object') {
      questionsArray.push({
        ...examObject[key],
        id: key // Keep the original key (q1, q2, etc.)
      });
    }
  });
  
  return questionsArray;
}

// Clear cache function (optional)
export function clearCache() {
  cache.clear();
}