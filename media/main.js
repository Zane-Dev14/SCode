// main.js
// Entry point for the React application
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App';
import { initShader } from './utils/shaderUtils';

// Import necessary modules
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as d3 from 'd3';
import { initShaderBackground } from './utils/shaders';
import { initParticleSystem } from './utils/particles';
import { initD3Background } from './utils/d3Background';
import { initCodeVisualizer } from './utils/codeVisualizer';
import { initEntrypointSelector } from './utils/entrypointSelector';
import { initLoadingScreen } from './utils/loadingScreen';

// State management
const state = {
    loading: true,
    progress: 0,
    currentView: 'loading',
    analysisData: null,
    selectedEntrypoint: null,
    error: null
};

// Initialize VS Code API
const vscode = acquireVsCodeApi();

// Setup logging
const debugInfo = document.querySelector('.debug-info');
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
    const safeArgs = args.map(arg => {
        try {
            if (typeof arg === 'object') {
                const seen = new WeakSet();
                return JSON.stringify(arg, function(key, value) {
                    if (key === 'stateNode' || key === '__reactContainer$' || key === 'containerInfo') {
                        return '[Internal]';
                    }
                    if (value instanceof Element) {
                        return '[' + value.tagName + ']';
                    }
                    if (typeof value === 'function') {
                        return '[Function]';
                    }
                    if (typeof value === 'object' && value !== null) {
                        if (seen.has(value)) {
                            return '[Circular]';
                        }
                        seen.add(value);
                    }
                    return value;
                });
            }
            return arg;
        } catch (e) {
            return '[Circular Structure]';
        }
    });
    debugInfo.innerHTML += safeArgs.join(' ') + '<br>';
    vscode.postMessage({
        type: 'log',
        message: safeArgs.join(' ')
    });
    originalLog.apply(console, args);
};

console.error = function(...args) {
    const safeArgs = args.map(arg => {
        try {
            if (typeof arg === 'object') {
                const seen = new WeakSet();
                return JSON.stringify(arg, function(key, value) {
                    if (key === 'stateNode' || key === '__reactContainer$' || key === 'containerInfo') {
                        return '[Internal]';
                    }
                    if (value instanceof Element) {
                        return '[' + value.tagName + ']';
                    }
                    if (typeof value === 'function') {
                        return '[Function]';
                    }
                    if (typeof value === 'object' && value !== null) {
                        if (seen.has(value)) {
                            return '[Circular]';
                        }
                        seen.add(value);
                    }
                    return value;
                });
            }
            return arg;
        } catch (e) {
            return '[Circular Structure]';
        }
    });
    debugInfo.innerHTML += '<span style="color: red;">' + safeArgs.join(' ') + '</span><br>';
    vscode.postMessage({
        type: 'error',
        message: safeArgs.join(' ')
    });
    originalError.apply(console, args);
};

// Error handling
window.addEventListener('error', function(event) {
    console.error('Error:', event.message, 'at', event.filename, ':', event.lineno);
});

// Message handling
window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'fromExtension') {
        handleExtensionMessage(event.data);
    }
});

// Handle extension messages
function handleExtensionMessage(message) {
    switch (message.command) {
        case 'load':
            state.loading = true;
            state.progress = 0;
            state.currentView = 'loading';
            updateUI();
            break;
        case 'analyze':
            state.loading = true;
            state.progress = 0;
            state.currentView = 'loading';
            updateUI();
            break;
        case 'showAnalysis':
            state.loading = false;
            state.analysisData = message.data;
            state.currentView = 'entrypoint';
            updateUI();
            break;
        case 'updateProgress':
            state.progress = message.progress;
            updateUI();
            break;
        case 'error':
            state.error = message.error;
            state.loading = false;
            updateUI();
            break;
    }
}

