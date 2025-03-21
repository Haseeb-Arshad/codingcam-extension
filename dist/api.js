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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodingCamBackendApi = void 0;
const vscode = __importStar(require("vscode"));
const axios_1 = __importDefault(require("axios"));
const os = __importStar(require("os"));
class CodingCamBackendApi {
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
                duration_seconds: 0, // Will be calculated on the server
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
}
exports.CodingCamBackendApi = CodingCamBackendApi;
//# sourceMappingURL=api.js.map