"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const constants_1 = require("./constants");
class Logger {
    constructor(level) {
        this.setLevel(level);
    }
    getLevel() {
        return this.level;
    }
    setLevel(level) {
        this.level = level;
    }
    log(level, msg) {
        if (level >= this.level) {
            msg = `[CodingCam][${constants_1.LogLevel[level]}] ${msg}`;
            if (level == constants_1.LogLevel.DEBUG)
                console.log(msg);
            if (level == constants_1.LogLevel.INFO)
                console.info(msg);
            if (level == constants_1.LogLevel.WARN)
                console.warn(msg);
            if (level == constants_1.LogLevel.ERROR)
                console.error(msg);
        }
    }
    debug(msg) {
        this.log(constants_1.LogLevel.DEBUG, msg);
    }
    debugException(msg) {
        if (msg.message !== undefined) {
            this.log(constants_1.LogLevel.DEBUG, msg.message);
        }
        else {
            this.log(constants_1.LogLevel.DEBUG, msg.toString());
        }
    }
    info(msg) {
        this.log(constants_1.LogLevel.INFO, msg);
    }
    warn(msg) {
        this.log(constants_1.LogLevel.WARN, msg);
    }
    warnException(msg) {
        if (msg.message !== undefined) {
            this.log(constants_1.LogLevel.WARN, msg.message);
        }
        else {
            this.log(constants_1.LogLevel.WARN, msg.toString());
        }
    }
    error(msg) {
        this.log(constants_1.LogLevel.ERROR, msg);
    }
    errorException(msg) {
        if (msg.message !== undefined) {
            this.log(constants_1.LogLevel.ERROR, msg.message);
        }
        else {
            this.log(constants_1.LogLevel.ERROR, msg.toString());
        }
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map