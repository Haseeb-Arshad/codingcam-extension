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
exports.CodingCam = void 0;
const child_process = __importStar(require("child_process"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const constants_1 = require("./constants");
const options_1 = require("./options");
const desktop_1 = require("./desktop");
const utils_1 = require("./utils");
const sessionManager_1 = require("./sessionManager");
class CodingCam {
    constructor(extensionPath, logger, api) {
        this.agentName = '';
        this.statusBar = undefined;
        this.statusBarTeamYou = undefined;
        this.statusBarTeamOther = undefined;
        this.lastFile = '';
        this.lastHeartbeat = 0;
        this.lastDebug = false;
        this.lastCompile = false;
        this.dedupe = {};
        this.debounceTimeoutId = null;
        this.debounceMs = 50;
        this.fetchTodayInterval = 60000;
        this.lastFetchToday = 0;
        this.showStatusBar = false;
        this.showCodingActivity = false;
        this.showStatusBarTeam = false;
        this.hasTeamFeatures = false;
        this.disabled = true;
        this.isCompiling = false;
        this.isDebugging = false;
        this.currentlyFocusedFile = '';
        this.teamDevsForFileCache = {};
        this.resourcesLocation = '';
        this.lastApiKeyPrompted = 0;
        this.isMetricsEnabled = false;
        this.sessionManager = null;
        this.extensionPath = extensionPath;
        this.logger = logger;
        this.api = api;
        this.setResourcesLocation();
        this.options = new options_1.Options(logger, this.resourcesLocation);
    }
    initialize() {
        this.options.getSetting('settings', 'debug', false, (setting) => {
            if (setting.value === 'true') {
                this.logger.setLevel(constants_1.LogLevel.DEBUG);
            }
            this.options.getSetting('settings', 'metrics', false, (metrics) => {
                if (metrics.value === 'true') {
                    this.isMetricsEnabled = true;
                }
                let extension = vscode.extensions.getExtension('snipxt-dev.codingcam-tracker');
                this.extension = (extension != undefined && extension.packageJSON) || { version: '0.0.0' };
                this.agentName = utils_1.Utils.getEditorName();
                this.options.getSetting('settings', 'disabled', false, (disabled) => {
                    this.disabled = disabled.value === 'true';
                    if (this.disabled) {
                        this.dispose();
                        return;
                    }
                    this.initializeDependencies();
                    // Initialize session manager
                    this.sessionManager = new sessionManager_1.SessionManager(this.logger, this.api);
                    this.sessionManager.initialize();
                });
            });
        });
    }
    dispose() {
        // Dispose session manager if it exists
        if (this.sessionManager) {
            this.sessionManager.dispose();
            this.sessionManager = null;
        }
        this.statusBar?.dispose();
        this.statusBarTeamYou?.dispose();
        this.statusBarTeamOther?.dispose();
        this.disposable?.dispose();
    }
    setResourcesLocation() {
        const home = desktop_1.Desktop.getHomeDirectory();
        const folder = path.join(home, '.codingcam');
        try {
            fs.mkdirSync(folder, { recursive: true });
            this.resourcesLocation = folder;
        }
        catch (e) {
            this.resourcesLocation = this.extensionPath;
        }
    }
    initializeDependencies() {
        this.logger.debug(`Initializing CodingCam v${this.extension.version}`);
        this.statusBar = vscode.window.createStatusBarItem('com.codingcam.statusbar', vscode.StatusBarAlignment.Left, 3);
        this.statusBar.name = 'CodingCam';
        this.statusBar.command = constants_1.COMMAND_DASHBOARD;
        this.statusBarTeamYou = vscode.window.createStatusBarItem('com.codingcam.teamyou', vscode.StatusBarAlignment.Left, 2);
        this.statusBarTeamYou.name = 'CodingCam Top dev';
        this.statusBarTeamOther = vscode.window.createStatusBarItem('com.codingcam.teamother', vscode.StatusBarAlignment.Left, 1);
        this.statusBarTeamOther.name = 'CodingCam Team Total';
        this.options.getSetting('settings', 'status_bar_team', false, (statusBarTeam) => {
            this.showStatusBarTeam = statusBarTeam.value !== 'false';
            this.options.getSetting('settings', 'status_bar_enabled', false, (statusBarEnabled) => {
                this.showStatusBar = statusBarEnabled.value !== 'false';
                this.setStatusBarVisibility(this.showStatusBar);
                this.updateStatusBarText('CodingCam Initializing...');
                this.checkApiKey();
                this.setupEventListeners();
                this.options.getSetting('settings', 'status_bar_coding_activity', false, (showCodingActivity) => {
                    this.showCodingActivity = showCodingActivity.value !== 'false';
                    this.logger.debug('CodingCam initialized');
                    this.updateStatusBarText();
                    this.updateStatusBarTooltip('CodingCam: Initialized');
                    this.getCodingActivity();
                });
            });
        });
    }
    updateStatusBarText(text) {
        if (!this.statusBar)
            return;
        if (!text) {
            this.statusBar.text = '$(clock)';
        }
        else {
            this.statusBar.text = '$(clock) ' + text;
        }
    }
    updateStatusBarTooltip(tooltipText) {
        if (!this.statusBar)
            return;
        this.statusBar.tooltip = tooltipText;
    }
    statusBarShowingError() {
        if (!this.statusBar)
            return false;
        return this.statusBar.text.indexOf('Error') != -1;
    }
    updateTeamStatusBarTextForCurrentUser(text) {
        if (!this.statusBarTeamYou)
            return;
        if (!text) {
            this.statusBarTeamYou.text = '';
        }
        else {
            this.statusBarTeamYou.text = text;
        }
    }
    updateStatusBarTooltipForCurrentUser(tooltipText) {
        if (!this.statusBarTeamYou)
            return;
        this.statusBarTeamYou.tooltip = tooltipText;
    }
    updateTeamStatusBarTextForOther(text) {
        if (!this.statusBarTeamOther)
            return;
        if (!text) {
            this.statusBarTeamOther.text = '';
        }
        else {
            this.statusBarTeamOther.text = text;
            this.statusBarTeamOther.tooltip = 'Developer with the most time spent in this file';
        }
    }
    updateStatusBarTooltipForOther(tooltipText) {
        if (!this.statusBarTeamOther)
            return;
        this.statusBarTeamOther.tooltip = tooltipText;
    }
    async promptForApiKey(hidden = true) {
        const choice = await vscode.window.showQuickPick(['Enter API Key', 'Register', 'Login'], { placeHolder: 'How would you like to authenticate?' });
        if (!choice)
            return;
        if (choice === 'Register') {
            vscode.commands.executeCommand('codingcam.register');
            return;
        }
        if (choice === 'Login') {
            vscode.commands.executeCommand('codingcam.login');
            return;
        }
        let defaultVal = await this.options.getApiKey();
        if (utils_1.Utils.apiKeyInvalid(defaultVal ?? undefined))
            defaultVal = '';
        let promptOptions = {
            prompt: 'CodingCam Api Key',
            placeHolder: 'Enter your API key',
            value: defaultVal,
            ignoreFocusOut: true,
            password: hidden,
            validateInput: utils_1.Utils.apiKeyInvalid.bind(this),
        };
        const val = await vscode.window.showInputBox(promptOptions);
        if (val != undefined) {
            let invalid = utils_1.Utils.apiKeyInvalid(val);
            if (!invalid) {
                await vscode.workspace.getConfiguration().update('codingcam.apiKey', val, true);
                this.options.setSetting('settings', 'api_key', val, false);
                // Update API with the new key
                this.api.updateApiKey(val);
                // Verify the key
                const isValid = await this.api.validateApiKey(val);
                if (isValid) {
                    vscode.window.showInformationMessage('API key validated successfully');
                }
                else {
                    vscode.window.showWarningMessage('API key saved, but could not be validated. Please verify it is correct.');
                }
            }
            else {
                vscode.window.setStatusBarMessage(invalid);
            }
        }
        else {
            vscode.window.setStatusBarMessage('CodingCam api key not provided');
        }
    }
    async promptForApiUrl() {
        const apiUrl = await this.options.getApiUrl(true);
        let promptOptions = {
            prompt: 'CodingCam Api Url',
            placeHolder: 'http://localhost:3001/api',
            value: apiUrl,
            ignoreFocusOut: true,
        };
        vscode.window.showInputBox(promptOptions).then((val) => {
            if (val) {
                vscode.workspace.getConfiguration().update('codingcam.apiUrl', val, true);
                this.options.setSetting('settings', 'api_url', val, false);
            }
        });
    }
    promptForProxy() {
        this.options.getSetting('settings', 'proxy', false, (proxy) => {
            let defaultVal = proxy.value;
            if (!defaultVal)
                defaultVal = '';
            let promptOptions = {
                prompt: 'CodingCam Proxy',
                placeHolder: `Proxy format is https://user:pass@host:port (current value \"${defaultVal}\")`,
                value: defaultVal,
                ignoreFocusOut: true,
                validateInput: utils_1.Utils.validateProxy.bind(this),
            };
            vscode.window.showInputBox(promptOptions).then((val) => {
                if (val || val === '')
                    this.options.setSetting('settings', 'proxy', val, false);
            });
        });
    }
    promptForDebug() {
        this.options.getSetting('settings', 'debug', false, (debug) => {
            let defaultVal = debug.value;
            if (!defaultVal || defaultVal !== 'true')
                defaultVal = 'false';
            let items = ['true', 'false'];
            let promptOptions = {
                placeHolder: `true or false (current value \"${defaultVal}\")`,
                value: defaultVal,
                ignoreFocusOut: true,
            };
            vscode.window.showQuickPick(items, promptOptions).then((newVal) => {
                if (newVal == null)
                    return;
                this.options.setSetting('settings', 'debug', newVal, false);
                if (newVal === 'true') {
                    this.logger.setLevel(constants_1.LogLevel.DEBUG);
                    this.logger.debug('Debug enabled');
                }
                else {
                    this.logger.setLevel(constants_1.LogLevel.INFO);
                }
            });
        });
    }
    promptToDisable() {
        this.options.getSetting('settings', 'disabled', false, (setting) => {
            const previousValue = this.disabled;
            let currentVal = setting.value;
            if (!currentVal || currentVal !== 'true')
                currentVal = 'false';
            let items = ['disable', 'enable'];
            const helperText = currentVal === 'true' ? 'disabled' : 'enabled';
            let promptOptions = {
                placeHolder: `disable or enable (extension is currently "${helperText}")`,
                ignoreFocusOut: true,
            };
            vscode.window.showQuickPick(items, promptOptions).then((newVal) => {
                if (newVal !== 'enable' && newVal !== 'disable')
                    return;
                this.disabled = newVal === 'disable';
                if (this.disabled != previousValue) {
                    if (this.disabled) {
                        this.options.setSetting('settings', 'disabled', 'true', false);
                        this.logger.debug('Extension disabled, will not report code stats to dashboard');
                        this.dispose();
                    }
                    else {
                        this.options.setSetting('settings', 'disabled', 'false', false);
                        this.initializeDependencies();
                    }
                }
            });
        });
    }
    promptStatusBarIcon() {
        this.options.getSetting('settings', 'status_bar_enabled', false, (setting) => {
            let defaultVal = setting.value;
            if (!defaultVal || defaultVal !== 'false')
                defaultVal = 'true';
            let items = ['true', 'false'];
            let promptOptions = {
                placeHolder: `true or false (current value \"${defaultVal}\")`,
                value: defaultVal,
                ignoreFocusOut: true,
            };
            vscode.window.showQuickPick(items, promptOptions).then((newVal) => {
                if (newVal !== 'true' && newVal !== 'false')
                    return;
                this.options.setSetting('settings', 'status_bar_enabled', newVal, false);
                this.showStatusBar = newVal === 'true';
                this.setStatusBarVisibility(this.showStatusBar);
            });
        });
    }
    promptStatusBarCodingActivity() {
        this.options.getSetting('settings', 'status_bar_coding_activity', false, (setting) => {
            let defaultVal = setting.value;
            if (!defaultVal || defaultVal !== 'false')
                defaultVal = 'true';
            let items = ['true', 'false'];
            let promptOptions = {
                placeHolder: `true or false (current value \"${defaultVal}\")`,
                value: defaultVal,
                ignoreFocusOut: true,
            };
            vscode.window.showQuickPick(items, promptOptions).then((newVal) => {
                if (newVal !== 'true' && newVal !== 'false')
                    return;
                this.options.setSetting('settings', 'status_bar_coding_activity', newVal, false);
                if (newVal === 'true') {
                    this.logger.debug('Coding activity in status bar has been enabled');
                    this.showCodingActivity = true;
                    this.getCodingActivity();
                }
                else {
                    this.logger.debug('Coding activity in status bar has been disabled');
                    this.showCodingActivity = false;
                    if (!this.statusBarShowingError()) {
                        this.updateStatusBarText();
                    }
                }
            });
        });
    }
    async openDashboardWebsite() {
        const localFrontendUrl = 'http://localhost:3000';
        vscode.env.openExternal(vscode.Uri.parse(localFrontendUrl));
    }
    openConfigFile() {
        let path = this.options.getConfigFile(false);
        if (path) {
            let uri = vscode.Uri.file(path);
            vscode.window.showTextDocument(uri);
        }
    }
    openLogFile() {
        let path = this.options.getLogFile();
        if (path) {
            let uri = vscode.Uri.file(path);
            vscode.window.showTextDocument(uri);
        }
    }
    checkApiKey() {
        this.options.hasApiKey((hasApiKey) => {
            if (!hasApiKey)
                this.promptForApiKey();
        });
    }
    setStatusBarVisibility(isVisible) {
        if (isVisible) {
            this.statusBar?.show();
            this.statusBarTeamYou?.show();
            this.statusBarTeamOther?.show();
            this.logger.debug('Status bar icon enabled.');
        }
        else {
            this.statusBar?.hide();
            this.statusBarTeamYou?.hide();
            this.statusBarTeamOther?.hide();
            this.logger.debug('Status bar icon disabled.');
        }
    }
    setupEventListeners() {
        let subscriptions = [];
        vscode.window.onDidChangeTextEditorSelection(this.onChangeSelection, this, subscriptions);
        vscode.window.onDidChangeActiveTextEditor(this.onChangeTab, this, subscriptions);
        vscode.workspace.onDidSaveTextDocument(this.onSave, this, subscriptions);
        vscode.tasks.onDidStartTask(this.onDidStartTask, this, subscriptions);
        vscode.tasks.onDidEndTask(this.onDidEndTask, this, subscriptions);
        vscode.debug.onDidChangeActiveDebugSession(this.onDebuggingChanged, this, subscriptions);
        vscode.debug.onDidChangeBreakpoints(this.onDebuggingChanged, this, subscriptions);
        vscode.debug.onDidStartDebugSession(this.onDidStartDebugSession, this, subscriptions);
        vscode.debug.onDidTerminateDebugSession(this.onDidTerminateDebugSession, this, subscriptions);
        this.disposable = vscode.Disposable.from(...subscriptions);
    }
    onDebuggingChanged() {
        this.onEvent(false);
    }
    onDidStartDebugSession() {
        this.isDebugging = true;
        this.onEvent(false);
    }
    onDidTerminateDebugSession() {
        this.isDebugging = false;
        this.onEvent(false);
    }
    onDidStartTask(e) {
        if (e.execution.task.isBackground)
            return;
        if (e.execution.task.detail && e.execution.task.detail.indexOf('watch') !== -1)
            return;
        this.isCompiling = true;
        this.onEvent(false);
    }
    onDidEndTask() {
        this.isCompiling = false;
        this.onEvent(false);
    }
    onChangeSelection(e) {
        if (e.kind === vscode.TextEditorSelectionChangeKind.Command)
            return;
        this.onEvent(false);
    }
    onChangeTab(_e) {
        this.onEvent(false);
    }
    onSave(_e) {
        this.onEvent(true);
    }
    onEvent(isWrite) {
        clearTimeout(this.debounceTimeoutId);
        this.debounceTimeoutId = setTimeout(() => {
            if (this.disabled)
                return;
            let editor = vscode.window.activeTextEditor;
            if (editor) {
                let doc = editor.document;
                if (doc) {
                    let file = doc.fileName;
                    if (file) {
                        if (this.currentlyFocusedFile !== file) {
                            this.updateTeamStatusBarFromJson();
                            this.updateTeamStatusBar(doc);
                        }
                        let time = Date.now();
                        if (isWrite ||
                            this.enoughTimePassed(time) ||
                            this.lastFile !== file ||
                            this.lastDebug !== this.isDebugging ||
                            this.lastCompile !== this.isCompiling) {
                            this.sendHeartbeat(doc, time, editor.selection.start, isWrite, this.isCompiling, this.isDebugging);
                            this.lastFile = file;
                            this.lastHeartbeat = time;
                            this.lastDebug = this.isDebugging;
                            this.lastCompile = this.isCompiling;
                        }
                    }
                }
            }
        }, this.debounceMs);
    }
    async sendHeartbeat(doc, time, selection, isWrite, isCompiling, isDebugging) {
        const apiKey = await this.options.getApiKey();
        if (apiKey) {
            await this._sendHeartbeat(doc, time, selection, isWrite, isCompiling, isDebugging);
        }
        else {
            await this.promptForApiKey();
        }
    }
    async _sendHeartbeat(doc, time, selection, isWrite, isCompiling, isDebugging) {
        let file = doc.fileName;
        if (utils_1.Utils.isRemoteUri(doc.uri)) {
            file = `${doc.uri.authority}${doc.uri.path}`;
            file = file.replace('ssh-remote+', 'ssh://');
        }
        if (isWrite && this.isDuplicateHeartbeat(file, time, selection))
            return;
        let category = '';
        if (isDebugging) {
            category = 'debugging';
        }
        else if (isCompiling) {
            category = 'building';
        }
        else if (utils_1.Utils.isPullRequest(doc.uri)) {
            category = 'code reviewing';
        }
        const project = this.getProjectName(doc.uri);
        // Also record in session manager
        if (this.sessionManager) {
            this.sessionManager.recordActivity(file, doc.languageId, doc.lineCount, isWrite);
        }
        try {
            await this.api.sendHeartbeat({
                entity: file,
                type: category || 'coding',
                time: Math.floor(time / 1000),
                project: project,
                language: doc.languageId,
                lines: doc.lineCount,
                lineno: selection.line + 1,
                cursorpos: selection.character + 1,
                is_write: isWrite
            });
            if (this.showStatusBar)
                this.getCodingActivity();
        }
        catch (error) {
            this.logger.error(`Error sending heartbeat: ${error}`);
            if (this.showStatusBar) {
                this.updateStatusBarText('CodingCam Error');
                this.updateStatusBarTooltip(`CodingCam: Error sending data to backend`);
            }
        }
    }
    async getCodingActivity() {
        if (!this.showStatusBar)
            return;
        const cutoff = Date.now() - this.fetchTodayInterval;
        if (this.lastFetchToday > cutoff)
            return;
        this.lastFetchToday = Date.now();
        const apiKey = await this.options.getApiKey();
        if (!apiKey)
            return;
        await this._getCodingActivity();
    }
    async _getCodingActivity() {
        let user_agent = this.agentName + '/' + vscode.version + ' vscode-codingcam/' + this.extension.version;
        let args = ['--today', '--output', 'json', '--plugin', utils_1.Utils.quote(user_agent)];
        if (this.isMetricsEnabled)
            args.push('--metrics');
        const apiKey = this.options.getApiKeyFromEnv();
        if (!utils_1.Utils.apiKeyInvalid(apiKey))
            args.push('--key', utils_1.Utils.quote(apiKey));
        const apiUrl = await this.options.getApiUrl();
        if (apiUrl)
            args.push('--api-url', utils_1.Utils.quote(apiUrl));
        if (desktop_1.Desktop.isWindows()) {
            args.push('--config', utils_1.Utils.quote(this.options.getConfigFile(false)), '--logfile', utils_1.Utils.quote(this.options.getLogFile()));
        }
        const cliName = process.platform === 'win32' ? 'codingcam.exe' : 'codingcam';
        const binary = path.join(this.resourcesLocation, cliName);
        this.logger.debug(`Fetching coding activity for Today from api: ${utils_1.Utils.formatArguments(binary, args)}`);
        const options = desktop_1.Desktop.buildOptions();
        try {
            let proc = child_process.execFile(binary, args, options, (error, stdout, stderr) => {
                if (error != null) {
                    if (stderr && stderr.toString() != '')
                        this.logger.debug(stderr.toString());
                    if (stdout && stdout.toString() != '')
                        this.logger.debug(stdout.toString());
                    this.logger.debug(error.toString());
                }
            });
            let output = '';
            if (proc.stdout) {
                proc.stdout.on('data', (data) => {
                    if (data)
                        output += data;
                });
            }
            proc.on('close', (code, _signal) => {
                if (code == 0) {
                    if (this.showStatusBar) {
                        if (output) {
                            let jsonData;
                            try {
                                jsonData = JSON.parse(output);
                            }
                            catch (e) {
                                this.logger.debug(`Error parsing today coding activity as json:\n${output}\nCheck your ${this.options.getLogFile()} file for more details.`);
                            }
                            if (jsonData)
                                this.hasTeamFeatures = jsonData?.has_team_features;
                            if (jsonData?.text) {
                                if (this.showCodingActivity) {
                                    this.updateStatusBarText(jsonData.text.trim());
                                    this.updateStatusBarTooltip('CodingCam: Todays coding time. Click to visit dashboard.');
                                }
                                else {
                                    this.updateStatusBarText();
                                    this.updateStatusBarTooltip(jsonData.text.trim());
                                }
                            }
                            else {
                                this.updateStatusBarText();
                                this.updateStatusBarTooltip('CodingCam: Calculating time spent today in background...');
                            }
                            this.updateTeamStatusBar();
                        }
                        else {
                            this.updateStatusBarText();
                            this.updateStatusBarTooltip('CodingCam: Calculating time spent today in background...');
                        }
                    }
                }
                else if (code == 102 || code == 112) {
                    // noop, working offline
                }
                else {
                    this.logger.debug(`Error fetching today coding activity (${code}); Check your ${this.options.getLogFile()} file for more details.`);
                }
            });
        }
        catch (e) {
            this.logger.debugException(e);
        }
    }
    async updateTeamStatusBar(doc) {
        if (!this.showStatusBarTeam)
            return;
        if (!this.hasTeamFeatures)
            return;
        if (!doc) {
            doc = vscode.window.activeTextEditor?.document;
            if (!doc)
                return;
        }
        let file = doc.fileName;
        if (utils_1.Utils.isRemoteUri(doc.uri)) {
            file = `${doc.uri.authority}${doc.uri.path}`;
            file = file.replace('ssh-remote+', 'ssh://');
        }
        this.currentlyFocusedFile = file;
        if (this.teamDevsForFileCache[file]) {
            this.updateTeamStatusBarFromJson(this.teamDevsForFileCache[file]);
            return;
        }
        let user_agent = this.agentName + '/' + vscode.version + ' vscode-codingcam/' + this.extension.version;
        let args = ['--output', 'json', '--plugin', utils_1.Utils.quote(user_agent)];
        args.push('--file-experts', utils_1.Utils.quote(file));
        args.push('--entity', utils_1.Utils.quote(file));
        if (this.isMetricsEnabled)
            args.push('--metrics');
        const apiKey = this.options.getApiKeyFromEnv();
        if (!utils_1.Utils.apiKeyInvalid(apiKey))
            args.push('--key', utils_1.Utils.quote(apiKey));
        const apiUrl = await this.options.getApiUrl();
        if (apiUrl)
            args.push('--api-url', utils_1.Utils.quote(apiUrl));
        const project = this.getProjectName(doc.uri);
        if (project)
            args.push('--alternate-project', utils_1.Utils.quote(project));
        const folder = this.getProjectFolder(doc.uri);
        if (folder)
            args.push('--project-folder', utils_1.Utils.quote(folder));
        if (desktop_1.Desktop.isWindows()) {
            args.push('--config', utils_1.Utils.quote(this.options.getConfigFile(false)), '--logfile', utils_1.Utils.quote(this.options.getLogFile()));
        }
        if (doc.isUntitled)
            args.push('--is-unsaved-entity');
        const cliName = process.platform === 'win32' ? 'codingcam.exe' : 'codingcam';
        const binary = path.join(this.resourcesLocation, cliName);
        this.logger.debug(`Fetching devs for file from api: ${utils_1.Utils.formatArguments(binary, args)}`);
        const options = desktop_1.Desktop.buildOptions();
        try {
            let proc = child_process.execFile(binary, args, options, (error, stdout, stderr) => {
                if (error != null) {
                    if (stderr && stderr.toString() != '')
                        this.logger.debug(stderr.toString());
                    if (stdout && stdout.toString() != '')
                        this.logger.debug(stdout.toString());
                    this.logger.debug(error.toString());
                }
            });
            let output = '';
            if (proc.stdout) {
                proc.stdout.on('data', (data) => {
                    if (data)
                        output += data;
                });
            }
            proc.on('close', (code, _signal) => {
                if (code == 0) {
                    if (output && output.trim()) {
                        let jsonData;
                        try {
                            jsonData = JSON.parse(output);
                        }
                        catch (e) {
                            this.logger.debug(`Error parsing devs for file as json:\n${output}\nCheck your ${this.options.getLogFile()} file for more details.`);
                        }
                        if (jsonData)
                            this.teamDevsForFileCache[file] = jsonData;
                        if (file !== this.currentlyFocusedFile) {
                            return;
                        }
                        this.updateTeamStatusBarFromJson(jsonData);
                    }
                    else {
                        this.updateTeamStatusBarTextForCurrentUser();
                        this.updateTeamStatusBarTextForOther();
                    }
                }
                else if (code == 102 || code == 112) {
                    // noop, working offline
                }
                else {
                    this.logger.debug(`Error fetching devs for file (${code}); Check your ${this.options.getLogFile()} file for more details.`);
                }
            });
        }
        catch (e) {
            this.logger.debugException(e);
        }
    }
    updateTeamStatusBarFromJson(jsonData) {
        if (!jsonData) {
            this.updateTeamStatusBarTextForCurrentUser();
            this.updateTeamStatusBarTextForOther();
            return;
        }
        const you = jsonData.you;
        const other = jsonData.other;
        if (you) {
            this.updateTeamStatusBarTextForCurrentUser('You: ' + you.total.text);
            this.updateStatusBarTooltipForCurrentUser('Your total time spent in this file');
        }
        else {
            this.updateTeamStatusBarTextForCurrentUser();
        }
        if (other) {
            this.updateTeamStatusBarTextForOther(other.user.name + ': ' + other.total.text);
            this.updateStatusBarTooltipForOther(other.user.long_name + 's total time spent in this file');
        }
        else {
            this.updateTeamStatusBarTextForOther();
        }
    }
    enoughTimePassed(time) {
        return this.lastHeartbeat + 120000 < time;
    }
    isDuplicateHeartbeat(file, time, selection) {
        let duplicate = false;
        let minutes = 30;
        let milliseconds = minutes * 60000;
        if (this.dedupe[file] &&
            this.dedupe[file].lastHeartbeatAt + milliseconds < time &&
            this.dedupe[file].selection.line == selection.line &&
            this.dedupe[file].selection.character == selection.character) {
            duplicate = true;
        }
        this.dedupe[file] = {
            selection: selection,
            lastHeartbeatAt: time,
        };
        return duplicate;
    }
    getProjectName(uri) {
        if (!vscode.workspace)
            return '';
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (workspaceFolder) {
            try {
                return workspaceFolder.name;
            }
            catch (e) { }
        }
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length) {
            return vscode.workspace.workspaceFolders[0].name;
        }
        return vscode.workspace.name || '';
    }
    getProjectFolder(uri) {
        if (!vscode.workspace)
            return '';
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (workspaceFolder) {
            try {
                return workspaceFolder.uri.fsPath;
            }
            catch (e) { }
        }
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length) {
            return vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
        return '';
    }
}
exports.CodingCam = CodingCam;
//# sourceMappingURL=codingcam.js.map