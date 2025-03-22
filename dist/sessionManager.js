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
        this.HEARTBEAT_INTERVAL = 30 * 1000; // 30 seconds in milliseconds
        this.heartbeatTimer = null;
        this.isOnline = true;
        this.subscriptions = [];
        this.lastActiveFile = null;
        this.keystrokeCount = 0;
        this.sessionId = '';
        // Create offline storage directory
        this.offlineStoragePath = path.join(os.homedir(), '.codingcam', 'offline-sessions');
        if (!fs.existsSync(this.offlineStoragePath)) {
            fs.mkdirSync(this.offlineStoragePath, { recursive: true });
        }
        // Load any existing offline sessions
        this.loadOfflineSessions();
        // Setup event handlers
        this.setupEventHandlers();
    }
    /**
     * Initialize the session manager
     */
    initialize() {
        this.logger.info('Initializing Session Manager');
        this.checkConnectionStatus();
        this.syncOfflineSessions();
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
        // Start the heartbeat timer to periodically update the session
        this.startHeartbeatTimer();
        // Reset the inactivity timer
        this.resetInactivityTimer();
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
        // Prepare session for sending to backend
        const payload = this.prepareActivityPayload(this.currentSession);
        // If offline, queue the session, otherwise send it
        if (!this.isOnline) {
            this.queueOfflineSession(payload);
        }
        else {
            this.sendSessionToBackend(payload);
        }
        // Clear current session
        this.currentSession = null;
        this.keystrokeCount = 0;
        this.lastActiveFile = null;
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
     * Start heartbeat timer to update session periodically
     */
    startHeartbeatTimer() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }
        this.heartbeatTimer = setInterval(() => {
            this.sendHeartbeat();
        }, this.HEARTBEAT_INTERVAL);
    }
    /**
     * Send a heartbeat to update the session
     */
    sendHeartbeat() {
        if (!this.currentSession || this.currentSession.idle) {
            return;
        }
        // Calculate current duration
        const currentDuration = Math.floor((Date.now() - this.currentSession.startTime) / 1000);
        // Update session duration
        this.currentSession.totalDuration = currentDuration;
        // Log heartbeat
        this.logger.debug(`Session heartbeat: ${this.currentSession.id}, duration: ${currentDuration}s`);
        // Check if we need to end the session due to long inactivity
        const inactivityTime = Date.now() - this.currentSession.lastActive;
        if (inactivityTime > this.INACTIVITY_TIMEOUT) {
            this.logger.debug(`Ending session due to inactivity (${Math.floor(inactivityTime / 1000)}s)`);
            this.endSession();
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
        // Check again in 1 minute
        setTimeout(() => this.checkConnectionStatus(), 60000);
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
                if (file.endsWith('.json')) {
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
                // Stop trying to sync if we have a connection error
                break;
            }
        }
    }
    /**
     * Send a session to the backend
     */
    async sendSessionToBackend(payload) {
        try {
            // We'll implement this in the API class
            await this.api.sendSessionData(payload);
            this.logger.info(`Sent session ${payload.session_id} to backend`);
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
        }, 60000); // Check every minute
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
        // Listen for text selection changes
        this.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(event => {
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
        // Dispose of all subscriptions
        this.subscriptions.forEach(sub => sub.dispose());
    }
}
exports.SessionManager = SessionManager;
//# sourceMappingURL=sessionManager.js.map