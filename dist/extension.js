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
var api;
function activate(ctx) {
    // Load environment variables
    (0, env_1.loadEnvironment)(ctx.extensionPath);
    // Initialize API
    api = new api_1.CodingCamBackendApi(logger);
    // Initialize CodingCam
    codingcam = new codingcam_1.CodingCam(ctx.extensionPath, logger, api);
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
        const fullName = await vscode.window.showInputBox({
            prompt: 'Enter your full name (optional)',
            placeHolder: 'John Doe'
        });
        // Show progress notification
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Registering account...",
            cancellable: false
        }, async (progress) => {
            // Register user
            const result = await api.register(email, password, username, fullName || undefined);
            if (result) {
                // Save API key
                await vscode.workspace.getConfiguration().update('codingcam.apiKey', result.apiKey, true);
                // Log success
                logger.info(`Successfully registered user: ${username}`);
                // Update API with the new API key
                api.updateApiKey(result.apiKey);
                // Notify user
                vscode.window.showInformationMessage('Registration successful! Your API key has been saved.');
                // Verify connection
                const isConnected = await api.verifyConnection();
                if (isConnected) {
                    vscode.window.showInformationMessage('Connected to CodingCam backend successfully!');
                }
                else {
                    vscode.window.showWarningMessage('Registration was successful but connection to the backend could not be verified.');
                }
                // Re-initialize codingcam with the new API key
                codingcam.initialize();
                return true;
            }
            else {
                vscode.window.showErrorMessage('Registration failed. Please try again.');
                return false;
            }
        });
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
        // Show progress notification
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Logging in...",
            cancellable: false
        }, async (progress) => {
            // Login user
            const result = await api.login(email, password);
            if (result) {
                // Save API key
                await vscode.workspace.getConfiguration().update('codingcam.apiKey', result.apiKey, true);
                // Log success
                logger.info(`Successfully logged in user: ${email}`);
                // Update API with the new API key
                api.updateApiKey(result.apiKey);
                // Notify user
                vscode.window.showInformationMessage('Login successful! Your API key has been saved.');
                // Verify connection
                const isConnected = await api.verifyConnection();
                if (isConnected) {
                    vscode.window.showInformationMessage('Connected to CodingCam backend successfully!');
                }
                else {
                    vscode.window.showWarningMessage('Login was successful but connection to the backend could not be verified.');
                }
                // Re-initialize codingcam with the new API key
                codingcam.initialize();
                return true;
            }
            else {
                vscode.window.showErrorMessage('Login failed. Please check your credentials and try again.');
                return false;
            }
        });
    }));
    // Add a command to verify API key
    ctx.subscriptions.push(vscode.commands.registerCommand('codingcam.verify_connection', async function () {
        const apiKey = vscode.workspace.getConfiguration('codingcam').get('apiKey');
        if (!apiKey) {
            vscode.window.showErrorMessage('No API key set. Please login or register first.');
            return;
        }
        // Show progress notification
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Verifying connection...",
            cancellable: false
        }, async (progress) => {
            const isValid = await api.verifyConnection();
            if (isValid) {
                vscode.window.showInformationMessage('Connection to CodingCam backend is valid!');
                return true;
            }
            else {
                vscode.window.showErrorMessage('Connection failed. Your API key may be invalid or the server is unreachable.');
                return false;
            }
        });
    }));
    ctx.subscriptions.push(codingcam);
    // Check if API key is set and valid on startup
    checkApiKeyAndInitialize();
}
async function checkApiKeyAndInitialize() {
    const apiKey = vscode.workspace.getConfiguration('codingcam').get('apiKey');
    if (apiKey) {
        // API key exists, validate it
        const isValid = await api.validateApiKey(apiKey);
        if (isValid) {
            logger.info('API key validated successfully');
            codingcam.initialize();
        }
        else {
            // Show warning that the key is invalid
            vscode.window.showWarningMessage('Your CodingCam API key appears to be invalid. Please login again or register for a new account.', 'Login', 'Register')
                .then(selection => {
                if (selection === 'Login') {
                    vscode.commands.executeCommand('codingcam.login');
                }
                else if (selection === 'Register') {
                    vscode.commands.executeCommand('codingcam.register');
                }
            });
        }
    }
    else {
        // No API key, prompt user to login or register
        vscode.window.showInformationMessage('CodingCam requires authentication. Please login or register.', 'Login', 'Register')
            .then(selection => {
            if (selection === 'Login') {
                vscode.commands.executeCommand('codingcam.login');
            }
            else if (selection === 'Register') {
                vscode.commands.executeCommand('codingcam.register');
            }
        });
    }
}
function deactivate() {
    codingcam.dispose();
}
//# sourceMappingURL=extension.js.map