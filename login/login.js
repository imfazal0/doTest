import { auth, googleProvider, signInWithPopup, onAuthStateChanged } from '../firebase/config.js';

const googleLoginBtn = document.getElementById('googleLoginBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const loginError = document.getElementById('loginError');
const errorMessage = document.getElementById('errorMessage');

// Check if user is already logged in
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is already logged in, redirect to dashboard
        window.location.href = '../dashboard/dashboard.html';
    }
});

// Google Sign-In Handler
googleLoginBtn.addEventListener('click', async () => {
    try {
        loadingOverlay.classList.add('active');
        loginError.classList.remove('show');
        
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        
        // Store user info in localStorage for quick access
        localStorage.setItem('user', JSON.stringify({
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL
        }));
        
        // Redirect to dashboard
        window.location.href = '../dashboard/dashboard.html';
        
    } catch (error) {
        console.error('Login error:', error);
        
        // Handle specific error cases
        let message = 'Failed to sign in. Please try again.';
        
        switch (error.code) {
            case 'auth/popup-closed-by-user':
                message = 'Sign-in was cancelled. Please try again.';
                break;
            case 'auth/network-request-failed':
                message = 'Network error. Please check your connection.';
                break;
            case 'auth/popup-blocked':
                message = 'Popup was blocked. Please allow popups for this site.';
                break;
            case 'auth/unauthorized-domain':
                message = 'This domain is not authorized. Please contact support.';
                break;
        }
        
        errorMessage.textContent = message;
        loginError.classList.add('show');
        
    } finally {
        loadingOverlay.classList.remove('active');
    }
});

// Add keyboard shortcut (Enter) for login
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        googleLoginBtn.click();
    }
});