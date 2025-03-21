"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = exports.COMMAND_STATUS_BAR_ENABLED = exports.COMMAND_STATUS_BAR_CODING_ACTIVITY = exports.COMMAND_PROXY = exports.COMMAND_LOG_FILE = exports.COMMAND_DISABLE = exports.COMMAND_DEBUG = exports.COMMAND_DASHBOARD = exports.COMMAND_CONFIG_FILE = exports.COMMAND_API_URL = exports.COMMAND_API_KEY = void 0;
exports.COMMAND_API_KEY = 'codingcam.apikey';
exports.COMMAND_API_URL = 'codingcam.apiurl';
exports.COMMAND_CONFIG_FILE = 'codingcam.config_file';
exports.COMMAND_DASHBOARD = 'codingcam.dashboard';
exports.COMMAND_DEBUG = 'codingcam.debug';
exports.COMMAND_DISABLE = 'codingcam.disable';
exports.COMMAND_LOG_FILE = 'codingcam.log_file';
exports.COMMAND_PROXY = 'codingcam.proxy';
exports.COMMAND_STATUS_BAR_CODING_ACTIVITY = 'codingcam.status_bar_coding_activity';
exports.COMMAND_STATUS_BAR_ENABLED = 'codingcam.status_bar_enabled';
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
//# sourceMappingURL=constants.js.map