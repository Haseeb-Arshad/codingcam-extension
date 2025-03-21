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
exports.CodingCamDependencies = void 0;
const child_process = __importStar(require("child_process"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const request = __importStar(require("request"));
const semver = __importStar(require("semver"));
const which = __importStar(require("which"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const desktop_1 = require("./desktop");
var osName;
(function (osName) {
    osName["darwin"] = "darwin";
    osName["windows"] = "windows";
    osName["linux"] = "linux";
})(osName || (osName = {}));
class CodingCamDependencies {
    constructor(options, logger, resourcesLocation) {
        this.cliLocation = undefined;
        this.cliLocationGlobal = undefined;
        this.cliInstalled = false;
        this.githubDownloadUrl = 'https://github.com/Haseeb-Arshad/codingcam-cli/releases/latest/download'; // Hypothetical repo
        this.githubReleasesUrl = 'https://api.github.com/repos/Haseeb-Arshad/codingcam-cli/releases/latest'; // Hypothetical repo
        this.legacyOperatingSystems = {
            [osName.darwin]: [{ kernelLessThan: '17.0.0', tag: 'v1.0.0' }],
        };
        this.options = options;
        this.logger = logger;
        this.resourcesLocation = resourcesLocation;
    }
    getCliLocation() {
        if (this.cliLocation)
            return this.cliLocation;
        this.cliLocation = this.getCliLocationGlobal();
        if (this.cliLocation)
            return this.cliLocation;
        const osname = this.osName();
        const arch = this.architecture();
        const ext = desktop_1.Desktop.isWindows() ? '.exe' : '';
        const binary = `codingcam-cli-${osname}-${arch}${ext}`;
        this.cliLocation = path.join(this.resourcesLocation, binary);
        return this.cliLocation;
    }
    getCliLocationGlobal() {
        if (this.cliLocationGlobal)
            return this.cliLocationGlobal;
        const binaryName = `codingcam-cli${desktop_1.Desktop.isWindows() ? '.exe' : ''}`;
        const path = which.sync(binaryName, { nothrow: true });
        if (path) {
            this.cliLocationGlobal = path;
            this.logger.debug(`Using global codingcam-cli location: ${path}`);
        }
        return this.cliLocationGlobal;
    }
    isCliInstalled() {
        if (this.cliInstalled)
            return true;
        this.cliInstalled = fs.existsSync(this.getCliLocation());
        return this.cliInstalled;
    }
    checkAndInstallCli(callback) {
        if (!this.isCliInstalled()) {
            this.installCli(callback);
        }
        else {
            this.isCliLatest((isLatest) => {
                if (!isLatest) {
                    this.installCli(callback);
                }
                else {
                    callback();
                }
            });
        }
    }
    isCliLatest(callback) {
        if (this.getCliLocationGlobal()) {
            callback(true);
            return;
        }
        let args = ['--version'];
        const options = desktop_1.Desktop.buildOptions();
        try {
            child_process.execFile(this.getCliLocation(), args, options, (error, _stdout, stderr) => {
                if (!(error != null)) {
                    let currentVersion = _stdout.toString().trim() + stderr.toString().trim();
                    this.logger.debug(`Current codingcam-cli version is ${currentVersion}`);
                    if (currentVersion === '<local-build>') {
                        callback(true);
                        return;
                    }
                    const tag = this.legacyReleaseTag();
                    if (tag && currentVersion !== tag) {
                        callback(false);
                        return;
                    }
                    this.options.getSetting('internal', 'cli_version_last_accessed', true, (accessed) => {
                        const now = Math.round(Date.now() / 1000);
                        const lastAccessed = accessed.value ? parseInt(accessed.value) : 0;
                        const fourHours = 4 * 3600;
                        if (lastAccessed && lastAccessed + fourHours > now) {
                            this.logger.debug(`Skip checking for codingcam-cli updates because recently checked ${now - lastAccessed} seconds ago.`);
                            callback(true);
                            return;
                        }
                        this.logger.debug('Checking for updates to codingcam-cli...');
                        this.getLatestCliVersion((latestVersion) => {
                            if (currentVersion === latestVersion) {
                                this.logger.debug('codingcam-cli is up to date');
                                callback(true);
                            }
                            else if (latestVersion) {
                                this.logger.debug(`Found an updated codingcam-cli ${latestVersion}`);
                                callback(false);
                            }
                            else {
                                this.logger.debug('Unable to find latest codingcam-cli version');
                                callback(false);
                            }
                        });
                    });
                }
                else {
                    callback(false);
                }
            });
        }
        catch (e) {
            callback(false);
        }
    }
    getLatestCliVersion(callback) {
        this.options.getSetting('settings', 'proxy', false, (proxy) => {
            this.options.getSetting('settings', 'no_ssl_verify', false, (noSSLVerify) => {
                let options = {
                    url: this.githubReleasesUrl,
                    json: true,
                    headers: {
                        'User-Agent': 'github.com/Haseeb-Arshad/vscode-codingcam',
                    },
                };
                this.logger.debug(`Fetching latest codingcam-cli version from GitHub API: ${options.url}`);
                if (proxy.value) {
                    this.logger.debug(`Using Proxy: ${proxy.value}`);
                    options.proxy = proxy.value;
                }
                if (noSSLVerify.value === 'true')
                    options.strictSSL = false;
                try {
                    request.get(options, (error, response, json) => {
                        if (!error && response && response.statusCode == 200) {
                            this.logger.debug(`GitHub API Response ${response.statusCode}`);
                            const latestCliVersion = json['tag_name'];
                            this.logger.debug(`Latest codingcam-cli version from GitHub: ${latestCliVersion}`);
                            this.options.setSetting('internal', 'cli_version_last_accessed', String(Math.round(Date.now() / 1000)), true);
                            callback(latestCliVersion);
                        }
                        else {
                            if (response) {
                                this.logger.warn(`GitHub API Response ${response.statusCode}: ${error}`);
                            }
                            else {
                                this.logger.warn(`GitHub API Response Error: ${error}`);
                            }
                            callback('');
                        }
                    });
                }
                catch (e) {
                    this.logger.warnException(e);
                    callback('');
                }
            });
        });
    }
    installCli(callback) {
        this.logger.debug(`Downloading codingcam-cli from GitHub...`);
        const url = this.cliDownloadUrl();
        let zipFile = path.join(this.resourcesLocation, 'codingcam-cli' + this.randStr() + '.zip');
        this.downloadFile(url, zipFile, () => {
            this.extractCli(zipFile, callback);
        }, callback);
    }
    isSymlink(file) {
        try {
            return fs.lstatSync(file).isSymbolicLink();
        }
        catch (_) { }
        return false;
    }
    extractCli(zipFile, callback) {
        this.logger.debug(`Extracting codingcam-cli into "${this.resourcesLocation}"...`);
        this.backupCli();
        this.unzip(zipFile, this.resourcesLocation, (unzipped) => {
            if (!unzipped) {
                this.restoreCli();
            }
            else if (!desktop_1.Desktop.isWindows()) {
                this.removeCli();
                const cli = this.getCliLocation();
                try {
                    this.logger.debug('Chmod 755 codingcam-cli...');
                    fs.chmodSync(cli, 0o755);
                }
                catch (e) {
                    this.logger.warnException(e);
                }
                const ext = desktop_1.Desktop.isWindows() ? '.exe' : '';
                const link = path.join(this.resourcesLocation, `codingcam-cli${ext}`);
                if (!this.isSymlink(link)) {
                    try {
                        this.logger.debug(`Create symlink from codingcam-cli to ${cli}`);
                        fs.symlinkSync(cli, link);
                    }
                    catch (e) {
                        this.logger.warnException(e);
                        try {
                            fs.copyFileSync(cli, link);
                            fs.chmodSync(link, 0o755);
                        }
                        catch (e2) {
                            this.logger.warnException(e2);
                        }
                    }
                }
            }
            callback();
        });
        this.logger.debug('Finished extracting codingcam-cli.');
    }
    backupCli() {
        if (fs.existsSync(this.getCliLocation())) {
            fs.renameSync(this.getCliLocation(), `${this.getCliLocation()}.backup`);
        }
    }
    restoreCli() {
        const backup = `${this.getCliLocation()}.backup`;
        if (fs.existsSync(backup)) {
            fs.renameSync(backup, this.getCliLocation());
        }
    }
    removeCli() {
        const backup = `${this.getCliLocation()}.backup`;
        if (fs.existsSync(backup)) {
            fs.unlinkSync(backup);
        }
    }
    downloadFile(url, outputFile, callback, error) {
        this.options.getSetting('settings', 'proxy', false, (proxy) => {
            this.options.getSetting('settings', 'no_ssl_verify', false, (noSSLVerify) => {
                let options = { url: url };
                if (proxy.value) {
                    this.logger.debug(`Using Proxy: ${proxy.value}`);
                    options.proxy = proxy.value;
                }
                if (noSSLVerify.value === 'true')
                    options.strictSSL = false;
                try {
                    let r = request.get(options);
                    r.on('error', (e) => {
                        this.logger.warn(`Failed to download ${url}`);
                        this.logger.warn(e.toString());
                        error();
                    });
                    let out = fs.createWriteStream(outputFile);
                    r.pipe(out);
                    r.on('end', () => {
                        out.on('finish', () => {
                            callback();
                        });
                    });
                }
                catch (e) {
                    this.logger.warnException(e);
                    callback();
                }
            });
        });
    }
    unzip(file, outputDir, callback) {
        if (fs.existsSync(file)) {
            try {
                let zip = new adm_zip_1.default(file);
                zip.extractAllTo(outputDir, true);
                fs.unlinkSync(file);
                callback(true);
                return;
            }
            catch (e) {
                this.logger.warnException(e);
            }
            try {
                fs.unlinkSync(file);
            }
            catch (e2) {
                this.logger.warnException(e2);
            }
            callback(false);
        }
    }
    legacyReleaseTag() {
        const osname = this.osName();
        const legacyOS = this.legacyOperatingSystems[osname];
        if (!legacyOS)
            return;
        const version = legacyOS.find((spec) => {
            try {
                return semver.lt(os.release(), spec.kernelLessThan);
            }
            catch (e) {
                return false;
            }
        });
        return version?.tag;
    }
    architecture() {
        const arch = os.arch();
        if (arch.indexOf('32') > -1)
            return '386';
        if (arch.indexOf('x64') > -1)
            return 'amd64';
        return arch;
    }
    osName() {
        let osname = os.platform();
        if (osname == 'win32')
            osname = 'windows';
        return osname;
    }
    cliDownloadUrl() {
        const osname = this.osName();
        const arch = this.architecture();
        // Use legacy codingcam-cli release to support older operating systems
        const tag = this.legacyReleaseTag();
        if (tag) {
            return `https://github.com/Haseeb-Arshad/codingcam-cli/releases/download/${tag}/codingcam-cli-${osname}-${arch}.zip`;
        }
        const validCombinations = [
            'darwin-amd64',
            'darwin-arm64',
            'freebsd-386',
            'freebsd-amd64',
            'freebsd-arm',
            'linux-386',
            'linux-amd64',
            'linux-arm',
            'linux-arm64',
            'netbsd-386',
            'netbsd-amd64',
            'netbsd-arm',
            'openbsd-386',
            'openbsd-amd64',
            'openbsd-arm',
            'openbsd-arm64',
            'windows-386',
            'windows-amd64',
            'windows-arm64',
        ];
        if (!validCombinations.includes(`${osname}-${arch}`))
            this.reportMissingPlatformSupport(osname, arch);
        return `${this.githubDownloadUrl}/codingcam-cli-${osname}-${arch}.zip`;
    }
    reportMissingPlatformSupport(osname, architecture) {
        const url = `https://api.codingcam.com/api/v1/cli-missing?osname=${osname}&architecture=${architecture}&plugin=vscode`;
        this.options.getSetting('settings', 'proxy', false, (proxy) => {
            this.options.getSetting('settings', 'no_ssl_verify', false, (noSSLVerify) => {
                let options = { url: url };
                if (proxy.value)
                    options.proxy = proxy.value;
                if (noSSLVerify.value === 'true')
                    options.strictSSL = false;
                try {
                    request.get(options);
                }
                catch (e) { }
            });
        });
    }
    randStr() {
        return (Math.random() + 1).toString(36).substring(7);
    }
}
exports.CodingCamDependencies = CodingCamDependencies;
//# sourceMappingURL=dependencies.js.map