import * as fs from 'fs';
import * as path from 'path';

export function loadEnvironment(extensionPath: string): void {
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
        }, {} as Record<string, string>);
      
      // Set environment variables
      Object.entries(envVars).forEach(([key, value]) => {
        process.env[key] = value;
      });
      
      console.log('Environment variables loaded from .env file');
    }
  } catch (error) {
    console.error('Error loading environment variables:', error);
  }
}

export function getApiUrl(): string {
  return process.env.CODINGCAM_API_URL || 'http://localhost:3001/api';
}

export function getFrontendUrl(): string {
  return process.env.CODINGCAM_FRONTEND_URL || 'http://localhost:3000';
} 