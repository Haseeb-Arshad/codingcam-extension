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
var logger = new logger_1.Logger(constants_1.LogLevel.INFO);
var codingcam;
function activate(ctx) {
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
    ctx.subscriptions.push(codingcam);
    codingcam.initialize();
}
function deactivate() {
    codingcam.dispose();
}
//# sourceMappingURL=extension.js.map