// Update UI based on state
function updateUI() {
    const root = document.getElementById('root');
    root.innerHTML = '';

    if (state.error) {
        showError(state.error);
        return;
    }

    switch (state.currentView) {
        case 'loading':
            initLoadingScreen(root, state.progress);
            break;
        case 'entrypoint':
            initEntrypointSelector(root, state.analysisData, handleEntrypointSelect);
            break;
        case 'visualization':
            initCodeVisualizer(root, state.analysisData, state.selectedEntrypoint);
            break;
    }
}

// Show error message
function showError(error) {
    const root = document.getElementById('root');
    root.innerHTML = `
        <div style="color: red; margin: 20px; padding: 20px; border: 1px solid red; background: rgba(255,0,0,0.1)">
            <h2>Error</h2>
            <pre>${error}</pre>
        </div>
    `;
}

// Handle entrypoint selection
function handleEntrypointSelect(entrypoint) {
    state.selectedEntrypoint = entrypoint;
    state.currentView = 'visualization';
    updateUI();
}

// Initialize app
console.log('Initializing application...');
updateUI();

let analysisData = null;
let canvas = null;
let gl = null;
let shaders = {};
let programs = {};
let scale = 1.0;

// Initialize visualization
window.initVisualization = function(data) {
    console.log('Initializing visualization with data:', data);
    analysisData = data;
    
    // Wait for canvas to be ready
    const checkCanvas = setInterval(() => {
        canvas = document.getElementById('code-graph');
        if (canvas) {
            clearInterval(checkCanvas);
            gl = canvas.getContext('webgl2');
            
            if (!gl) {
                console.error('WebGL2 not supported');
                return;
            }

            // Set canvas size
            function resizeCanvas() {
                canvas.width = canvas.clientWidth;
                canvas.height = canvas.clientHeight;
                gl.viewport(0, 0, canvas.width, canvas.height);
            }
            resizeCanvas();
            window.addEventListener('resize', resizeCanvas);

            // Load shaders
            loadShaders().then(() => {
                initVisualization();
            }).catch(error => {
                console.error('Failed to load shaders:', error);
            });
        }
    }, 100);
};

// Shader definitions
const shaderFiles = [
    { id: 'fbmShader', type: 'x-shader/x-fragment', path: 'shaders/fbm.glsl' },
    { id: 'backgroundVertexShader', type: 'x-shader/x-vertex', path: 'shaders/backgroundVertex.glsl' },
    { id: 'backgroundFragmentShader', type: 'x-shader/x-fragment', path: 'shaders/backgroundFragment.glsl' },
    { id: 'nodeVertexShader', type: 'x-shader/x-vertex', path: 'shaders/nodeVertex.glsl' },
    { id: 'nodeFragmentShader', type: 'x-shader/x-fragment', path: 'shaders/nodeFragment.glsl' },
    { id: 'edgeVertexShader', type: 'x-shader/x-vertex', path: 'shaders/edgeVertex.glsl' },
    { id: 'edgeFragmentShader', type: 'x-shader/x-fragment', path: 'shaders/edgeFragment.glsl' },
    { id: 'particleVertexShader', type: 'x-shader/x-vertex', path: 'shaders/particleVertex.glsl' },
    { id: 'particleFragmentShader', type: 'x-shader/x-fragment', path: 'shaders/particleFragment.glsl' }
];

// Fetch shader content
async function fetchShader(path) {
    try {
        // Use VS Code webview API to get shader content
        const vscode = acquireVsCodeApi();
        return new Promise((resolve, reject) => {
            console.log('Requesting shader:', path);
            vscode.postMessage({ 
                command: 'getShader', 
                path: path 
            });
            
            const messageHandler = event => {
                const message = event.data;
                console.log('Received shader message:', message);
                
                if (message.command === 'shaderContent' && message.path === path) {
                    window.removeEventListener('message', messageHandler);
                    console.log('Shader loaded:', path);
                    resolve(message.content);
                } else if (message.command === 'shaderError' && message.path === path) {
                    window.removeEventListener('message', messageHandler);
                    console.error('Shader error:', message.error);
                    reject(new Error(message.error));
                }
            };
            
            window.addEventListener('message', messageHandler);
            
            // Set a timeout to reject if no response
            setTimeout(() => {
                window.removeEventListener('message', messageHandler);
                reject(new Error(`Timeout waiting for shader: ${path}`));
            }, 5000);
        });
    } catch (error) {
        console.error(`Error loading shader from ${path}:`, error);
        throw error;
    }
}

