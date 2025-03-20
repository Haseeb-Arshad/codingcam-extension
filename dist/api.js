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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = exports.CodingCamApi = void 0;
const vscode = __importStar(require("vscode"));
const axios_1 = __importDefault(require("axios"));
const os = __importStar(require("os"));
class CodingCamApi {
    constructor() {
        // Get API URL from settings
        const config = vscode.workspace.getConfiguration('codingcam');
        this.apiUrl = config.get('apiUrl') || 'http://localhost:3001/api';
        this.token = config.get('apiKey');
    }
    async sendHeartbeat(data) {
        if (!this.token) {
            vscode.window.showWarningMessage('CodingCam API key not set. Please configure it in settings.');
            return;
        }
        try {
            const timestamp = new Date(data.time * 1000).toISOString();
            const payload = {
                project_name: data.project,
                language_name: data.language,
                editor: 'vscode',
                platform: os.platform(),
                file_path: data.entity,
                line_count: data.lines,
                cursor_position: data.cursorpos,
                started_at: timestamp,
                ended_at: timestamp
            };
            await axios_1.default.post(`${this.apiUrl}/activities`, payload, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });
        }
        catch (error) {
            vscode.window.showErrorMessage('Failed to send heartbeat to CodingCam backend.');
            console.error('Error sending heartbeat:', error);
        }
    }
    async login(email, password) {
        try {
            const response = await axios_1.default.post(`${this.apiUrl}/auth/login`, { email, password });
            const token = response.data.token;
            if (token) {
                this.token = token;
                await vscode.workspace.getConfiguration('codingcam').update('apiKey', token, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('Login successful!');
                return token;
            }
            vscode.window.showErrorMessage('Login failed: No token received.');
            return null;
        }
        catch (error) {
            vscode.window.showErrorMessage('Login failed. Check your credentials.');
            console.error('Login error:', error);
            return null;
        }
    }
    async register(email, password, username, fullName) {
        try {
            const response = await axios_1.default.post(`${this.apiUrl}/auth/register`, { email, password, username, fullName });
            const token = response.data.token;
            if (token) {
                this.token = token;
                await vscode.workspace.getConfiguration('codingcam').update('apiKey', token, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('Registration successful!');
                return token;
            }
            vscode.window.showErrorMessage('Registration failed: No token received.');
            return null;
        }
        catch (error) {
            vscode.window.showErrorMessage('Registration failed.');
            console.error('Registration error:', error);
            return null;
        }
    }
    async getUserStats(startDate, endDate) {
        if (!this.token) {
            throw new Error('CodingCam API key not set');
        }
        try {
            const response = await axios_1.default.get(`${this.apiUrl}/analytics/daily`, {
                params: { startDate, endDate },
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        }
        catch (error) {
            console.error('Error fetching user stats:', error);
            throw error;
        }
    }
}
exports.CodingCamApi = CodingCamApi;
function activate(context) {
    const api = new CodingCamApi();
    context.subscriptions.push(vscode.commands.registerCommand('codingcam.login', async () => {
        const email = await vscode.window.showInputBox({ prompt: 'Email' });
        const password = await vscode.window.showInputBox({ prompt: 'Password', password: true });
        if (email && password)
            await api.login(email, password);
    }), vscode.commands.registerCommand('codingcam.register', async () => {
        const email = await vscode.window.showInputBox({ prompt: 'Email' });
        const password = await vscode.window.showInputBox({ prompt: 'Password', password: true });
        const username = await vscode.window.showInputBox({ prompt: 'Username' });
        if (email && password && username)
            await api.register(email, password, username);
    }), vscode.workspace.onDidChangeTextDocument(async (e) => {
        await api.sendHeartbeat({
            entity: e.document.fileName,
            type: 'file',
            time: Math.floor(Date.now() / 1000),
            is_write: true
        });
    }));
}
exports.activate = activate;
//# sourceMappingURL=api.js.map