const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');

class PythonManager {
    constructor() {
        this.pythonProcess = null;
        this.serverPort = 5000;
        this.maxRetries = 3;
    }

    async setupPythonEnvironment(extensionPath) {
        const backendPath = path.join(extensionPath, 'backend');
        const venvPath = path.join(backendPath, '.venv');
        const outputDir = path.join(backendPath, 'output');
        
        try {
            // Ensure output directory exists
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            
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
            
            // Start the Python server with retries
            let retries = 0;
            let lastError = null;
            
            while (retries < this.maxRetries) {
                try {
                    await this.startPythonServer(venvPath, backendPath);
                    vscode.window.showInformationMessage('Python server started successfully.');
                    return true;
                } catch (error) {
                    lastError = error;
                    console.error(`Failed to start Python server (attempt ${retries + 1}): ${error.message}`);
                    
                    // Kill any lingering process before retry
                    if (this.pythonProcess) {
                        this.pythonProcess.kill();
                        this.pythonProcess = null;
                    }
                    
                    // If it's the last retry, don't wait
                    if (retries < this.maxRetries - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    
                    retries++;
                }
            }
            
            // If we got here, all retries failed
            throw lastError || new Error('Failed to start Python server after multiple attempts');
            
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
                const python3Version = execSync('python3 --version', { encoding: 'utf8' });
                console.log(`Found Python3: ${python3Version.trim()}`);
                return 'python3';
            } catch (e) {
                console.log('python3 command not found, trying python');
                // If python3 fails, try python
                const pythonVersion = execSync('python --version', { encoding: 'utf8' });
                console.log(`Found Python: ${pythonVersion.trim()}`);
                return 'python';
            }
        } catch (error) {
            console.error('No Python installation found:', error.message);
            return null;
        }
    }

    createVirtualEnvSync(pythonPath, backendPath) {
        try {
            console.log(`Creating virtual environment with ${pythonPath} in ${backendPath}`);
            const result = execSync(`${pythonPath} -m venv .venv`, { 
                cwd: backendPath,
                encoding: 'utf8' 
            });
            console.log('Virtual environment created:', result);
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
            console.log(`Installing dependencies with ${pipPath} in ${backendPath}`);
            const result = execSync(`"${pipPath}" install -r requirements.txt`, { 
                cwd: backendPath,
                encoding: 'utf8' 
            });
            console.log('Dependencies installed:', result);
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
            console.log('Stopping existing Python process');
            try {
                this.pythonProcess.kill();
            } catch (err) {
                console.log(`Error stopping Python process: ${err.message}`);
            }
            this.pythonProcess = null;
            // Small delay to ensure port is released
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        // Check if something is already using port 5000
        try {
            console.log(`Checking if port ${this.serverPort} is available...`);
            if (process.platform === 'win32') {
                const netstat = execSync(`netstat -ano | findstr :${this.serverPort} || echo "Port available"`, { encoding: 'utf8' });
                if (!netstat.includes("Port available")) {
                    console.log(`Process already using port ${this.serverPort}:`, netstat);
                    console.log('Will try to continue anyway, but this may cause issues.');
                }
            } else {
                const netstat = execSync(`lsof -i :${this.serverPort} || echo "Port available"`, { encoding: 'utf8' });
                if (!netstat.includes("Port available")) {
                    console.log(`Process already using port ${this.serverPort}:`, netstat);
                    console.log('Will try to continue anyway, but this may cause issues.');
                }
            }
        } catch (error) {
            console.log(`Error checking port: ${error.message} - will try to start server anyway`);
        }
    
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.pythonProcess) {
                    try {
                        this.pythonProcess.kill();
                    } catch (err) {
                        console.log(`Error stopping timed out Python process: ${err.message}`);
                    }
                    this.pythonProcess = null;
                }
                reject(new Error('Timeout waiting for Python server to start after 15 seconds'));
            }, 15000);
            
            try {
                console.log(`Starting Python server with: ${pythonPath} api.py`);
                console.log(`CWD: ${backendPath}`);
                console.log(`Port: ${this.serverPort}`);

                // Ensure the Python path exists
                if (!fs.existsSync(pythonPath)) {
                    clearTimeout(timeout);
                    reject(new Error(`Python interpreter not found at: ${pythonPath}`));
                    return;
                }
                
                // Ensure the api.py file exists
                const apiPath = path.join(backendPath, 'api.py');
                if (!fs.existsSync(apiPath)) {
                    clearTimeout(timeout);
                    reject(new Error(`API file not found at: ${apiPath}`));
                    return;
                }
    
                // Set up environment with explicit Flask variables
                const env = { 
                    ...process.env, 
                    PORT: this.serverPort.toString(), 
                    FLASK_APP: 'api.py',
                    FLASK_ENV: 'development',
                    PYTHONUNBUFFERED: '1'  // Ensures Python output is unbuffered
                };
                
                this.pythonProcess = spawn(pythonPath, ['api.py'], {
                    cwd: backendPath,
                    env: env
                });
    
                this.pythonProcess.stdout.on('data', (data) => {
                    const output = data.toString();
                    console.log(`Python stdout: ${output}`);
                    // Split output into lines and check each for "Running on"
                    const lines = output.split('\n');
                    for (const line of lines) {
                        if (line.includes('Running on')) {
                            clearTimeout(timeout);
                            // Wait a brief moment to ensure the server is fully up
                            setTimeout(() => resolve(), 1000);
                            return;
                        }
                    }
                    // Fallback: if we see Flask startup messages, assume it's running
                    if (output.includes('Serving Flask app') || output.includes('Debug mode')) {
                        clearTimeout(timeout);
                        // Wait a brief moment to ensure the server is fully up
                        setTimeout(() => resolve(), 1500);
                    }
                });
    
                this.pythonProcess.stderr.on('data', (data) => {
                    const errorOutput = data.toString();
                    console.error(`Python stderr: ${errorOutput}`);
                    // Only reject if it's a real error, not just Flask debug output
                    if (errorOutput.includes('Error') || errorOutput.includes('Exception') || 
                        errorOutput.includes('Traceback')) {
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
                    if (code !== 0 && code !== null) {
                        console.error(`Python process exited with code ${code}, signal ${signal}`);
                        reject(new Error(`Python server exited with code ${code}`));
                    } else if (signal) {
                        console.log(`Python process was terminated by signal ${signal}`);
                        if (signal !== 'SIGTERM') {
                            reject(new Error(`Python server was terminated by signal ${signal}`));
                        }
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
            console.log('Stopping Python server');
            this.pythonProcess.kill();
            this.pythonProcess = null;
        }
    }
}

module.exports = new PythonManager(); 