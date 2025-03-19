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
exports.CodingCamApi = void 0;
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
            console.log('CodingCam API key not set');
            return;
        }
        try {
            const payload = {
                project_name: data.project,
                language_name: data.language,
                editor: 'vscode',
                platform: os.platform(),
                file_path: data.entity,
                line_count: data.lines,
                cursor_position: data.cursorpos,
                duration_seconds: 0,
                started_at: new Date(data.time * 1000).toISOString(),
                ended_at: new Date(data.time * 1000).toISOString() // Same as started_at for heartbeats
            };
            await axios_1.default.post(`${this.apiUrl}/activities`, payload, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });
        }
        catch (error) {
            console.error('Error sending heartbeat to CodingCam backend:', error);
        }
    }
    async login(email, password) {
        try {
            const response = await axios_1.default.post(`${this.apiUrl}/auth/login`, {
                email,
                password
            });
            if (response.data && response.data.token) {
                return response.data.token;
            }
            return null;
        }
        catch (error) {
            console.error('Login error:', error);
            return null;
        }
    }
    async register(email, password, username, fullName) {
        try {
            const response = await axios_1.default.post(`${this.apiUrl}/auth/register`, {
                email,
                password,
                username,
                fullName
            });
            if (response.data && response.data.token) {
                return response.data.token;
            }
            return null;
        }
        catch (error) {
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
//# sourceMappingURL=api.js.map