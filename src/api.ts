import * as vscode from 'vscode';
import axios from 'axios';
import * as os from 'os';

export class CodingCamApi {
  private apiUrl: string;
  private token: string | undefined;

  constructor() {
    // Get API URL from settings
    const config = vscode.workspace.getConfiguration('codingcam');
    this.apiUrl = config.get('apiUrl') || 'http://localhost:3001/api';
    this.token = config.get('apiKey');
  }

  async sendHeartbeat(data: {
    entity: string;
    type: string;
    time: number;
    project?: string;
    language?: string;
    lines?: number;
    lineno?: number;
    cursorpos?: number;
    is_write: boolean;
  }): Promise<void> {
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

      await axios.post(`${this.apiUrl}/activities`, payload, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Error sending heartbeat to CodingCam backend:', error);
    }
  }

  async login(email: string, password: string): Promise<string | null> {
    try {
      const response = await axios.post(`${this.apiUrl}/auth/login`, {
        email,
        password
      });

      if (response.data && response.data.token) {
        return response.data.token;
      }
      return null;
    } catch (error) {
      console.error('Login error:', error);
      return null;
    }
  }

  async register(email: string, password: string, username: string, fullName?: string): Promise<string | null> {
    try {
      const response = await axios.post(`${this.apiUrl}/auth/register`, {
        email,
        password,
        username,
        fullName
      });

      if (response.data && response.data.token) {
        return response.data.token;
      }
      return null;
    } catch (error) {
      console.error('Registration error:', error);
      return null;
    }
  }

  async getUserStats(startDate: string, endDate: string): Promise<any> {
    if (!this.token) {
      throw new Error('CodingCam API key not set');
    }

    try {
      const response = await axios.get(`${this.apiUrl}/analytics/daily`, {
        params: { startDate, endDate },
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching user stats:', error);
      throw error;
    }
  }
}