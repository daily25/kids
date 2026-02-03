/**
 * Firebase Configuration and Sync
 * Enables real-time sync between multiple devices
 */

const firebaseConfig = {
    apiKey: "AIzaSyBaD4fgoKAh5FW0xOQNwuwJ252ZAE3JE9Q",
    authDomain: "kids-tasks-57eeb.firebaseapp.com",
    databaseURL: "https://kids-tasks-57eeb-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "kids-tasks-57eeb",
    storageBucket: "kids-tasks-57eeb.firebasestorage.app",
    messagingSenderId: "701270795018",
    appId: "1:701270795018:web:2decf093e3a95e2c7f90f3"
};

// Firebase sync module
const FirebaseSync = (function () {
    let app = null;
    let database = null;
    let dataRef = null;
    let isInitialized = false;
    let isSyncing = false;
    let lastSyncTime = 0;
    let onDataChangeCallback = null;

    /**
     * Initialize Firebase
     */
    function init(onDataChange) {
        try {
            // Check if Firebase SDK is loaded
            if (typeof firebase === 'undefined') {
                console.log('Firebase SDK not loaded');
                return false;
            }

            // Initialize Firebase app
            if (!firebase.apps.length) {
                app = firebase.initializeApp(firebaseConfig);
            } else {
                app = firebase.apps[0];
            }

            database = firebase.database();
            dataRef = database.ref('kidsTasks');
            onDataChangeCallback = onDataChange;
            isInitialized = true;

            // Listen for remote changes
            dataRef.on('value', (snapshot) => {
                if (isSyncing) return; // Skip if we're the ones syncing

                const remoteData = snapshot.val();
                if (remoteData && onDataChangeCallback) {
                    const remoteTime = remoteData._lastUpdated || 0;

                    // Only update if remote is newer
                    if (remoteTime > lastSyncTime) {
                        console.log('Received remote update');
                        lastSyncTime = remoteTime;
                        onDataChangeCallback(remoteData);
                    }
                }
            });

            console.log('Firebase initialized successfully');
            return true;
        } catch (error) {
            console.error('Firebase init error:', error);
            return false;
        }
    }

    /**
     * Sync data to Firebase
     */
    function syncToCloud(data) {
        if (!isInitialized || !dataRef) {
            console.log('Firebase not initialized, skipping sync');
            return Promise.resolve(false);
        }

        isSyncing = true;
        lastSyncTime = Date.now();

        // Add timestamp to data
        const dataWithTimestamp = {
            ...data,
            _lastUpdated: lastSyncTime
        };

        return dataRef.set(dataWithTimestamp)
            .then(() => {
                console.log('Data synced to cloud');
                isSyncing = false;
                return true;
            })
            .catch((error) => {
                console.error('Sync error:', error);
                isSyncing = false;
                return false;
            });
    }

    /**
     * Load data from Firebase
     */
    function loadFromCloud() {
        if (!isInitialized || !dataRef) {
            return Promise.resolve(null);
        }

        return dataRef.once('value')
            .then((snapshot) => {
                const data = snapshot.val();
                if (data) {
                    lastSyncTime = data._lastUpdated || 0;
                }
                return data;
            })
            .catch((error) => {
                console.error('Load from cloud error:', error);
                return null;
            });
    }

    /**
     * Check if Firebase is connected
     */
    function isConnected() {
        return isInitialized;
    }

    /**
     * Get sync status indicator
     */
    function getSyncStatus() {
        return isInitialized ? 'connected' : 'offline';
    }

    return {
        init,
        syncToCloud,
        loadFromCloud,
        isConnected,
        getSyncStatus
    };
})();
