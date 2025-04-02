const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');

class PythonManager {
    constructor() {
        this.pythonProcess = null;
        this.serverPort = 5000;
    }

    async setupPythonEnvironment(extensionPath) {
        const backendPath = path.join(extensionPath, 'backend');
        const venvPath = path.join(backendPath, '.venv');
        
        try {
            // Directly use system Python 
            const pythonPath = this.findPythonSync();
            if (!pythonPath) {
                throw new Error('Python not found. Please install Python 3.7 or higher.');
            }
            
            vscode.window.showInformationMessage(`Using Python: ${pythonPath}`);
            
            // Skip venv creation if it already exists
            if (!fs.existsSync(venvPath)) {
                vscode.window.showInformationMessage('Creating virtual environment...');
                this.createVirtualEnvSync(pythonPath, backendPath);
                
                vscode.window.showInformationMessage('Installing dependencies...');
                this.installDependenciesSync(venvPath, backendPath);
            } else {
                vscode.window.showInformationMessage('Using existing virtual environment.');
            }
            
            // Start the Python server
            await this.startPythonServer(venvPath, backendPath);
            vscode.window.showInformationMessage('Python server started successfully.');
            
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to setup Python: ${error.message}`);
            console.error(error);
            throw error;
        }
    }

    findPythonSync() {
        try {
            // First try python3
            try {
                execSync('python3 --version');
                return 'python3';
            } catch (e) {
                // If python3 fails, try python
                execSync('python --version');
                return 'python';
            }
        } catch (error) {
            return null;
        }
    }

    createVirtualEnvSync(pythonPath, backendPath) {
        try {
            execSync(`${pythonPath} -m venv .venv`, { cwd: backendPath });
        } catch (error) {
            console.error('Failed to create virtual environment:', error);
            throw new Error(`Failed to create virtual environment: ${error.message}`);
        }
    }

    installDependenciesSync(venvPath, backendPath) {
        const pipPath = path.join(
            venvPath,
            process.platform === 'win32' ? 'Scripts' : 'bin',
            process.platform === 'win32' ? 'pip.exe' : 'pip'
        );

        try {
            execSync(`"${pipPath}" install -r requirements.txt`, { cwd: backendPath });
        } catch (error) {
            console.error('Failed to install dependencies:', error);
            throw new Error(`Failed to install dependencies: ${error.message}`);
        }
    }

    async startPythonServer(venvPath, backendPath) {
        const pythonPath = path.join(
            venvPath,
            process.platform === 'win32' ? 'Scripts' : 'bin',
            process.platform === 'win32' ? 'python.exe' : 'python'
        );

        if (this.pythonProcess) {
            this.pythonProcess.kill();
        }

        return new Promise((resolve, reject) => {
            // Using a shorter timeout
            const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for Python server to start'));
            }, 10000);
            
            try {
                this.pythonProcess = spawn(pythonPath, ['api.py'], {
                    cwd: backendPath,
                    env: { ...process.env, PORT: this.serverPort.toString() }
                });

                this.pythonProcess.stdout.on('data', (data) => {
                    console.log(`Python: ${data}`);
                    if (data.toString().includes('Running on')) {
                        clearTimeout(timeout);
                        resolve();
                    }
                });

                this.pythonProcess.stderr.on('data', (data) => {
                    console.error(`Python error: ${data}`);
                });

                this.pythonProcess.on('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                });

                this.pythonProcess.on('exit', (code) => {
                    if (code !== 0) {
                        clearTimeout(timeout);
                        reject(new Error(`Python server exited with code ${code}`));
                    }
                });
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }

    stopPythonServer() {
        if (this.pythonProcess) {
            this.pythonProcess.kill();
            this.pythonProcess = null;
        }
    }
}

module.exports = new PythonManager(); 