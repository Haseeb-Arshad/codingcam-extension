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
const api_1 = require("./api");
function activate(context) {
    const api = new api_1.CodingCamApi();
    // Command: Login
    let loginCommand = vscode.commands.registerCommand('codingcam.login', async () => {
        const email = await vscode.window.showInputBox({ prompt: 'Enter your email' });
        const password = await vscode.window.showInputBox({ prompt: 'Enter your password', password: true });
        if (email && password) {
            const token = await api.login(email, password);
            if (token) {
                await vscode.workspace.getConfiguration('codingcam').update('apiKey', token, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('Logged in successfully!');
            }
            else {
                vscode.window.showErrorMessage('Login failed.');
            }
        }
    });
    // Command: Register
    let registerCommand = vscode.commands.registerCommand('codingcam.register', async () => {
        const email = await vscode.window.showInputBox({ prompt: 'Enter your email' });
        const password = await vscode.window.showInputBox({ prompt: 'Enter your password', password: true });
        const username = await vscode.window.showInputBox({ prompt: 'Enter your username' });
        const fullName = await vscode.window.showInputBox({ prompt: 'Enter your full name (optional)' });
        if (email && password && username) {
            const token = await api.register(email, password, username, fullName);
            if (token) {
                await vscode.workspace.getConfiguration('codingcam').update('apiKey', token, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('Registered and logged in successfully!');
            }
            else {
                vscode.window.showErrorMessage('Registration failed.');
            }
        }
    });
    // Command: View Stats
    let statsCommand = vscode.commands.registerCommand('codingcam.viewStats', async () => {
        const startDate = await vscode.window.showInputBox({ prompt: 'Enter start date (YYYY-MM-DD)' });
        const endDate = await vscode.window.showInputBox({ prompt: 'Enter end date (YYYY-MM-DD)' });
        if (startDate && endDate) {
            try {
                const stats = await api.getUserStats(startDate, endDate);
                vscode.window.showInformationMessage(`Stats: ${JSON.stringify(stats)}`);
            }
            catch (error) {
                vscode.window.showErrorMessage('Failed to fetch stats.');
            }
        }
    });
    // Heartbeat on text document change
    vscode.workspace.onDidChangeTextDocument((event) => {
        const document = event.document;
        api.sendHeartbeat({
            entity: document.fileName,
            type: 'file',
            time: Math.floor(Date.now() / 1000),
            project: vscode.workspace.name,
            language: document.languageId,
            lines: document.lineCount,
            cursorpos: 0, // You could enhance this to track actual cursor position
            is_write: true
        });
    });
    context.subscriptions.push(loginCommand, registerCommand, statsCommand);
}
function deactivate() {
    // Cleanup if needed
}
//# sourceMappingURL=extension.js.map