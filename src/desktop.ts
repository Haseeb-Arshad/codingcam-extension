import * as fs from 'fs';
import * as os from 'os';

export class Desktop {
  public static isWindows(): boolean {
    return os.platform() === 'win32';
  }

  public static isPortable(): boolean {
    return !!process.env['VSCODE_PORTABLE'];
  }

  public static getHomeDirectory(): string {
    let home = process.env.CODINGCAM_HOME;
    if (home && home.trim() && fs.existsSync(home.trim()))
      return home.trim();
    if (this.isPortable())
      return process.env['VSCODE_PORTABLE'] as string;
    return process.env[this.isWindows() ? 'USERPROFILE' : 'HOME'] || process.cwd();
  }

  public static buildOptions(): Record<string, any> {
    const options: Record<string, any> = {
      windowsHide: true,
    };
    if (!this.isWindows() && !process.env.CODINGCAM_HOME && !process.env.HOME) {
      options['env'] = { ...process.env, CODINGCAM_HOME: this.getHomeDirectory() };
    }
    return options;
  }
}