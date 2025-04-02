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
            const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for Python server to start after 100 seconds'));
            }, 100000); // 100 seconds
            
            try {
                console.log(`Starting Python server with: ${pythonPath} api.py`);
                console.log(`CWD: ${backendPath}`);
                console.log(`Port: ${this.serverPort}`);
    
                this.pythonProcess = spawn(pythonPath, ['api.py'], {
                    cwd: backendPath,
                    env: { ...process.env, PORT: this.serverPort.toString() }
                });
    
                this.pythonProcess.stdout.on('data', (data) => {
                    const output = data.toString();
                    console.log(`Python stdout: ${output}`);
                    if (output.includes('Running on')) {
                        clearTimeout(timeout);
                        resolve();
                    }
                });
    
                this.pythonProcess.stderr.on('data', (data) => {
                    const errorOutput = data.toString();
                    console.error(`Python stderr: ${errorOutput}`);
                    // Optionally reject early on stderr if it indicates a fatal error
                    if (errorOutput.includes('Error') || errorOutput.includes('Exception')) {
                        clearTimeout(timeout);
                        reject(new Error(`Python server error: ${errorOutput}`));
                    }
                });
    
                this.pythonProcess.on('error', (err) => {
                    clearTimeout(timeout);
                    console.error(`Spawn error: ${err.message}`);
                    reject(err);
                });
    
                this.pythonProcess.on('exit', (code, signal) => {
                    clearTimeout(timeout);
                    if (code !== 0) {
                        console.error(`Python process exited with code ${code}, signal ${signal}`);
                        reject(new Error(`Python server exited with code ${code}`));
                    } else {
                        console.log('Python process exited normally');
                    }
                });
            } catch (error) {
                clearTimeout(timeout);
                console.error(`Try-catch error: ${error.message}`);
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