import * as vscode from 'vscode';
import axios from 'axios';
import * as os from 'os';
import { Logger } from './logger';
import { ActivityPayload } from './sessionManager';

export class CodingCamBackendApi {
  private apiUrl: string;
  private apiKey: string | undefined;
  private logger: Logger;

  constructor(logger: Logger) {
    // Get API URL and key from settings with localhost as default
    const config = vscode.workspace.getConfiguration('codingcam');
    this.apiUrl = config.get('apiUrl') || 'http://localhost:3001/api';
    this.apiKey = config.get('apiKey');
    this.logger = logger;
    
    this.logger.info('CodingCam API initialized with URL: ' + this.apiUrl);
  }

  // Update the API key when it changes
  updateApiKey(apiKey: string | undefined) {
    this.apiKey = apiKey;
    this.logger.info('API key updated');
  }

  // Get current API key
  getApiKey(): string | undefined {
    return this.apiKey;
  }

  // Check if the API key is valid
  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await axios.get(`${this.apiUrl}/auth/verify-api-key`, {
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      return response.data?.valid === true;
    } catch (error) {
      this.logger.error(`API key validation error: ${error}`);
      return false;
    }
  }

  // Send a coding session to the backend
  async sendSessionData(sessionData: ActivityPayload): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn('API key not set. Please login or register first.');
      throw new Error('API key not set. Please login or register first.');
    }

    try {
      this.logger.debug(`Sending session data: ${JSON.stringify(sessionData)}`);
      
      const response = await axios.post(`${this.apiUrl}/extension/sessions`, sessionData, {
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      this.logger.debug(`Session data response: ${response.status} ${response.statusText}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`API Error: ${error.message}`);
        this.logger.error(`Request URL: ${error.config?.url}`);
        if (error.response?.data) {
          this.logger.error(`Response: ${JSON.stringify(error.response.data)}`);
        }
        this.logger.error(`Status: ${error.response?.status}`);
      } else {
        this.logger.error(`Unknown error: ${error}`);
      }
      throw error;
    }
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
    if (!this.apiKey) {
      this.logger.warn('API key not set. Please login or register first.');
      throw new Error('API key not set. Please login or register first.');
    }

    try {
      const payload = {
        project_name: data.project || '',
        language_name: data.language || '',
        editor: 'vscode',
        platform: os.platform(),
        file_path: data.entity,
        line_count: data.lines || 0,
        cursor_position: data.cursorpos || 0,
        duration_seconds: 0, // Will be calculated on the server
        started_at: new Date(data.time * 1000).toISOString(),
        ended_at: new Date(data.time * 1000).toISOString() // Same as started_at for heartbeats
      };

      this.logger.debug(`Sending heartbeat payload: ${JSON.stringify(payload)}`);
      
      // Use the correct API endpoint for heartbeats
      const response = await axios.post(`${this.apiUrl}/extension/heartbeat`, payload, {
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      this.logger.debug(`Heartbeat response: ${response.status} ${response.statusText}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`API Error: ${error.message}`);
        this.logger.error(`Request URL: ${error.config?.url}`);
        if (error.response?.data) {
          this.logger.error(`Response: ${JSON.stringify(error.response.data)}`);
        }
        this.logger.error(`Status: ${error.response?.status}`);
      } else {
        this.logger.error(`Unknown error: ${error}`);
      }
      throw error;
    }
  }

  async login(email: string, password: string): Promise<{ token: string, apiKey: string } | null> {
    try {
      const response = await axios.post(`${this.apiUrl}/auth/login`, {
        email,
        password
      });

      if (response.data && response.data.token && response.data.apiKey) {
        return {
          token: response.data.token,
          apiKey: response.data.apiKey
        };
      }
      return null;
    } catch (error) {
      this.logger.error(`Login error: ${error}`);
      return null;
    }
  }

  async register(email: string, password: string, username: string, fullName?: string): Promise<{ token: string, apiKey: string } | null> {
    try {
      const response = await axios.post(`${this.apiUrl}/auth/register`, {
        email,
        password,
        username,
        fullName
      });

      if (response.data && response.data.token && response.data.apiKey) {
        return {
          token: response.data.token,
          apiKey: response.data.apiKey
        };
      }
      return null;
    } catch (error) {
      this.logger.error(`Registration error: ${error}`);
      return null;
    }
  }

  // Verify the extension's connection with the backend
  async verifyConnection(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await axios.get(`${this.apiUrl}/extension/status`, {
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      return response.data?.status === 'ok';
    } catch (error) {
      this.logger.error(`Connection verification error: ${error}`);
      return false;
    }
  }
}