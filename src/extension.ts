import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { VisualizationPanel } from './visualizationPanel';

export function activate(context: vscode.ExtensionContext) {
    console.log('SCode Analyzer extension is now active!');

    // Register command to analyze workspace
    let analyzeCommand = vscode.commands.registerCommand('scode.analyzeWorkspace', async () => {
        // Get workspace folder
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
                // Run analysis
                const result = await runAnalysis(workspaceFolder);
                
                if (result.error) {
                    vscode.window.showErrorMessage(`Analysis failed: ${result.error}`);
                    return;
                }
                
                progress.report({ message: 'Generating visualization...' });
                
                // Create or show visualization panel
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

/**
 * Run the analysis on the given workspace folder
 */
async function runAnalysis(workspacePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
        // Set environment variables
        const env = Object.assign({}, process.env, {
            PROJECT_DIR: workspacePath,
            AST_OUTPUT: path.join(workspacePath, '.scode_ast_output.json')
        });

        // Run the analyzer script
        exec('python /app/backend/analyzer.py', { env }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Analyzer error: ${error.message}`);
                console.error(`Stderr: ${stderr}`);
                reject(new Error(`Analysis failed: ${stderr || error.message}`));
                return;
            }
            
            try {
                const result = JSON.parse(stdout);
                resolve(result);
            } catch (e) {
                reject(new Error(`Failed to parse analyzer output: ${e instanceof Error ? e.message : String(e)}`));
            }
        });
    });
}

export function deactivate() {}