"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionManager = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class SessionManager {
    constructor(logger, api) {
        this.logger = logger;
        this.api = api;
        this.currentSession = null;
        this.inactivityTimer = null;
        this.offlineQueue = [];
        this.INACTIVITY_TIMEOUT = 7 * 60 * 1000; // 7 minutes in milliseconds
        this.PERIODIC_SYNC_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds
        this.HEARTBEAT_INTERVAL = 30 * 1000; // 30 seconds in milliseconds
        this.heartbeatTimer = null;
        this.periodicSyncTimer = null;
        this.isOnline = true;
        this.subscriptions = [];
        this.lastActiveFile = null;
        this.keystrokeCount = 0;
        this.sessionId = '';
        this.lastSyncTime = 0;
        this.pendingSessionUpdate = false;
        // Create offline storage directory
        this.offlineStoragePath = path.join(os.homedir(), '.codingcam', 'offline-sessions');
        if (!fs.existsSync(this.offlineStoragePath)) {
            fs.mkdirSync(this.offlineStoragePath, { recursive: true });
        }
        // Load any existing offline sessions
        this.loadOfflineSessions();
        // Setup event handlers
        this.setupEventHandlers();
        // Setup auto-save for unexpected shutdowns
        this.setupAutoSave();
    }
    /**
     * Initialize the session manager
     */
    initialize() {
        this.logger.info('Initializing Session Manager');
        this.checkConnectionStatus();
        this.syncOfflineSessions();
        // Check for unfinished sessions from previous runs
        this.recoverUnfinishedSessions();
    }
    /**
     * Look for any unfinished sessions from previous runs
     */
    async recoverUnfinishedSessions() {
        try {
            const currentSessionPath = path.join(this.offlineStoragePath, 'current_session.json');
            if (fs.existsSync(currentSessionPath)) {
                this.logger.info('Found unfinished session from previous run, recovering');
                try {
                    const content = fs.readFileSync(currentSessionPath, 'utf8');
                    const sessionData = JSON.parse(content);
                    // Mark the session as ended at the time of the last save
                    sessionData.endTime = sessionData.lastActive;
                    sessionData.totalDuration = Math.floor((sessionData.lastActive - sessionData.startTime) / 1000);
                    // Prepare session payload
                    const payload = this.prepareActivityPayload(sessionData);
                    this.logger.info(`Recovered unfinished session ${sessionData.id}, duration: ${sessionData.totalDuration}s`);
                    // Add a small delay to ensure the backend has started
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    if (this.isOnline) {
                        try {
                            this.logger.info(`Sending recovered session ${sessionData.id} to backend`);
                            await this.sendSessionToBackend(payload);
                            this.logger.info(`Successfully sent recovered session ${sessionData.id}`);
                        }
                        catch (error) {
                            this.logger.error(`Failed to send recovered session, queueing for later: ${error}`);
                            this.queueOfflineSession(payload);
                        }
                    }
                    else {
                        this.logger.info(`Offline, queueing recovered session ${sessionData.id} for later sync`);
                        this.queueOfflineSession(payload);
                    }
                    // Remove the recovered session file
                    try {
                        fs.unlinkSync(currentSessionPath);
                    }
                    catch (e) {
                        this.logger.error(`Failed to delete recovered session file: ${e}`);
                    }
                }
                catch (error) {
                    this.logger.error(`Failed to recover unfinished session: ${error}`);
                    // If recovery fails, just delete the file to avoid future issues
                    try {
                        fs.unlinkSync(currentSessionPath);
                    }
                    catch (e) {
                        this.logger.error(`Failed to delete corrupted session file: ${e}`);
                    }
                }
            }
        }
        catch (error) {
            this.logger.error(`Error recovering unfinished sessions: ${error}`);
        }
    }
    /**
     * Setup auto-save to handle unexpected shutdowns
     */
    setupAutoSave() {
        // Save current session state periodically
        setInterval(() => {
            this.saveCurrentSession(false, false);
        }, 10000); // Every 10 seconds
        // Register for VS Code exit event if possible
        if (vscode.workspace) {
            // Use process events to detect shutdown
            process.on('exit', () => {
                this.logger.info('VS Code is shutting down, saving current session');
                this.saveCurrentSession(true, true);
            });
            process.on('SIGINT', () => {
                this.logger.info('VS Code is being interrupted, saving current session');
                this.saveCurrentSession(true, true);
            });
            process.on('SIGTERM', () => {
                this.logger.info('VS Code is being terminated, saving current session');
                this.saveCurrentSession(true, true);
            });
        }
    }
    /**
     * Start a new coding session
     */
    startSession() {
        if (this.currentSession) {
            this.logger.debug('Session already in progress');
            return;
        }
        this.sessionId = this.generateSessionId();
        this.currentSession = {
            id: this.sessionId,
            startTime: Date.now(),
            endTime: null,
            files: {},
            totalDuration: 0,
            languageBreakdown: {},
            idle: false,
            lastActive: Date.now(),
            isOffline: !this.isOnline
        };
        this.logger.info(`Started new coding session: ${this.sessionId}`);
        this.lastSyncTime = Date.now();
        // Start the heartbeat timer to periodically update the session
        this.startHeartbeatTimer();
        // Start periodic sync timer
        this.startPeriodicSyncTimer();
        // Reset the inactivity timer
        this.resetInactivityTimer();
        // Save the session state immediately
        this.saveCurrentSession();
    }
    /**
     * End the current session and send to backend
     */
    endSession(isForced = false) {
        if (!this.currentSession) {
            return;
        }
        const now = Date.now();
        this.currentSession.endTime = now;
        this.currentSession.totalDuration = Math.floor((now - this.currentSession.startTime) / 1000);
        this.logger.info(`Ending session ${this.currentSession.id}, duration: ${this.currentSession.totalDuration}s, forced: ${isForced}`);
        // Stop timers
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        if (this.periodicSyncTimer) {
            clearInterval(this.periodicSyncTimer);
            this.periodicSyncTimer = null;
        }
        // Prepare session for sending to backend
        const payload = this.prepareActivityPayload(this.currentSession);
        // If offline, queue the session, otherwise send it
        if (!this.isOnline) {
            this.queueOfflineSession(payload);
        }
        else {
            this.logger.info(`Sending final session data to backend for ${this.currentSession.id}`);
            this.sendSessionToBackend(payload)
                .catch(error => {
                this.logger.error(`Failed to send session to backend, queueing for later: ${error}`);
                this.queueOfflineSession(payload);
            });
        }
        // Clean up the current session file
        try {
            const currentSessionPath = path.join(this.offlineStoragePath, 'current_session.json');
            if (fs.existsSync(currentSessionPath)) {
                fs.unlinkSync(currentSessionPath);
            }
        }
        catch (e) {
            // Ignore errors when deleting
        }
        // Clear current session
        this.currentSession = null;
        this.keystrokeCount = 0;
        this.lastActiveFile = null;
        this.pendingSessionUpdate = false;
    }
    /**
     * Record activity in the current file
     */
    recordActivity(filePath, language, lineCount, isWrite = false) {
        if (!this.currentSession) {
            this.startSession();
        }
        // Reset inactivity timer since there's activity
        this.resetInactivityTimer();
        if (this.currentSession.idle) {
            this.currentSession.idle = false;
            this.logger.debug('Resumed from idle state');
        }
        // Update last active timestamp
        this.currentSession.lastActive = Date.now();
        // Update file activity
        if (!this.currentSession.files[filePath]) {
            this.currentSession.files[filePath] = {
                edits: 0,
                duration: 0,
                language,
                lines: lineCount,
                keystrokes: 0
            };
        }
        // Record an edit if it's a write operation
        if (isWrite) {
            this.currentSession.files[filePath].edits++;
            this.pendingSessionUpdate = true;
        }
        // Update language breakdown
        if (!this.currentSession.languageBreakdown[language]) {
            this.currentSession.languageBreakdown[language] = 0;
        }
        // Track active file change
        if (this.lastActiveFile !== filePath) {
            // If there was a previously active file, add the time spent there
            if (this.lastActiveFile && this.currentSession.files[this.lastActiveFile]) {
                // Add time since last file was active
                const timeSinceLastFile = Math.floor((Date.now() - this.currentSession.lastActive) / 1000);
                this.currentSession.files[this.lastActiveFile].duration += timeSinceLastFile;
                // Add to language breakdown
                const lastFileLanguage = this.currentSession.files[this.lastActiveFile].language;
                this.currentSession.languageBreakdown[lastFileLanguage] += timeSinceLastFile;
                this.pendingSessionUpdate = true;
            }
            this.lastActiveFile = filePath;
        }
        // Update file lines
        this.currentSession.files[filePath].lines = lineCount;
    }
    /**
     * Record keystrokes for the active file
     */
    recordKeystroke(filePath) {
        if (!this.currentSession || !filePath) {
            return;
        }
        // Reset inactivity timer
        this.resetInactivityTimer();
        // Update keystrokes for the file
        if (this.currentSession.files[filePath]) {
            this.currentSession.files[filePath].keystrokes++;
            this.keystrokeCount++;
            this.pendingSessionUpdate = true;
        }
    }
    /**
     * Mark session as idle
     */
    markAsIdle() {
        if (!this.currentSession) {
            return;
        }
        this.currentSession.idle = true;
        this.logger.debug('Session marked as idle due to inactivity');
    }
    /**
     * Reset the inactivity timer
     */
    resetInactivityTimer() {
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
        }
        this.inactivityTimer = setTimeout(() => {
            this.markAsIdle();
            // End session after reaching the inactivity timeout
            this.endSession();
        }, this.INACTIVITY_TIMEOUT);
    }
    /**
     * Start heartbeat timer to update session periodically - only local updates
     */
    startHeartbeatTimer() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }
        this.heartbeatTimer = setInterval(() => {
            this.updateLocalSessionState();
        }, this.HEARTBEAT_INTERVAL);
    }
    /**
     * Update local session state without sending any data to backend
     */
    updateLocalSessionState() {
        if (!this.currentSession || this.currentSession.idle) {
            return;
        }
        // Calculate current duration
        const currentDuration = Math.floor((Date.now() - this.currentSession.startTime) / 1000);
        // Update session duration
        this.currentSession.totalDuration = currentDuration;
        // Only log in debug mode to reduce noise
        this.logger.debug(`Session local update: ${this.currentSession.id}, duration: ${currentDuration}s`);
        // Check if we need to end the session due to long inactivity
        const inactivityTime = Date.now() - this.currentSession.lastActive;
        if (inactivityTime > this.INACTIVITY_TIMEOUT) {
            this.logger.debug(`Ending session due to inactivity (${Math.floor(inactivityTime / 1000)}s)`);
            this.endSession();
        }
        // Save current session state locally only
        this.saveCurrentSession(false, false);
    }
    /**
     * Start periodic sync timer to send session updates every 10 minutes
     */
    startPeriodicSyncTimer() {
        if (this.periodicSyncTimer) {
            clearInterval(this.periodicSyncTimer);
        }
        this.periodicSyncTimer = setInterval(() => {
            this.periodicSessionSync();
        }, this.PERIODIC_SYNC_INTERVAL);
    }
    /**
     * Send session update to backend every 10 minutes
     */
    periodicSessionSync() {
        if (!this.currentSession || this.currentSession.idle || !this.pendingSessionUpdate) {
            return;
        }
        const now = Date.now();
        const timeSinceLastSync = now - this.lastSyncTime;
        // Only sync if it's been 10 minutes since last sync and there are meaningful updates
        if (timeSinceLastSync >= this.PERIODIC_SYNC_INTERVAL && this.pendingSessionUpdate) {
            this.logger.info(`Performing 10-minute periodic sync for session ${this.currentSession.id}`);
            // Create a snapshot of the current session
            const sessionSnapshot = {
                ...this.currentSession,
                endTime: now, // Set temporary end time
                totalDuration: Math.floor((now - this.currentSession.startTime) / 1000)
            };
            // Prepare and send the snapshot
            const payload = this.prepareActivityPayload(sessionSnapshot);
            // Add a flag to indicate this is a periodic update
            payload.is_periodic_update = true;
            if (this.isOnline) {
                this.sendSessionToBackend(payload)
                    .then(() => {
                    this.logger.info(`Successfully sent periodic session update for ${this.currentSession.id}`);
                    this.lastSyncTime = now;
                    this.pendingSessionUpdate = false;
                })
                    .catch(error => {
                    this.logger.error(`Failed to send periodic session update: ${error}`);
                });
            }
            else {
                // If offline, queue the session update and reset the flag
                this.queueOfflineSession(payload);
                this.lastSyncTime = now;
                this.pendingSessionUpdate = false;
            }
        }
    }
    /**
     * Save current session to disk for recovery in case of unexpected shutdown
     */
    saveCurrentSession(isShutdown = false, shouldSendToBackend = false) {
        if (!this.currentSession) {
            return;
        }
        try {
            const currentSessionPath = path.join(this.offlineStoragePath, 'current_session.json');
            fs.writeFileSync(currentSessionPath, JSON.stringify(this.currentSession, null, 2));
            if ((isShutdown || shouldSendToBackend) && this.currentSession) {
                // If VS Code is shutting down or we explicitly want to send to backend
                const now = Date.now();
                this.currentSession.endTime = now;
                this.currentSession.totalDuration = Math.floor((now - this.currentSession.startTime) / 1000);
                const payload = this.prepareActivityPayload(this.currentSession);
                if (this.isOnline) {
                    // Try to send data
                    try {
                        // Use axios directly instead of fetch
                        this.api.sendSessionData(payload);
                    }
                    catch (e) {
                        // If send fails, just queue it - it will be recovered on next startup
                        this.queueOfflineSession(payload);
                    }
                }
                else {
                    this.queueOfflineSession(payload);
                }
            }
        }
        catch (error) {
            this.logger.error(`Failed to save current session: ${error}`);
        }
    }
    /**
     * Check if the backend is reachable
     */
    async checkConnectionStatus() {
        try {
            const isConnected = await this.api.verifyConnection();
            // If connection status changed
            if (this.isOnline !== isConnected) {
                this.isOnline = isConnected;
                if (isConnected) {
                    this.logger.info('Connection to backend restored');
                    // Try to sync offline sessions
                    this.syncOfflineSessions();
                }
                else {
                    this.logger.info('Connection to backend lost, activating offline mode');
                }
            }
        }
        catch (error) {
            // If error occurs, assume offline
            if (this.isOnline) {
                this.isOnline = false;
                this.logger.info('Connection to backend lost, activating offline mode');
            }
        }
        // Check again in 5 minutes (reduced from every minute)
        setTimeout(() => this.checkConnectionStatus(), 5 * 60 * 1000);
    }
    /**
     * Queue a session for offline storage
     */
    queueOfflineSession(payload) {
        this.offlineQueue.push(payload);
        this.saveOfflineSession(payload);
        this.logger.info(`Saved session ${payload.session_id} to offline storage`);
    }
    /**
     * Save a session to offline storage
     */
    saveOfflineSession(payload) {
        try {
            const filePath = path.join(this.offlineStoragePath, `${payload.session_id}.json`);
            fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
        }
        catch (error) {
            this.logger.error(`Failed to save offline session: ${error}`);
        }
    }
    /**
     * Load offline sessions from storage
     */
    loadOfflineSessions() {
        try {
            if (!fs.existsSync(this.offlineStoragePath)) {
                return;
            }
            const files = fs.readdirSync(this.offlineStoragePath);
            for (const file of files) {
                if (file.endsWith('.json') && file !== 'current_session.json') {
                    try {
                        const filePath = path.join(this.offlineStoragePath, file);
                        const content = fs.readFileSync(filePath, 'utf8');
                        const payload = JSON.parse(content);
                        this.offlineQueue.push(payload);
                    }
                    catch (e) {
                        this.logger.error(`Error loading offline session ${file}: ${e}`);
                    }
                }
            }
            this.logger.info(`Loaded ${this.offlineQueue.length} offline sessions`);
        }
        catch (error) {
            this.logger.error(`Failed to load offline sessions: ${error}`);
        }
    }
    /**
     * Sync offline sessions to the backend
     */
    async syncOfflineSessions() {
        if (!this.isOnline || this.offlineQueue.length === 0) {
            return;
        }
        this.logger.info(`Attempting to sync ${this.offlineQueue.length} offline sessions`);
        // Create a copy of the queue to avoid modification during iteration
        const sessions = [...this.offlineQueue];
        for (const session of sessions) {
            try {
                await this.sendSessionToBackend(session);
                // Remove from queue
                const index = this.offlineQueue.indexOf(session);
                if (index > -1) {
                    this.offlineQueue.splice(index, 1);
                }
                // Remove offline storage file
                const filePath = path.join(this.offlineStoragePath, `${session.session_id}.json`);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                this.logger.info(`Successfully synced offline session ${session.session_id}`);
            }
            catch (error) {
                this.logger.error(`Failed to sync offline session ${session.session_id}: ${error}`);
                // If we get a 500 error, log details but continue with next session
                if (error instanceof Error && error.message.includes('500')) {
                    this.logger.error(`Backend server error (500) when syncing session ${session.session_id}`);
                    continue;
                }
                // For other errors, stop trying to sync
                break;
            }
        }
    }
    /**
     * Send a session to the backend
     */
    async sendSessionToBackend(payload) {
        try {
            // Make a few retries in case of server errors
            let retries = 3;
            let success = false;
            while (retries > 0 && !success) {
                try {
                    await this.api.sendSessionData(payload);
                    success = true;
                    this.logger.info(`Sent session ${payload.session_id} to backend`);
                }
                catch (error) {
                    retries--;
                    // If we got a 500 error, it might be temporary, so retry
                    if (error instanceof Error && error.message.includes('500')) {
                        // Wait a bit before retrying
                        this.logger.warn(`Got 500 error, retrying... (${retries} attempts left)`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                    else {
                        // For other errors, don't retry
                        throw error;
                    }
                }
            }
            if (!success) {
                throw new Error(`Failed to send session after ${3 - retries} retries`);
            }
        }
        catch (error) {
            this.logger.error(`Failed to send session to backend: ${error}`);
            if (!this.isOnline) {
                // If offline, queue it
                this.queueOfflineSession(payload);
            }
            throw error;
        }
    }
    /**
     * Prepare session data for sending to backend
     */
    prepareActivityPayload(session) {
        return {
            session_id: session.id,
            start_time: new Date(session.startTime).toISOString(),
            end_time: new Date(session.endTime || Date.now()).toISOString(),
            duration_seconds: session.totalDuration,
            files_count: Object.keys(session.files).length,
            languages: session.languageBreakdown,
            files: session.files,
            platform: os.platform(),
            editor: 'vscode',
            is_offline_sync: session.isOffline
        };
    }
    /**
     * Generate a unique session ID
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    }
    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        // We can't use window.addEventListener in VS Code extension,
        // so we'll use a periodic check for network connectivity
        setInterval(() => {
            this.checkConnectionStatus();
        }, 5 * 60 * 1000); // Check every 5 minutes (reduced from every minute)
        // Listen for text document changes
        this.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document && event.contentChanges.length > 0) {
                const filePath = event.document.uri.fsPath;
                this.recordActivity(filePath, event.document.languageId, event.document.lineCount, true // isWrite
                );
                // Count keystrokes
                this.recordKeystroke(filePath);
            }
        }));
        // Listen for active editor changes
        this.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && editor.document) {
                const filePath = editor.document.uri.fsPath;
                this.recordActivity(filePath, editor.document.languageId, editor.document.lineCount);
            }
        }));
        // Only track significant selection changes to reduce overhead
        let lastSelectionChangeTime = 0;
        const SELECTION_CHANGE_THROTTLE = 2000; // 2 seconds
        this.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(event => {
            const now = Date.now();
            if (now - lastSelectionChangeTime < SELECTION_CHANGE_THROTTLE) {
                return; // Skip if changed recently
            }
            lastSelectionChangeTime = now;
            if (event.textEditor && event.textEditor.document) {
                const filePath = event.textEditor.document.uri.fsPath;
                this.recordActivity(filePath, event.textEditor.document.languageId, event.textEditor.document.lineCount);
            }
        }));
    }
    /**
     * Dispose of resources
     */
    dispose() {
        if (this.currentSession) {
            this.endSession(true);
        }
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        if (this.periodicSyncTimer) {
            clearInterval(this.periodicSyncTimer);
            this.periodicSyncTimer = null;
        }
        // Dispose of all subscriptions
        this.subscriptions.forEach(sub => sub.dispose());
    }
}
exports.SessionManager = SessionManager;
//# sourceMappingURL=sessionManager.js.map