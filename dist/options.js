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
exports.Options = void 0;
const child_process = __importStar(require("child_process"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const desktop_1 = require("./desktop");
const utils_1 = require("./utils");
class Options {
    constructor(logger, resourcesFolder) {
        this.cache = {};
        this.logger = logger;
        this.configFile = path.join(desktop_1.Desktop.getHomeDirectory(), '.codingcam.cfg');
        this.internalConfigFile = path.join(resourcesFolder, 'codingcam-internal.cfg');
        this.logFile = path.join(resourcesFolder, 'codingcam.log');
    }
    async getSettingAsync(section, key) {
        return new Promise((resolve, reject) => {
            this.getSetting(section, key, false, (setting) => {
                if (setting.error) {
                    reject(setting.error);
                }
                else {
                    resolve(setting.value);
                }
            });
        });
    }
    getSetting(section, key, internal, callback) {
        fs.readFile(this.getConfigFile(internal), 'utf-8', (err, content) => {
            if (err) {
                callback({
                    error: new Error(`could not read ${this.getConfigFile(internal)}`),
                    key: key,
                    value: null,
                });
            }
            else {
                let currentSection = '';
                let lines = content.split('\n');
                for (var i = 0; i < lines.length; i++) {
                    let line = lines[i];
                    if (this.startsWith(line.trim(), '[') && this.endsWith(line.trim(), ']')) {
                        currentSection = line
                            .trim()
                            .substring(1, line.trim().length - 1)
                            .toLowerCase();
                    }
                    else if (currentSection === section) {
                        let parts = line.split('=');
                        let currentKey = parts[0].trim();
                        if (currentKey === key && parts.length > 1) {
                            callback({ key: key, value: this.removeNulls(parts[1].trim()) });
                            return;
                        }
                    }
                }
                callback({ key: key, value: null });
            }
        });
    }
    setSetting(section, key, val, internal) {
        const configFile = this.getConfigFile(internal);
        fs.readFile(configFile, 'utf-8', (err, content) => {
            if (err)
                content = '';
            let contents = [];
            let currentSection = '';
            let found = false;
            let lines = content.split('\n');
            for (var i = 0; i < lines.length; i++) {
                let line = lines[i];
                if (this.startsWith(line.trim(), '[') && this.endsWith(line.trim(), ']')) {
                    if (currentSection === section && !found) {
                        contents.push(this.removeNulls(key + ' = ' + val));
                        found = true;
                    }
                    currentSection = line
                        .trim()
                        .substring(1, line.trim().length - 1)
                        .toLowerCase();
                    contents.push(this.removeNulls(line));
                }
                else if (currentSection === section) {
                    let parts = line.split('=');
                    let currentKey = parts[0].trim();
                    if (currentKey === key) {
                        if (!found) {
                            contents.push(this.removeNulls(key + ' = ' + val));
                            found = true;
                        }
                    }
                    else {
                        contents.push(this.removeNulls(line));
                    }
                }
                else {
                    contents.push(this.removeNulls(line));
                }
            }
            if (!found) {
                if (currentSection !== section) {
                    contents.push('[' + section + ']');
                }
                contents.push(this.removeNulls(key + ' = ' + val));
            }
            fs.writeFile(configFile, contents.join('\n'), (err) => {
                if (err)
                    throw err;
            });
        });
    }
    setSettings(section, settings, internal) {
        const configFile = this.getConfigFile(internal);
        fs.readFile(configFile, 'utf-8', (err, content) => {
            if (err)
                content = '';
            let contents = [];
            let currentSection = '';
            const found = {};
            let lines = content.split('\n');
            for (var i = 0; i < lines.length; i++) {
                let line = lines[i];
                if (this.startsWith(line.trim(), '[') && this.endsWith(line.trim(), ']')) {
                    if (currentSection === section) {
                        settings.forEach((setting) => {
                            if (!found[setting.key]) {
                                contents.push(this.removeNulls(setting.key + ' = ' + setting.value));
                                found[setting.key] = true;
                            }
                        });
                    }
                    currentSection = line
                        .trim()
                        .substring(1, line.trim().length - 1)
                        .toLowerCase();
                    contents.push(this.removeNulls(line));
                }
                else if (currentSection === section) {
                    let parts = line.split('=');
                    let currentKey = parts[0].trim();
                    let keepLineUnchanged = true;
                    settings.forEach((setting) => {
                        if (currentKey === setting.key) {
                            keepLineUnchanged = false;
                            if (!found[setting.key]) {
                                contents.push(this.removeNulls(setting.key + ' = ' + setting.value));
                                found[setting.key] = true;
                            }
                        }
                    });
                    if (keepLineUnchanged) {
                        contents.push(this.removeNulls(line));
                    }
                }
                else {
                    contents.push(this.removeNulls(line));
                }
            }
            settings.forEach((setting) => {
                if (!found[setting.key]) {
                    if (currentSection !== section) {
                        contents.push('[' + section + ']');
                        currentSection = section;
                    }
                    contents.push(this.removeNulls(setting.key + ' = ' + setting.value));
                    found[setting.key] = true;
                }
            });
            fs.writeFile(configFile, contents.join('\n'), (err) => {
                if (err)
                    throw err;
            });
        });
    }
    getConfigFile(internal) {
        return internal ? this.internalConfigFile : this.configFile;
    }
    getLogFile() {
        return this.logFile;
    }
    async getApiKey() {
        if (!utils_1.Utils.apiKeyInvalid(this.cache.api_key)) {
            return this.cache.api_key;
        }
        const keyFromSettings = this.getApiKeyFromEditor();
        if (!utils_1.Utils.apiKeyInvalid(keyFromSettings)) {
            this.cache.api_key = keyFromSettings;
            return this.cache.api_key;
        }
        const keyFromEnv = this.getApiKeyFromEnv();
        if (!utils_1.Utils.apiKeyInvalid(keyFromEnv)) {
            this.cache.api_key = keyFromEnv;
            return this.cache.api_key;
        }
        try {
            const apiKeyFromVault = await this.getApiKeyFromVaultCmd();
            if (!utils_1.Utils.apiKeyInvalid(apiKeyFromVault)) {
                this.cache.api_key = apiKeyFromVault;
                return this.cache.api_key;
            }
        }
        catch (err) { }
        try {
            const apiKey = await this.getSettingAsync('settings', 'api_key');
            if (!utils_1.Utils.apiKeyInvalid(apiKey))
                this.cache.api_key = apiKey;
            return apiKey;
        }
        catch (err) {
            this.logger.debug(`Exception while reading API Key from config file: ${err}`);
            if (`${err}`.includes('spawn EPERM')) {
                vscode.window.showErrorMessage('Microsoft Defender is blocking CodingCam. Please allow CodingCam to run so it can upload code stats to your dashboard.');
            }
            return '';
        }
    }
    async getApiKeyFromVaultCmd() {
        try {
            const cmdStr = await this.getSettingAsync('settings', 'api_key_vault_cmd');
            if (!cmdStr?.trim())
                return '';
            const cmdParts = cmdStr.trim().split(' ');
            if (cmdParts.length === 0)
                return '';
            const [cmdName, ...cmdArgs] = cmdParts;
            const options = desktop_1.Desktop.buildOptions();
            const proc = child_process.spawn(cmdName, cmdArgs, options);
            let stdout = '';
            for await (const chunk of proc.stdout) {
                stdout += chunk;
            }
            let stderr = '';
            for await (const chunk of proc.stderr) {
                stderr += chunk;
            }
            const exitCode = await new Promise((resolve) => {
                proc.on('close', resolve);
            });
            if (exitCode)
                this.logger.warn(`api key vault command error (${exitCode}): ${stderr}`);
            else if (stderr && stderr.trim())
                this.logger.warn(stderr.trim());
            const apiKey = stdout.toString().trim();
            return apiKey;
        }
        catch (err) {
            this.logger.debug(`Exception while reading API Key Vault Cmd from config file: ${err}`);
            return '';
        }
    }
    getApiKeyFromEditor() {
        return vscode.workspace.getConfiguration().get('codingcam.apiKey') || '';
    }
    getApiUrlFromEditor() {
        return vscode.workspace.getConfiguration().get('codingcam.apiUrl') || '';
    }
    getApiKeyFromEnv() {
        if (this.cache.api_key_from_env !== undefined)
            return this.cache.api_key_from_env;
        this.cache.api_key_from_env = process.env.CODINGCAM_API_KEY || '';
        return this.cache.api_key_from_env;
    }
    async getApiUrl(checkSettingsFile = false) {
        let apiUrl = this.getApiUrlFromEditor();
        if (!apiUrl) {
            apiUrl = this.getApiUrlFromEnv();
        }
        if (!apiUrl && !checkSettingsFile) {
            return '';
        }
        if (!apiUrl) {
            try {
                apiUrl = await this.getSettingAsync('settings', 'api_url');
            }
            catch (err) {
                this.logger.debug(`Exception while reading API Url from config file: ${err}`);
            }
        }
        if (!apiUrl)
            apiUrl = 'https://api.codingcam.com/api/v1';
        const suffixes = ['/', '.bulk', '/users/current/heartbeats', '/heartbeats', '/heartbeat'];
        for (const suffix of suffixes) {
            if (apiUrl.endsWith(suffix)) {
                apiUrl = apiUrl.slice(0, -suffix.length);
            }
        }
        return apiUrl;
    }
    getApiUrlFromEnv() {
        if (this.cache.api_url_from_env !== undefined)
            return this.cache.api_url_from_env;
        this.cache.api_url_from_env = process.env.CODINGCAM_API_URL || '';
        return this.cache.api_url_from_env;
    }
    hasApiKey(callback) {
        this.getApiKey()
            .then((apiKey) => callback(!utils_1.Utils.apiKeyInvalid(apiKey)))
            .catch((err) => {
            this.logger.warn(`Unable to check for api key: ${err}`);
            callback(false);
        });
    }
    startsWith(outer, inner) {
        return outer.slice(0, inner.length) === inner;
    }
    endsWith(outer, inner) {
        return inner === '' || outer.slice(-inner.length) === inner;
    }
    removeNulls(s) {
        return s.replace(/\0/g, '');
    }
}
exports.Options = Options;
//# sourceMappingURL=options.js.map