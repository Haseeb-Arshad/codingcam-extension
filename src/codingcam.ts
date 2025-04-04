import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { COMMAND_DASHBOARD, LogLevel } from './constants';
import { Options, Setting } from './options';
import { Desktop } from './desktop';
import { Logger } from './logger';
import { Utils } from './utils';
import { CodingCamBackendApi } from './api';
import { SessionManager } from './sessionManager';

interface FileSelection {
  selection: vscode.Position;
  lastHeartbeatAt: number;
}

interface FileSelectionMap {
  [key: string]: FileSelection;
}

export class CodingCam {
  private agentName: string = '';
  private extension: any;
  private statusBar?: vscode.StatusBarItem = undefined;
  private statusBarTeamYou?: vscode.StatusBarItem = undefined;
  private statusBarTeamOther?: vscode.StatusBarItem = undefined;
  private disposable!: vscode.Disposable;
  private lastFile: string = '';
  private lastHeartbeat: number = 0;
  private lastDebug: boolean = false;
  private lastCompile: boolean = false;
  private dedupe: FileSelectionMap = {};
  private debounceTimeoutId: any = null;
  private debounceMs = 50;
  private options: Options;
  private logger: Logger;
  private fetchTodayInterval: number = 60000;
  private lastFetchToday: number = 0;
  private showStatusBar: boolean = false;
  private showCodingActivity: boolean = false;
  private showStatusBarTeam: boolean = false;
  private hasTeamFeatures: boolean = false;
  private disabled: boolean = true;
  private extensionPath: string;
  private isCompiling: boolean = false;
  private isDebugging: boolean = false;
  private currentlyFocusedFile: string = '';
  private teamDevsForFileCache: Record<string, any> = {};
  private resourcesLocation: string = '';
  private lastApiKeyPrompted: number = 0;
  private isMetricsEnabled: boolean = false;
  private api: CodingCamBackendApi;
  private sessionManager: SessionManager | null = null;

  constructor(extensionPath: string, logger: Logger, api: CodingCamBackendApi) {
    this.extensionPath = extensionPath;
    this.logger = logger;
    this.api = api;
    this.setResourcesLocation();
    this.options = new Options(logger, this.resourcesLocation);
  }

  public initialize(): void {
    this.options.getSetting('settings', 'debug', false, (setting: Setting) => {
      if (setting.value === 'true') {
        this.logger.setLevel(LogLevel.DEBUG);
      }
      this.options.getSetting('settings', 'metrics', false, (metrics: Setting) => {
        if (metrics.value === 'true') {
          this.isMetricsEnabled = true;
        }

        let extension = vscode.extensions.getExtension('snipxt-dev.codingcam-tracker');
        this.extension = (extension != undefined && extension.packageJSON) || { version: '0.0.0' };
        this.agentName = Utils.getEditorName();

        this.options.getSetting('settings', 'disabled', false, (disabled: Setting) => {
          this.disabled = disabled.value === 'true';
          if (this.disabled) {
            this.dispose();
            return;
          }

          this.initializeDependencies();
          
          // Initialize session manager
          this.sessionManager = new SessionManager(this.logger, this.api);
          this.sessionManager.initialize();
        });
      });
    });
  }

