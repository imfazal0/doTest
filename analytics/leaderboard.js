// leaderboard.js
import { db } from "./firebase/config.js";
import { collection, getDocs, query, where, orderBy, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// Get leaderboard for a specific test
export async function getTestLeaderboard(subject, testId, limit = 50) {
    try {
        const leaderboardRef = collection(db, 'leaderboard', subject, testId);
        const q = query(leaderboardRef, orderBy('score', 'desc'), limit(limit));
        
        const querySnapshot = await getDocs(q);
        const leaderboard = [];
        
        querySnapshot.forEach((doc) => {
            leaderboard.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return leaderboard;
        
    } catch (error) {
        console.error('Error getting leaderboard:', error);
        return [];
    }
}

// Get user's position in leaderboard
export async function getUserRank(subject, testId, userId) {
    try {
        const leaderboardRef = collection(db, 'leaderboard', subject, testId);
        const q = query(leaderboardRef, orderBy('score', 'desc'));
        
        const querySnapshot = await getDocs(q);
        const leaderboard = [];
        
        querySnapshot.forEach((doc) => {
            leaderboard.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Find user's position
        const userIndex = leaderboard.findIndex(entry => entry.userId === userId);
        
        return userIndex >= 0 ? userIndex + 1 : null;
        
    } catch (error) {
        console.error('Error getting user rank:', error);
        return null;
    }
}

// Get top performers across all tests
export async function getTopPerformers(limit = 10) {
    try {
        // This would require a more complex query structure
        // For now, we can fetch from testResults collection
        const testResultsRef = collection(db, 'testResults');
        const q = query(testResultsRef, orderBy('score', 'desc'), limit(limit));
        
        const querySnapshot = await getDocs(q);
        const topPerformers = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            topPerformers.push({
                userName: data.userName,
                score: data.score,
                subject: data.subject,
                testId: data.testId,
                date: data.timestamp?.toDate() || new Date()
            });
        });
        
        return topPerformers;
        
    } catch (error) {
        console.error('Error getting top performers:', error);
        return [];
    }
}

// Calculate leaderboard statistics
export function calculateLeaderboardStats(leaderboardData) {
    if (!leaderboardData || leaderboardData.length === 0) {
        return {
            averageScore: 0,
            medianScore: 0,
            topScore: 0,
            totalParticipants: 0,
            scoreDistribution: []
        };
    }
    
    const scores = leaderboardData.map(entry => entry.score);
    const totalParticipants = leaderboardData.length;
    
    // Calculate average
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / totalParticipants;
    
    // Calculate median
    const sortedScores = [...scores].sort((a, b) => a - b);
    const medianScore = sortedScores[Math.floor(sortedScores.length / 2)];
    
    // Get top score
    const topScore = Math.max(...scores);
    
    // Calculate score distribution
    const scoreDistribution = {
        '90-100': scores.filter(score => score >= 90).length,
        '80-89': scores.filter(score => score >= 80 && score < 90).length,
        '70-79': scores.filter(score => score >= 70 && score < 80).length,
        '60-69': scores.filter(score => score >= 60 && score < 70).length,
        '50-59': scores.filter(score => score >= 50 && score < 60).length,
        '0-49': scores.filter(score => score < 50).length
    };
    
    return {
        averageScore,
        medianScore,
        topScore,
        totalParticipants,
        scoreDistribution
    };
}