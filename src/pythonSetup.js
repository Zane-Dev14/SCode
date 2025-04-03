const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const vscode = require('vscode');

class PythonManager {
    constructor() {
        this.pythonProcess = null;
        this.serverPort = 5000;
        this.venvPath = null;
    }

    async initialize() {
        try {
            await this.setupPythonEnvironment();
            await this.startPythonServer();
        } catch (error) {
            console.error('Failed to initialize Python environment:', error);
            throw error;
        }
    }

    async runPythonCommand(args, useVenv = true) {
        return new Promise((resolve, reject) => {
            const pythonPath = useVenv && this.venvPath 
                ? path.join(this.venvPath, 'bin', 'python')
                : 'python';
            
            const process = spawn(pythonPath, args);
            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(new Error(`Python command failed: ${stderr}`));
                }
            });
        });
    }

    async setupPythonEnvironment() {
        const backendPath = path.join(__dirname, '..', 'backend');
        if (!fs.existsSync(backendPath)) {
            throw new Error('backend directory not found');
        }

        // Set up virtual environment
        this.venvPath = path.join(backendPath, '.venv');
        if (!fs.existsSync(this.venvPath)) {
            await this.runPythonCommand(['-m', 'venv', this.venvPath], false);
        }

        const requirementsPath = path.join(backendPath, 'requirements.txt');
        if (!fs.existsSync(requirementsPath)) {
            throw new Error('backend/requirements.txt not found');
        }

        // Install requirements using venv pip
        const pipPath = path.join(this.venvPath, 'bin', 'pip');
        const installProcess = spawn(pipPath, ['install', '-r', requirementsPath]);
        
        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';

            installProcess.stdout.on('data', (data) => {
                stdout += data.toString();
                console.log(`pip install: ${data}`);
            });

            installProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                console.error(`pip install error: ${data}`);
            });

            installProcess.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`pip install failed: ${stderr}`));
                }
            });
        });
    }

    async startPythonServer() {
        const serverPath = path.join(__dirname, '..', 'backend', 'api.py');
        if (!fs.existsSync(serverPath)) {
            throw new Error('backend/api.py not found');
        }

        const pythonPath = path.join(this.venvPath, 'bin', 'python');
        this.pythonProcess = spawn(pythonPath, [serverPath], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        this.pythonProcess.stdout.on('data', (data) => {
            console.log(`Python server: ${data}`);
        });

        this.pythonProcess.stderr.on('data', (data) => {
            console.error(`Python server error: ${data}`);
        });

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Python server startup timeout'));
            }, 10000);

            this.pythonProcess.stderr.on('data', (data) => {
                if (data.toString().includes('Running on http://')) {
                    clearTimeout(timeout);
                    setTimeout(() => {
                        this.checkServerHealth()
                            .then(() => resolve())
                            .catch(err => reject(new Error(`Server health check failed: ${err.message}`)));
                    }, 1000);
                }
            });
        });
    }

    async checkServerHealth() {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: this.serverPort,
                path: '/health',
                method: 'GET',
                timeout: 5000
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            const response = JSON.parse(data);
                            if (response.status === 'healthy') {
                                resolve();
                            } else {
                                reject(new Error('Server reported unhealthy status'));
                            }
                        } catch (error) {
                            reject(new Error(`Failed to parse health response: ${error.message}`));
                        }
                    } else {
                        reject(new Error(`Health check failed with status: ${res.statusCode}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Health check request failed: ${error.message}`));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Health check request timed out'));
            });

            req.end();
        });
    }

    async analyzeCode(code, fileName) {
        return new Promise((resolve, reject) => {
            // Get the workspace folder path
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
            if (!workspaceFolder) {
                reject(new Error('No workspace folder open'));
                return;
            }

            const postData = JSON.stringify({ project_dir: workspaceFolder });
            const options = {
                hostname: 'localhost',
                port: this.serverPort,
                path: '/analyze',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(data));
                        } catch (error) {
                            reject(new Error('Failed to parse response'));
                        }
                    } else {
                        reject(new Error(`Server responded with status: ${res.statusCode}`));
                    }
                });
            });

            req.on('error', (error) => {
                console.error('Analysis failed:', error);
                resolve({ error: error.message });
            });

            req.write(postData);
            req.end();
        });
    }

    cleanup() {
        if (this.pythonProcess) {
            this.pythonProcess.kill();
            this.pythonProcess = null;
        }
    }
}

module.exports = PythonManager; 