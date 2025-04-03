import * as vscode from 'vscode';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class AnalyzeCaller {
    constructor(context) {
        this.context = context;
    }

    async analyzeProject() {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new Error('No workspace folder is open');
            }

            const rootPath = workspaceFolders[0].uri.fsPath;
            const outputPath = path.join(rootPath, '.scode-output');

            // Create output directory if it doesn't exist
            if (!vscode.workspace.fs.exists(vscode.Uri.file(outputPath))) {
                await vscode.workspace.fs.createDirectory(vscode.Uri.file(outputPath));
            }

            // Run analysis
            const result = await this.runAnalysis(rootPath, outputPath);
            return result;
        } catch (error) {
            vscode.window.showErrorMessage(`Analysis failed: ${error.message}`);
            throw error;
        }
    }

    async runAnalysis(rootPath, outputPath) {
        try {
            const response = await fetch('http://localhost:5000/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    project_dir: rootPath
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching analysis:', error);
            throw error;
        }
    }
}

export default AnalyzeCaller;
