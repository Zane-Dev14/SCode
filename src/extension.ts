import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { VisualizationPanel } from './visualizationPanel';

export function activate(context: vscode.ExtensionContext) {
    console.log('SCode Analyzer extension is now active!');

    let analyzeCommand = vscode.commands.registerCommand('scode.analyzeWorkspace', async () => {
        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder open. Please open a folder first.');
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'SCode Analyzer',
            cancellable: true
        }, async (progress, token) => {
            progress.report({ message: 'Scanning project...' });

            try {
                const result = await runAnalysis(workspaceFolder);

                if (result.error) {
                    vscode.window.showErrorMessage(`Analysis failed: ${result.error}`);
                    return;
                }

                progress.report({ message: 'Generating visualization...' });

                VisualizationPanel.createOrShow(context.extensionUri, result);

                vscode.window.showInformationMessage(
                    `Analysis complete! Found ${result.vulnerabilities.length} potential vulnerabilities.`
                );
            } catch (error) {
                vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    });

    context.subscriptions.push(analyzeCommand);
}

async function runAnalysis(workspacePath: string): Promise<any> {
    const apiUrl = process.env.API_URL || 'http://localhost:5000/analyze';
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_dir: workspacePath })
    });

    if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
    }

    return response.json();
}

export function deactivate() {}