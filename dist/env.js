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
exports.loadEnvironment = loadEnvironment;
exports.getApiUrl = getApiUrl;
exports.getFrontendUrl = getFrontendUrl;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function loadEnvironment(extensionPath) {
    try {
        const envPath = path.join(extensionPath, '.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            const envVars = envContent.split('\n')
                .filter(line => line.trim() && !line.startsWith('#'))
                .map(line => line.split('=', 2))
                .reduce((acc, [key, value]) => {
                if (key && value) {
                    acc[key.trim()] = value.trim();
                }
                return acc;
            }, {});
            // Set environment variables
            Object.entries(envVars).forEach(([key, value]) => {
                process.env[key] = value;
            });
            console.log('Environment variables loaded from .env file');
        }
    }
    catch (error) {
        console.error('Error loading environment variables:', error);
    }
}
function getApiUrl() {
    return process.env.CODINGCAM_API_URL || 'http://localhost:3001/api';
}
function getFrontendUrl() {
    return process.env.CODINGCAM_FRONTEND_URL || 'http://localhost:3000';
}
//# sourceMappingURL=env.js.map