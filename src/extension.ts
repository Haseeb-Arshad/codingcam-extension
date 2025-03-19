import * as vscode from 'vscode';
import { CodingCamApi } from './api';

export function activate(context: vscode.ExtensionContext) {
    const api = new CodingCamApi();

    // Command: Login
    let loginCommand = vscode.commands.registerCommand('codingcam.login', async () => {
        const email = await vscode.window.showInputBox({ prompt: 'Enter your email' });
        const password = await vscode.window.showInputBox({ prompt: 'Enter your password', password: true });
        if (email && password) {
            const token = await api.login(email, password);
            if (token) {
                await vscode.workspace.getConfiguration('codingcam').update('apiKey', token, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('Logged in successfully!');
            } else {
                vscode.window.showErrorMessage('Login failed.');
            }
        }
    });

    // Command: Register
    let registerCommand = vscode.commands.registerCommand('codingcam.register', async () => {
        const email = await vscode.window.showInputBox({ prompt: 'Enter your email' });
        const password = await vscode.window.showInputBox({ prompt: 'Enter your password', password: true });
        const username = await vscode.window.showInputBox({ prompt: 'Enter your username' });
        const fullName = await vscode.window.showInputBox({ prompt: 'Enter your full name (optional)' });
        if (email && password && username) {
            const token = await api.register(email, password, username, fullName);
            if (token) {
                await vscode.workspace.getConfiguration('codingcam').update('apiKey', token, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('Registered and logged in successfully!');
            } else {
                vscode.window.showErrorMessage('Registration failed.');
            }
        }
    });

    // Command: View Stats
    let statsCommand = vscode.commands.registerCommand('codingcam.viewStats', async () => {
        const startDate = await vscode.window.showInputBox({ prompt: 'Enter start date (YYYY-MM-DD)' });
        const endDate = await vscode.window.showInputBox({ prompt: 'Enter end date (YYYY-MM-DD)' });
        if (startDate && endDate) {
            try {
                const stats = await api.getUserStats(startDate, endDate);
                vscode.window.showInformationMessage(`Stats: ${JSON.stringify(stats)}`);
            } catch (error) {
                vscode.window.showErrorMessage('Failed to fetch stats.');
            }
        }
    });

    // Heartbeat on text document change
    vscode.workspace.onDidChangeTextDocument((event) => {
        const document = event.document;
        api.sendHeartbeat({
            entity: document.fileName,
            type: 'file',
            time: Math.floor(Date.now() / 1000),
            project: vscode.workspace.name,
            language: document.languageId,
            lines: document.lineCount,
            cursorpos: 0, // You could enhance this to track actual cursor position
            is_write: true
        });
    });

    context.subscriptions.push(loginCommand, registerCommand, statsCommand);
}

export function deactivate() {
    // Cleanup if needed
}