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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const constants_1 = require("./constants");
const logger_1 = require("./logger");
const codingcam_1 = require("./codingcam");
const api_1 = require("./api");
const env_1 = require("./env");
var logger = new logger_1.Logger(constants_1.LogLevel.INFO);
var codingcam;
function activate(ctx) {
    // Load environment variables
    (0, env_1.loadEnvironment)(ctx.extensionPath);
    codingcam = new codingcam_1.CodingCam(ctx.extensionPath, logger);
    ctx.globalState?.setKeysForSync(['codingcam.apiKey']);
    ctx.subscriptions.push(vscode.commands.registerCommand(constants_1.COMMAND_API_KEY, function () {
        codingcam.promptForApiKey();
    }));
    ctx.subscriptions.push(vscode.commands.registerCommand(constants_1.COMMAND_API_URL, function () {
        codingcam.promptForApiUrl();
    }));
    ctx.subscriptions.push(vscode.commands.registerCommand(constants_1.COMMAND_PROXY, function () {
        codingcam.promptForProxy();
    }));
    ctx.subscriptions.push(vscode.commands.registerCommand(constants_1.COMMAND_DEBUG, function () {
        codingcam.promptForDebug();
    }));
    ctx.subscriptions.push(vscode.commands.registerCommand(constants_1.COMMAND_DISABLE, function () {
        codingcam.promptToDisable();
    }));
    ctx.subscriptions.push(vscode.commands.registerCommand(constants_1.COMMAND_STATUS_BAR_ENABLED, function () {
        codingcam.promptStatusBarIcon();
    }));
    ctx.subscriptions.push(vscode.commands.registerCommand(constants_1.COMMAND_STATUS_BAR_CODING_ACTIVITY, function () {
        codingcam.promptStatusBarCodingActivity();
    }));
    ctx.subscriptions.push(vscode.commands.registerCommand(constants_1.COMMAND_DASHBOARD, function () {
        codingcam.openDashboardWebsite();
    }));
    ctx.subscriptions.push(vscode.commands.registerCommand(constants_1.COMMAND_CONFIG_FILE, function () {
        codingcam.openConfigFile();
    }));
    ctx.subscriptions.push(vscode.commands.registerCommand(constants_1.COMMAND_LOG_FILE, function () {
        codingcam.openLogFile();
    }));
    ctx.subscriptions.push(vscode.commands.registerCommand('codingcam.register', async function () {
        // Show registration form
        const email = await vscode.window.showInputBox({
            prompt: 'Enter your email',
            placeHolder: 'email@example.com'
        });
        if (!email)
            return;
        const password = await vscode.window.showInputBox({
            prompt: 'Create a password',
            password: true
        });
        if (!password)
            return;
        const username = await vscode.window.showInputBox({
            prompt: 'Choose a username',
        });
        if (!username)
            return;
        // Register user
        const api = new api_1.CodingCamBackendApi();
        const token = await api.register(email, password, username);
        if (token) {
            // Save token
            await vscode.workspace.getConfiguration().update('codingcam.apiKey', token, true);
            vscode.window.showInformationMessage('Registration successful!');
            codingcam.initialize();
        }
        else {
            vscode.window.showErrorMessage('Registration failed. Please try again.');
        }
    }));
    ctx.subscriptions.push(vscode.commands.registerCommand('codingcam.login', async function () {
        // Show login form
        const email = await vscode.window.showInputBox({
            prompt: 'Enter your email',
            placeHolder: 'email@example.com'
        });
        if (!email)
            return;
        const password = await vscode.window.showInputBox({
            prompt: 'Enter your password',
            password: true
        });
        if (!password)
            return;
        // Login user
        const api = new api_1.CodingCamBackendApi();
        const token = await api.login(email, password);
        if (token) {
            // Save token
            await vscode.workspace.getConfiguration().update('codingcam.apiKey', token, true);
            vscode.window.showInformationMessage('Login successful!');
            codingcam.initialize();
        }
        else {
            vscode.window.showErrorMessage('Login failed. Please check your credentials and try again.');
        }
    }));
    ctx.subscriptions.push(codingcam);
    codingcam.initialize();
}
function deactivate() {
    codingcam.dispose();
}
//# sourceMappingURL=extension.js.map