// Load all shaders
async function loadShaders() {
    const loadPromises = shaderFiles.map(async shader => {
        try {
            const content = await fetchShader(shader.path);
            const script = document.createElement('script');
            script.id = shader.id;
            script.type = shader.type;
            script.textContent = content;
            document.head.appendChild(script);
            console.log(`Loaded shader: ${shader.id}`);
        } catch (error) {
            console.error(`Failed to load shader ${shader.id}:`, error);
            throw error;
        }
    });

    await Promise.all(loadPromises);
    console.log('All shaders loaded successfully');
}

// Initialize visualization
function initVisualization() {
    console.log('Creating shader programs...');
    // Create shader programs
    programs.background = createShaderProgram(
        shaders.backgroundVertexShader,
        shaders.backgroundFragmentShader
    );
    
    programs.node = createShaderProgram(
        shaders.nodeVertexShader,
        shaders.nodeFragmentShader
    );
    
    programs.edge = createShaderProgram(
        shaders.edgeVertexShader,
        shaders.edgeFragmentShader
    );
    
    programs.particle = createShaderProgram(
        shaders.particleVertexShader,
        shaders.particleFragmentShader
    );

    // Create buffers
    createBuffers();

    // Start animation loop
    function animate() {
        // Clear canvas
        gl.clearColor(0.1, 0.1, 0.1, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Draw background
        gl.useProgram(programs.background);
        drawBackground();

        // Draw nodes
        gl.useProgram(programs.node);
        drawNodes();

        // Draw edges
        gl.useProgram(programs.edge);
        drawEdges();

        // Draw particles
        gl.useProgram(programs.particle);
        drawParticles();

        requestAnimationFrame(animate);
    }

    animate();
}

// Create buffers for visualization
function createBuffers() {
    // Create background quad
    const backgroundVertices = new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
         1.0,  1.0
    ]);
    
    const backgroundBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, backgroundBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, backgroundVertices, gl.STATIC_DRAW);
    
    // Create node vertices (placeholder)
    const nodeVertices = new Float32Array([
        0.0, 0.0,  // center
        0.1, 0.0,  // right
        0.0, 0.1,  // top
        -0.1, 0.0, // left
        0.0, -0.1  // bottom
    ]);
    
    const nodeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nodeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, nodeVertices, gl.STATIC_DRAW);
}

// Drawing functions
function drawBackground() {
    const program = programs.background;
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    
    gl.bindBuffer(gl.ARRAY_BUFFER, backgroundBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function drawNodes() {
    // Implement node drawing
}

function drawEdges() {
    // Implement edge drawing
}

function drawParticles() {
    // Implement particle drawing
}

// Helper function to create shader program
function createShaderProgram(vertexSource, fragmentSource) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error('Vertex shader compilation failed:', gl.getShaderInfoLog(vertexShader));
        return null;
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentSource);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error('Fragment shader compilation failed:', gl.getShaderInfoLog(fragmentShader));
        return null;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Unable to initialize shader program:', gl.getProgramInfoLog(program));
        return null;
    }

    return program;
}

// Handle zoom controls
// Remove direct event listener assignments that cause errors
// These will be set up by the React components instead

// Initialize with analysis data when available
if (window.analysisData) {
    console.log('Initializing with analysis data:', window.analysisData);
    window.initVisualization(window.analysisData);
} else {
    console.log('No analysis data available yet');
}