  public dispose() {
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

  private setResourcesLocation() {
    const home = Desktop.getHomeDirectory();
    const folder = path.join(home, '.codingcam');

    try {
      fs.mkdirSync(folder, { recursive: true });
      this.resourcesLocation = folder;
    } catch (e) {
      this.resourcesLocation = this.extensionPath;
    }
  }

  public initializeDependencies(): void {
    this.logger.debug(`Initializing CodingCam v${this.extension.version}`);

    this.statusBar = vscode.window.createStatusBarItem(
      'com.codingcam.statusbar',
      vscode.StatusBarAlignment.Left,
      3,
    );
    this.statusBar.name = 'CodingCam';
    this.statusBar.command = COMMAND_DASHBOARD;

    this.statusBarTeamYou = vscode.window.createStatusBarItem(
      'com.codingcam.teamyou',
      vscode.StatusBarAlignment.Left,
      2,
    );
    this.statusBarTeamYou.name = 'CodingCam Top dev';

    this.statusBarTeamOther = vscode.window.createStatusBarItem(
      'com.codingcam.teamother',
      vscode.StatusBarAlignment.Left,
      1,
    );
    this.statusBarTeamOther.name = 'CodingCam Team Total';

    this.options.getSetting('settings', 'status_bar_team', false, (statusBarTeam: Setting) => {
      this.showStatusBarTeam = statusBarTeam.value !== 'false';
      this.options.getSetting(
        'settings',
        'status_bar_enabled',
        false,
        (statusBarEnabled: Setting) => {
          this.showStatusBar = statusBarEnabled.value !== 'false';
          this.setStatusBarVisibility(this.showStatusBar);
          this.updateStatusBarText('CodingCam Initializing...');

          this.checkApiKey();

          this.setupEventListeners();

          this.options.getSetting(
            'settings',
            'status_bar_coding_activity',
            false,
            (showCodingActivity: Setting) => {
              this.showCodingActivity = showCodingActivity.value !== 'false';

              this.logger.debug('CodingCam initialized');
              this.updateStatusBarText();
              this.updateStatusBarTooltip('CodingCam: Initialized');
              this.getCodingActivity();
            },
          );
        },
      );
    });
  }

  private updateStatusBarText(text?: string): void {
    if (!this.statusBar) return;
    if (!text) {
      this.statusBar.text = '$(clock)';
    } else {
      this.statusBar.text = '$(clock) ' + text;
    }
  }

  private updateStatusBarTooltip(tooltipText: string): void {
    if (!this.statusBar) return;
    this.statusBar.tooltip = tooltipText;
  }

  private statusBarShowingError(): boolean {
    if (!this.statusBar) return false;
    return this.statusBar.text.indexOf('Error') != -1;
  }

  private updateTeamStatusBarTextForCurrentUser(text?: string): void {
    if (!this.statusBarTeamYou) return;
    if (!text) {
      this.statusBarTeamYou.text = '';
    } else {
      this.statusBarTeamYou.text = text;
    }
  }

  private updateStatusBarTooltipForCurrentUser(tooltipText: string): void {
    if (!this.statusBarTeamYou) return;
    this.statusBarTeamYou.tooltip = tooltipText;
  }

  private updateTeamStatusBarTextForOther(text?: string): void {
    if (!this.statusBarTeamOther) return;
    if (!text) {
      this.statusBarTeamOther.text = '';
    } else {
      this.statusBarTeamOther.text = text;
      this.statusBarTeamOther.tooltip = 'Developer with the most time spent in this file';
    }
  }

  private updateStatusBarTooltipForOther(tooltipText: string): void {
    if (!this.statusBarTeamOther) return;
    this.statusBarTeamOther.tooltip = tooltipText;
  }

  public async promptForApiKey(hidden: boolean = true): Promise<void> {
    const choice = await vscode.window.showQuickPick(
      ['Enter API Key', 'Register', 'Login'],
      { placeHolder: 'How would you like to authenticate?' }
    );
    
    if (!choice) return;
    
    if (choice === 'Register') {
      vscode.commands.executeCommand('codingcam.register');
      return;
    }
    
    if (choice === 'Login') {
      vscode.commands.executeCommand('codingcam.login');
      return;
    }
    
    let defaultVal = await this.options.getApiKey();
    if (Utils.apiKeyInvalid(defaultVal ?? undefined)) defaultVal = '';
    let promptOptions = {
      prompt: 'CodingCam Api Key',
      placeHolder: 'Enter your API key',
      value: defaultVal!,
      ignoreFocusOut: true,
      password: hidden,
      validateInput: Utils.apiKeyInvalid.bind(this),
    };
    
    const val = await vscode.window.showInputBox(promptOptions);
    if (val != undefined) {
      let invalid = Utils.apiKeyInvalid(val);
      if (!invalid) {
        await vscode.workspace.getConfiguration().update('codingcam.apiKey', val, true);
        this.options.setSetting('settings', 'api_key', val, false);
        
        // Update API with the new key
        this.api.updateApiKey(val);
        
        // Verify the key
        const isValid = await this.api.validateApiKey(val);
        if (isValid) {
          vscode.window.showInformationMessage('API key validated successfully');
        } else {
          vscode.window.showWarningMessage('API key saved, but could not be validated. Please verify it is correct.');
        }
      } else {
        vscode.window.setStatusBarMessage(invalid);
      }
    } else {
      vscode.window.setStatusBarMessage('CodingCam api key not provided');
    }
  }

  public async promptForApiUrl(): Promise<void> {
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

  public promptForProxy(): void {
    this.options.getSetting('settings', 'proxy', false, (proxy: Setting) => {
      let defaultVal = proxy.value;
      if (!defaultVal) defaultVal = '';
      let promptOptions = {
        prompt: 'CodingCam Proxy',
        placeHolder: `Proxy format is https://user:pass@host:port (current value \"${defaultVal}\")`,
        value: defaultVal,
        ignoreFocusOut: true,
        validateInput: Utils.validateProxy.bind(this),
      };
      vscode.window.showInputBox(promptOptions).then((val) => {
        if (val || val === '') this.options.setSetting('settings', 'proxy', val, false);
      });
    });
  }

  public promptForDebug(): void {
    this.options.getSetting('settings', 'debug', false, (debug: Setting) => {
      let defaultVal = debug.value;
      if (!defaultVal || defaultVal !== 'true') defaultVal = 'false';
      let items: string[] = ['true', 'false'];
      let promptOptions = {
        placeHolder: `true or false (current value \"${defaultVal}\")`,
        value: defaultVal,
        ignoreFocusOut: true,
      };
      vscode.window.showQuickPick(items, promptOptions).then((newVal) => {
        if (newVal == null) return;
        this.options.setSetting('settings', 'debug', newVal, false);
        if (newVal === 'true') {
          this.logger.setLevel(LogLevel.DEBUG);
          this.logger.debug('Debug enabled');
        } else {
          this.logger.setLevel(LogLevel.INFO);
        }
      });
    });
  }

  public promptToDisable(): void {
    this.options.getSetting('settings', 'disabled', false, (setting: Setting) => {
      const previousValue = this.disabled;
      let currentVal = setting.value;
      if (!currentVal || currentVal !== 'true') currentVal = 'false';
      let items: string[] = ['disable', 'enable'];
      const helperText = currentVal === 'true' ? 'disabled' : 'enabled';
      let promptOptions = {
        placeHolder: `disable or enable (extension is currently "${helperText}")`,
        ignoreFocusOut: true,
      };
      vscode.window.showQuickPick(items, promptOptions).then((newVal) => {
        if (newVal !== 'enable' && newVal !== 'disable') return;
        this.disabled = newVal === 'disable';
        if (this.disabled != previousValue) {
          if (this.disabled) {
            this.options.setSetting('settings', 'disabled', 'true', false);
            this.logger.debug('Extension disabled, will not report code stats to dashboard');
            this.dispose();
          } else {
            this.options.setSetting('settings', 'disabled', 'false', false);
            this.initializeDependencies();
          }
        }
      });
    });
  }

  public promptStatusBarIcon(): void {
    this.options.getSetting('settings', 'status_bar_enabled', false, (setting: Setting) => {
      let defaultVal = setting.value;
      if (!defaultVal || defaultVal !== 'false') defaultVal = 'true';
      let items: string[] = ['true', 'false'];
      let promptOptions = {
        placeHolder: `true or false (current value \"${defaultVal}\")`,
        value: defaultVal,
        ignoreFocusOut: true,
      };
      vscode.window.showQuickPick(items, promptOptions).then((newVal) => {
        if (newVal !== 'true' && newVal !== 'false') return;
        this.options.setSetting('settings', 'status_bar_enabled', newVal, false);
        this.showStatusBar = newVal === 'true';
        this.setStatusBarVisibility(this.showStatusBar);
      });
    });
  }

  public promptStatusBarCodingActivity(): void {
    this.options.getSetting('settings', 'status_bar_coding_activity', false, (setting: Setting) => {
      let defaultVal = setting.value;
      if (!defaultVal || defaultVal !== 'false') defaultVal = 'true';
      let items: string[] = ['true', 'false'];
      let promptOptions = {
        placeHolder: `true or false (current value \"${defaultVal}\")`,
        value: defaultVal,
        ignoreFocusOut: true,
      };
      vscode.window.showQuickPick(items, promptOptions).then((newVal) => {
        if (newVal !== 'true' && newVal !== 'false') return;
        this.options.setSetting('settings', 'status_bar_coding_activity', newVal, false);
        if (newVal === 'true') {
          this.logger.debug('Coding activity in status bar has been enabled');
          this.showCodingActivity = true;
          this.getCodingActivity();
        } else {
          this.logger.debug('Coding activity in status bar has been disabled');
          this.showCodingActivity = false;
          if (!this.statusBarShowingError()) {
            this.updateStatusBarText();
          }
        }
      });
    });
  }

  public async openDashboardWebsite(): Promise<void> {
    const localFrontendUrl = 'http://localhost:3000';
    vscode.env.openExternal(vscode.Uri.parse(localFrontendUrl));
  }

  public openConfigFile(): void {
    let path = this.options.getConfigFile(false);
    if (path) {
      let uri = vscode.Uri.file(path);
      vscode.window.showTextDocument(uri);
    }
  }

  public openLogFile(): void {
    let path = this.options.getLogFile();
    if (path) {
      let uri = vscode.Uri.file(path);
      vscode.window.showTextDocument(uri);
    }
  }

  private checkApiKey(): void {
    this.options.hasApiKey((hasApiKey) => {
      if (!hasApiKey) this.promptForApiKey();
    });
  }

  private setStatusBarVisibility(isVisible: boolean): void {
    if (isVisible) {
      this.statusBar?.show();
      this.statusBarTeamYou?.show();
      this.statusBarTeamOther?.show();
      this.logger.debug('Status bar icon enabled.');
    } else {
      this.statusBar?.hide();
      this.statusBarTeamYou?.hide();
      this.statusBarTeamOther?.hide();
      this.logger.debug('Status bar icon disabled.');
    }
  }

  private setupEventListeners(): void {
    let subscriptions: vscode.Disposable[] = [];
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

  private onDebuggingChanged(): void {
    this.onEvent(false);
  }

  private onDidStartDebugSession(): void {
    this.isDebugging = true;
    this.onEvent(false);
  }

  private onDidTerminateDebugSession(): void {
    this.isDebugging = false;
    this.onEvent(false);
  }

  private onDidStartTask(e: vscode.TaskStartEvent): void {
    if (e.execution.task.isBackground) return;
    if (e.execution.task.detail && e.execution.task.detail.indexOf('watch') !== -1) return;
    this.isCompiling = true;
    this.onEvent(false);
  }

  private onDidEndTask(): void {
    this.isCompiling = false;
    this.onEvent(false);
  }

  private onChangeSelection(e: vscode.TextEditorSelectionChangeEvent): void {
    if (e.kind === vscode.TextEditorSelectionChangeKind.Command) return;
    this.onEvent(false);
  }

  private onChangeTab(_e: vscode.TextEditor | undefined): void {
    this.onEvent(false);
  }

  private onSave(_e: vscode.TextDocument | undefined): void {
    this.onEvent(true);
  }

  private onEvent(isWrite: boolean): void {
    clearTimeout(this.debounceTimeoutId);
    this.debounceTimeoutId = setTimeout(() => {
      if (this.disabled) return;
      let editor = vscode.window.activeTextEditor;
      if (editor) {
        let doc = editor.document;
        if (doc) {
          let file: string = doc.fileName;
          if (file) {
            if (this.currentlyFocusedFile !== file) {
              this.updateTeamStatusBarFromJson();
              this.updateTeamStatusBar(doc);
            }

            let time: number = Date.now();
            if (
              isWrite ||
              this.enoughTimePassed(time) ||
              this.lastFile !== file ||
              this.lastDebug !== this.isDebugging ||
              this.lastCompile !== this.isCompiling
            ) {
              this.sendHeartbeat(
                doc,
                time,
                editor.selection.start,
                isWrite,
                this.isCompiling,
                this.isDebugging,
              );
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

  private async sendHeartbeat(
    doc: vscode.TextDocument,
    time: number,
    selection: vscode.Position,
    isWrite: boolean,
    isCompiling: boolean,
    isDebugging: boolean,
  ): Promise<void> {
    const apiKey = await this.options.getApiKey();
    if (apiKey) {
      await this._sendHeartbeat(doc, time, selection, isWrite, isCompiling, isDebugging);
    } else {
      await this.promptForApiKey();
    }
  }

  private async _sendHeartbeat(
    doc: vscode.TextDocument,
    time: number,
    selection: vscode.Position,
    isWrite: boolean,
    isCompiling: boolean,
    isDebugging: boolean,
  ): Promise<void> {
    let file = doc.fileName;
    if (Utils.isRemoteUri(doc.uri)) {
      file = `${doc.uri.authority}${doc.uri.path}`;
      file = file.replace('ssh-remote+', 'ssh://');
    }

    if (isWrite && this.isDuplicateHeartbeat(file, time, selection)) return;

    let category = '';
    if (isDebugging) {
      category = 'debugging';
    } else if (isCompiling) {
      category = 'building';
    } else if (Utils.isPullRequest(doc.uri)) {
      category = 'code reviewing';
    }

    const project = this.getProjectName(doc.uri);
    
    // Also record in session manager
    if (this.sessionManager) {
      this.sessionManager.recordActivity(
        file,
        doc.languageId,
        doc.lineCount,
        isWrite
      );
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
      
      if (this.showStatusBar) this.getCodingActivity();
    } catch (error) {
      this.logger.error(`Error sending heartbeat: ${error}`);
      if (this.showStatusBar) {
        this.updateStatusBarText('CodingCam Error');
        this.updateStatusBarTooltip(`CodingCam: Error sending data to backend`);
      }
    }
  }

  private async getCodingActivity() {
    if (!this.showStatusBar) return;

    const cutoff = Date.now() - this.fetchTodayInterval;
    if (this.lastFetchToday > cutoff) return;

    this.lastFetchToday = Date.now();

    const apiKey = await this.options.getApiKey();
    if (!apiKey) return;

    await this._getCodingActivity();
  }

  private async _getCodingActivity() {
    let user_agent =
      this.agentName + '/' + vscode.version + ' vscode-codingcam/' + this.extension.version;
    let args = ['--today', '--output', 'json', '--plugin', Utils.quote(user_agent)];

    if (this.isMetricsEnabled) args.push('--metrics');

    const apiKey = this.options.getApiKeyFromEnv();
    if (!Utils.apiKeyInvalid(apiKey)) args.push('--key', Utils.quote(apiKey));

    const apiUrl = await this.options.getApiUrl();
    if (apiUrl) args.push('--api-url', Utils.quote(apiUrl));

    if (Desktop.isWindows()) {
      args.push(
        '--config',
        Utils.quote(this.options.getConfigFile(false)),
        '--logfile',
        Utils.quote(this.options.getLogFile()),
      );
    }

    const cliName = process.platform === 'win32' ? 'codingcam.exe' : 'codingcam';
    const binary = path.join(this.resourcesLocation, cliName);

    this.logger.debug(
      `Fetching coding activity for Today from api: ${Utils.formatArguments(binary, args)}`,
    );
    const options = Desktop.buildOptions();

    try {
      let proc = child_process.execFile(binary, args, options, (error, stdout, stderr) => {
        if (error != null) {
          if (stderr && stderr.toString() != '') this.logger.debug(stderr.toString());
          if (stdout && stdout.toString() != '') this.logger.debug(stdout.toString());
          this.logger.debug(error.toString());
        }
      });
      let output = '';
      if (proc.stdout) {
        proc.stdout.on('data', (data: string | null) => {
          if (data) output += data;
        });
      }
      proc.on('close', (code, _signal) => {
        if (code == 0) {
          if (this.showStatusBar) {
            if (output) {
              let jsonData: any;
              try {
                jsonData = JSON.parse(output);
              } catch (e) {
                this.logger.debug(
                  `Error parsing today coding activity as json:\n${output}\nCheck your ${this.options.getLogFile()} file for more details.`,
                );
              }
              if (jsonData) this.hasTeamFeatures = jsonData?.has_team_features;
              if (jsonData?.text) {
                if (this.showCodingActivity) {
                  this.updateStatusBarText(jsonData.text.trim());
                  this.updateStatusBarTooltip(
                    'CodingCam: Todays coding time. Click to visit dashboard.',
                  );
                } else {
                  this.updateStatusBarText();
                  this.updateStatusBarTooltip(jsonData.text.trim());
                }
              } else {
                this.updateStatusBarText();
                this.updateStatusBarTooltip(
                  'CodingCam: Calculating time spent today in background...',
                );
              }
              this.updateTeamStatusBar();
            } else {
              this.updateStatusBarText();
              this.updateStatusBarTooltip(
                'CodingCam: Calculating time spent today in background...',
              );
            }
          }
        } else if (code == 102 || code == 112) {
          // noop, working offline
        } else {
          this.logger.debug(
            `Error fetching today coding activity (${code}); Check your ${this.options.getLogFile()} file for more details.`,
          );
        }
      });
    } catch (e) {
      this.logger.debugException(e);
    }
  }

  private async updateTeamStatusBar(doc?: vscode.TextDocument) {
    if (!this.showStatusBarTeam) return;
    if (!this.hasTeamFeatures) return;

    if (!doc) {
      doc = vscode.window.activeTextEditor?.document;
      if (!doc) return;
    }

    let file = doc.fileName;
    if (Utils.isRemoteUri(doc.uri)) {
      file = `${doc.uri.authority}${doc.uri.path}`;
      file = file.replace('ssh-remote+', 'ssh://');
    }

    this.currentlyFocusedFile = file;

    if (this.teamDevsForFileCache[file]) {
      this.updateTeamStatusBarFromJson(this.teamDevsForFileCache[file]);
      return;
    }

    let user_agent =
      this.agentName + '/' + vscode.version + ' vscode-codingcam/' + this.extension.version;
    let args = ['--output', 'json', '--plugin', Utils.quote(user_agent)];

    args.push('--file-experts', Utils.quote(file));

    args.push('--entity', Utils.quote(file));

    if (this.isMetricsEnabled) args.push('--metrics');

    const apiKey = this.options.getApiKeyFromEnv();
    if (!Utils.apiKeyInvalid(apiKey)) args.push('--key', Utils.quote(apiKey));

    const apiUrl = await this.options.getApiUrl();
    if (apiUrl) args.push('--api-url', Utils.quote(apiUrl));

    const project = this.getProjectName(doc.uri);
    if (project) args.push('--alternate-project', Utils.quote(project));

    const folder = this.getProjectFolder(doc.uri);
    if (folder) args.push('--project-folder', Utils.quote(folder));

    if (Desktop.isWindows()) {
      args.push(
        '--config',
        Utils.quote(this.options.getConfigFile(false)),
        '--logfile',
        Utils.quote(this.options.getLogFile()),
      );
    }

    if (doc.isUntitled) args.push('--is-unsaved-entity');

    const cliName = process.platform === 'win32' ? 'codingcam.exe' : 'codingcam';
    const binary = path.join(this.resourcesLocation, cliName);

    this.logger.debug(`Fetching devs for file from api: ${Utils.formatArguments(binary, args)}`);
    const options = Desktop.buildOptions();

    try {
      let proc = child_process.execFile(binary, args, options, (error, stdout, stderr) => {
        if (error != null) {
          if (stderr && stderr.toString() != '') this.logger.debug(stderr.toString());
          if (stdout && stdout.toString() != '') this.logger.debug(stdout.toString());
          this.logger.debug(error.toString());
        }
      });
      let output = '';
      if (proc.stdout) {
        proc.stdout.on('data', (data: string | null) => {
          if (data) output += data;
        });
      }
      proc.on('close', (code, _signal) => {
        if (code == 0) {
          if (output && output.trim()) {
            let jsonData;
            try {
              jsonData = JSON.parse(output);
            } catch (e) {
              this.logger.debug(
                `Error parsing devs for file as json:\n${output}\nCheck your ${this.options.getLogFile()} file for more details.`,
              );
            }

            if (jsonData) this.teamDevsForFileCache[file!] = jsonData;

            if (file !== this.currentlyFocusedFile) {
              return;
            }

            this.updateTeamStatusBarFromJson(jsonData);
          } else {
            this.updateTeamStatusBarTextForCurrentUser();
            this.updateTeamStatusBarTextForOther();
          }
        } else if (code == 102 || code == 112) {
          // noop, working offline
        } else {
          this.logger.debug(
            `Error fetching devs for file (${code}); Check your ${this.options.getLogFile()} file for more details.`,
          );
        }
      });
    } catch (e) {
      this.logger.debugException(e);
    }
  }

  private updateTeamStatusBarFromJson(jsonData?: any) {
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
    } else {
      this.updateTeamStatusBarTextForCurrentUser();
    }
    if (other) {
      this.updateTeamStatusBarTextForOther(other.user.name + ': ' + other.total.text);
      this.updateStatusBarTooltipForOther(
        other.user.long_name + 's total time spent in this file',
      );
    } else {
      this.updateTeamStatusBarTextForOther();
    }
  }

  private enoughTimePassed(time: number): boolean {
    return this.lastHeartbeat + 120000 < time;
  }

  private isDuplicateHeartbeat(file: string, time: number, selection: vscode.Position): boolean {
    let duplicate = false;
    let minutes = 30;
    let milliseconds = minutes * 60000;
    if (
      this.dedupe[file] &&
      this.dedupe[file].lastHeartbeatAt + milliseconds < time &&
      this.dedupe[file].selection.line == selection.line &&
      this.dedupe[file].selection.character == selection.character
    ) {
      duplicate = true;
    }
    this.dedupe[file] = {
      selection: selection,
      lastHeartbeatAt: time,
    };
    return duplicate;
  }

  private getProjectName(uri: vscode.Uri): string {
    if (!vscode.workspace) return '';
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) {
      try {
        return workspaceFolder.name;
      } catch (e) {}
    }
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length) {
      return vscode.workspace.workspaceFolders[0].name;
    }
    return vscode.workspace.name || '';
  }

  private getProjectFolder(uri: vscode.Uri): string {
    if (!vscode.workspace) return '';
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) {
      try {
        return workspaceFolder.uri.fsPath;
      } catch (e) {}
    }
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length) {
      return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
    return '';
  }
}