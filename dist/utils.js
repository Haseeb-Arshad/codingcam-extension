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
exports.Utils = void 0;
const vscode = __importStar(require("vscode"));
class Utils {
    static quote(str) {
        if (str.includes(' '))
            return `"${str.replace('"', '\\"')}"`;
        return str;
    }
    static apiKeyInvalid(key) {
        // For development/testing, accept any non-empty string
        if (!key || key.trim() === '')
            return 'API key cannot be empty';
        return '';
        // Original validation - uncomment for production
        /*
        const err = 'Invalid api key... check https://codingcam.com/api-key for your key';
        if (!key) return err;
        const re = new RegExp(
          '^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$',
          'i',
        );
        if (!re.test(key)) return err;
        return '';
        */
    }
    static validateProxy(proxy) {
        if (!proxy)
            return '';
        let re;
        if (proxy.indexOf('\\') === -1) {
            re = new RegExp('^((https?|socks5)://)?([^:@]+(:([^:@])+)?@)?[\\w\\.-]+(:\\d+)?$', 'i');
        }
        else {
            re = new RegExp('^.*\\\\.+$', 'i');
        }
        if (!re.test(proxy)) {
            const ipv6 = new RegExp('^((https?|socks5)://)?([^:@]+(:([^:@])+)?@)?(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]).){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]).){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))(:\\d+)?$', 'i');
            if (!ipv6.test(proxy)) {
                return 'Invalid proxy. Valid formats are https://user:pass@host:port or socks5://user:pass@host:port or domain\\user:pass';
            }
        }
        return '';
    }
    static formatDate(date) {
        let months = [
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'May',
            'Jun',
            'Jul',
            'Aug',
            'Sep',
            'Oct',
            'Nov',
            'Dec',
        ];
        let ampm = 'AM';
        let hour = date.getHours();
        if (hour > 11) {
            ampm = 'PM';
            hour = hour - 12;
        }
        if (hour == 0) {
            hour = 12;
        }
        let minute = date.getMinutes();
        return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} ${hour}:${minute < 10 ? `0${minute}` : minute} ${ampm}`;
    }
    static obfuscateKey(key) {
        let newKey = '';
        if (key) {
            newKey = key;
            if (key.length > 4)
                newKey = 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXX' + key.substring(key.length - 4);
        }
        return newKey;
    }
    static wrapArg(arg) {
        if (arg.indexOf(' ') > -1)
            return '"' + arg.replace(/"/g, '\\"') + '"';
        return arg;
    }
    static formatArguments(binary, args) {
        let clone = args.slice(0);
        clone.unshift(this.wrapArg(binary));
        let newCmds = [];
        let lastCmd = '';
        for (let i = 0; i < clone.length; i++) {
            if (lastCmd == '--key')
                newCmds.push(this.wrapArg(this.obfuscateKey(clone[i])));
            else
                newCmds.push(this.wrapArg(clone[i]));
            lastCmd = clone[i];
        }
        return newCmds.join(' ');
    }
    static isRemoteUri(uri) {
        if (!uri)
            return false;
        return uri.scheme == 'vscode-remote';
    }
    static isPullRequest(uri) {
        if (!uri)
            return false;
        return uri.scheme == 'pr';
    }
    static getEditorName() {
        if (this.appNames[vscode.env.appName]) {
            return this.appNames[vscode.env.appName];
        }
        else if (vscode.env.appName.toLowerCase().includes('visual')) {
            return 'vscode';
        }
        else {
            return vscode.env.appName.replace(/\s/g, '').toLowerCase();
        }
    }
}
exports.Utils = Utils;
Utils.appNames = {
    'Arduino IDE': 'arduino',
    'Azure Data Studio': 'azdata',
    Cursor: 'cursor',
    Onivim: 'onivim',
    'Onivim 2': 'onivim',
    'SQL Operations Studio': 'sqlops',
    'Visual Studio Code': 'vscode',
    Windsurf: 'windsurf',
};
//# sourceMappingURL=utils.js.map