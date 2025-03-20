import * as vscode from 'vscode';
import {
  COMMAND_API_KEY,
  COMMAND_API_URL,
  COMMAND_CONFIG_FILE,
  COMMAND_DASHBOARD,
  COMMAND_DEBUG,
  COMMAND_DISABLE,
  COMMAND_LOG_FILE,
  COMMAND_PROXY,
  COMMAND_STATUS_BAR_CODING_ACTIVITY,
  COMMAND_STATUS_BAR_ENABLED,
  LogLevel,
} from './constants';
import { Logger } from './logger';
import { CodingCam } from './codingcam';

var logger = new Logger(LogLevel.INFO);
var codingcam: CodingCam;

export function activate(ctx: vscode.ExtensionContext) {
  codingcam = new CodingCam(ctx.extensionPath, logger);

  ctx.globalState?.setKeysForSync(['codingcam.apiKey']);

  ctx.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_API_KEY, function () {
      codingcam.promptForApiKey();
    }),
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_API_URL, function () {
      codingcam.promptForApiUrl();
    }),
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_PROXY, function () {
      codingcam.promptForProxy();
    }),
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_DEBUG, function () {
      codingcam.promptForDebug();
    }),
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_DISABLE, function () {
      codingcam.promptToDisable();
    }),
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_STATUS_BAR_ENABLED, function () {
      codingcam.promptStatusBarIcon();
    }),
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_STATUS_BAR_CODING_ACTIVITY, function () {
      codingcam.promptStatusBarCodingActivity();
    }),
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_DASHBOARD, function () {
      codingcam.openDashboardWebsite();
    }),
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_CONFIG_FILE, function () {
      codingcam.openConfigFile();
    }),
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_LOG_FILE, function () {
      codingcam.openLogFile();
    }),
  );

  ctx.subscriptions.push(codingcam);

  codingcam.initialize();
}

export function deactivate() {
  codingcam.dispose();
}