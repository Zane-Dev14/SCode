import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { VisualizationPanel } from './visualizationPanel';

let pythonProcess: any = null;
let serverPort = 5000;

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
            progress.report({ message: 'Setting up Python environment...' });

            try {
                // Start Python backend
                await startPythonBackend(context.extensionPath);
                
                progress.report({ message: 'Scanning project...' });
                const result = await runAnalysis(workspaceFolder);

                if (result.error) {
                    vscode.window.showErrorMessage(`Analysis failed: ${result.error}`);
                    return;
                }

                progress.report({ message: 'Generating visualization...' });
                VisualizationPanel.createOrShow(context.extensionUri, result);

                vscode.window.showInformationMessage(
                    `Analysis complete! Found ${result.vulnerabilities?.length || 0} potential vulnerabilities.`
                );
            } catch (error) {
                vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    });

    context.subscriptions.push(analyzeCommand);
}

async function startPythonBackend(extensionPath: string): Promise<void> {
    // Check if Python is installed
    const pythonPath = await getPythonPath();
    const backendPath = path.join(extensionPath, 'backend');
    
    // Ensure we're not starting multiple instances
    if (pythonProcess) {
        stopPythonBackend();
    }

    // Create virtual environment if it doesn't exist
    const venvPath = path.join(backendPath, '.venv');
    if (!fs.existsSync(venvPath)) {
        await createVirtualEnvironment(pythonPath, backendPath);
    }

    // Get the Python interpreter from the virtual environment
    const venvPythonPath = process.platform === 'win32' 
        ? path.join(venvPath, 'Scripts', 'python.exe')
        : path.join(venvPath, 'bin', 'python');

    // Install requirements if needed
    await installRequirements(venvPythonPath, backendPath);

    // Start the Python API
    pythonProcess = spawn(venvPythonPath, [path.join(backendPath, 'api.py')], {
        cwd: backendPath,
        env: { ...process.env, PORT: serverPort.toString() }
    });

    // Log output for debugging
    pythonProcess.stdout.on('data', (data: Buffer) => {
        console.log(`Python backend: ${data}`);
    });

    pythonProcess.stderr.on('data', (data: Buffer) => {
        console.error(`Python backend error: ${data}`);
    });

    // Wait for server to start
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error("Timeout waiting for Python backend to start"));
        }, 10000);

        pythonProcess.stdout.on('data', (data: Buffer) => {
            if (data.toString().includes('Running on')) {
                clearTimeout(timeout);
                resolve(undefined);
            }
        });
    });
}

async function createVirtualEnvironment(pythonPath: string, backendPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const process = spawn(pythonPath, ['-m', 'venv', '.venv'], { cwd: backendPath });
        
        process.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Failed to create virtual environment (exit code: ${code})`));
            }
        });
    });
}

async function installRequirements(pythonPath: string, backendPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const process = spawn(pythonPath, ['-m', 'pip', 'install', '-r', 'requirements.txt'], {
            cwd: backendPath
        });
        
        process.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Failed to install Python dependencies (exit code: ${code})`));
            }
        });
    });
}

async function getPythonPath(): Promise<string> {
    // Try to get Python path from VSCode Python extension settings
    const pythonConfig = vscode.workspace.getConfiguration('python');
    let pythonPath = pythonConfig.get('defaultInterpreterPath');
    
    if (!pythonPath || pythonPath === 'python') {
        // Fallback to system Python
        pythonPath = process.platform === 'win32' ? 'python' : 'python3';
    }
    
    return pythonPath;
}

function stopPythonBackend() {
    if (pythonProcess) {
        pythonProcess.kill();
        pythonProcess = null;
    }
}

async function runAnalysis(workspacePath: string): Promise<any> {
    const apiUrl = `http://localhost:${serverPort}/analyze`;
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

export function deactivate() {
    stopPythonBackend();
}