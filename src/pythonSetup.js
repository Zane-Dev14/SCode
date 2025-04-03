const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class PythonManager {
    constructor() {
        this.serverProcess = null;
    }

    async setupPythonEnvironment(extensionPath) {
        const backendPath = path.join(extensionPath, 'backend');
        this.venvPath = path.join(backendPath, '.venv');

        // Create virtual environment if it doesn't exist
        if (!fs.existsSync(this.venvPath)) {
            await this.createVirtualEnvironment(backendPath);
        }

        // Install requirements
        await this.installRequirements(backendPath);

        // Start the Python server
        await this.startPythonServer(backendPath);
    }

    async createVirtualEnvironment(backendPath) {
        return new Promise((resolve, reject) => {
            const venv = spawn('python', ['-m', 'venv', this.venvPath], {
                cwd: backendPath
            });

            venv.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Failed to create virtual environment: ${code}`));
                }
            });
        });
    }

    async installRequirements(backendPath) {
        const pipPath = path.join(this.venvPath, 'bin', 'pip');
        return new Promise((resolve, reject) => {
            const install = spawn(pipPath, ['install', '-r', 'requirements.txt'], {
                cwd: backendPath
            });

            install.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Failed to install requirements: ${code}`));
                }
            });
        });
    }

    async startPythonServer(backendPath) {
        const pythonPath = path.join(this.venvPath, 'bin', 'python');
        this.serverProcess = spawn(pythonPath, ['server.py'], {
            cwd: backendPath
        });

        return new Promise((resolve, reject) => {
            this.serverProcess.stdout.on('data', (data) => {
                console.log(`Python server: ${data}`);
            });

            this.serverProcess.stderr.on('data', (data) => {
                console.error(`Python server error: ${data}`);
            });

            this.serverProcess.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Python server exited with code ${code}`));
                }
            });

            // Wait for server to start
            setTimeout(resolve, 2000);
        });
    }

    stopPythonServer() {
        if (this.serverProcess) {
            this.serverProcess.kill();
            this.serverProcess = null;
        }
    }
}

module.exports = new PythonManager(); 