// main.js
// Entry point for the application using vanilla JS and WebGL/D3
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
import { initStartupAnimation } from './utils/startupAnimation';

// State management
const state = {
    appState: 'startup',
    loading: true,
    progress: 0,
    currentView: 'loading',
    analysisData: null,
    selectedEntrypoint: null,
    error: null,
    visualizationData: null
};

// VS Code API is acquired in the inline script (extension.js) and available as window.vscode

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
    window.vscode.postMessage({
        type: 'log',
        message: safeArgs.join('')
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
    window.vscode.postMessage({
        type: 'error',
        message: safeArgs.join('')
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

// Keep track of the current view's cleanup functions
let currentCleanup = null;
let currentViewUpdater = null;

// Add a global timer reference
let loadingTimer = null;

// Handle extension messages
function handleExtensionMessage(message) {
    switch (message.command) {
        case 'load':
        case 'analyze':
            if (state.appState !== 'startup') {
                state.loading = true;
                state.progress = 100; // Set to 100 immediately
                state.appState = 'loading';
                updateUI();
            }
            break;
        case 'showAnalysis':
            // Store data and ensure startup animation plays
            state.analysisData = message.data;
            state.visualizationData = message.data;
            
            // If we're in startup, let it complete first
            if (state.appState === 'startup') {
                // The startup animation will trigger loading state when done
                return;
            }
            
            // Otherwise show loading at 100% briefly
            state.progress = 100;
            state.loading = true;
            state.appState = 'loading';
            updateUI();
            
            // Wait for loading screen to show 100% before transitioning
            setTimeout(() => {
                state.loading = false;
                state.appState = 'visualization';
                updateUI();
            }, 100);
            break;
        case 'updateProgress':
            // Always show 100%
            state.progress = 100;
            if (currentViewUpdater && typeof currentViewUpdater.updateProgress === 'function') {
                currentViewUpdater.updateProgress(100);
            }
            
            // Wait 5 seconds then transition to visualization
            setTimeout(() => {
                // Clear everything
                const root = document.getElementById('root');
                while (root.firstChild) {
                    root.removeChild(root.firstChild);
                }
                
                // Show visualization
                state.appState = 'visualization';
                state.loading = false;
                updateUI();
            }, 5000);
            break;
        case 'error':
            state.error = message.error;
            state.loading = false;
            state.appState = 'error';
            updateUI();
            break;
    }
}

// Update UI based on state
function updateUI() {
    const root = document.getElementById('root');
    
    // Always cleanup previous view
    if (typeof currentCleanup === 'function') {
        currentCleanup();
        currentCleanup = null;
    }
    currentViewUpdater = null;

    // Clear root content
    root.innerHTML = '';

    if (state.error && state.appState !== 'startup') {
        showError(state.error);
        return;
    }

    switch (state.appState) {
        case 'startup':
            console.log('Starting startup animation...');
            const startup = initStartupAnimation(root, () => {
                console.log('Startup animation complete.');
                state.appState = 'loading';
                state.progress = 100;
                state.loading = true;
                updateUI();
                
                // Wait for loading screen to show 100% before starting analysis
                setTimeout(() => {
                    window.vscode.postMessage({
                        command: 'startAnalysis'
                    });
                }, 100);
            });
            currentCleanup = startup.cleanup;
            break;
        case 'loading':
            console.log('Initializing loading screen...');
            const loadingUpdater = initLoadingScreen(root, state.progress);
            currentViewUpdater = loadingUpdater;
            break;
        case 'visualization':
            console.log('Initializing visualization panel...');
            const visualization = initVisualizationPanel(root, state.visualizationData);
            currentCleanup = visualization.cleanup;
            break;
        case 'error':
            showError(state.error);
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
    state.appState = 'visualization';
    updateUI();
}

// Initialize app
console.log('Initializing application...');
updateUI(); // Start with the initial state (startup)

// Add visualization initialization function
function initVisualizationPanel(root, data) {
    // Clear previous content
    root.innerHTML = '';

    // Create main container
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.position = 'relative';
    container.style.display = 'flex';
    root.appendChild(container);

    // Create sidebar
    const sidebar = document.createElement('div');
    sidebar.className = 'sidebar';
    sidebar.style.width = '250px';
    sidebar.style.height = '100%';
    sidebar.style.backgroundColor = '#1e1e1e';
    sidebar.style.borderRight = '1px solid #333';
    sidebar.style.padding = '20px';
    sidebar.style.overflowY = 'auto';
    container.appendChild(sidebar);

    // Add sidebar content
    sidebar.innerHTML = `
        <div class="sidebar-header">
            <h2 style="color: #fff; margin: 0 0 20px 0;">Code Analyzer</h2>
        </div>
        <div class="sidebar-menu">
            <button class="menu-item active" data-view="ast" style="width: 100%; padding: 10px; margin: 5px 0; background: #2d2d2d; border: none; color: #fff; text-align: left; cursor: pointer; border-radius: 4px;">
                <span class="icon">🔍</span>
                <span>AST View</span>
            </button>
            <button class="menu-item" data-view="modules" style="width: 100%; padding: 10px; margin: 5px 0; background: #2d2d2d; border: none; color: #fff; text-align: left; cursor: pointer; border-radius: 4px;">
                <span class="icon">📦</span>
                <span>Module Dependencies</span>
            </button>
            <button class="menu-item" data-view="vulnerabilities" style="width: 100%; padding: 10px; margin: 5px 0; background: #2d2d2d; border: none; color: #fff; text-align: left; cursor: pointer; border-radius: 4px;">
                <span class="icon">🔒</span>
                <span>Vulnerabilities</span>
            </button>
        </div>
        <div class="sidebar-stats" style="margin-top: 20px;">
            <div class="stat-item" style="margin: 10px 0;">
                <span class="stat-label" style="color: #888;">Files</span>
                <span class="stat-value" id="files-count" style="color: #fff; float: right;">${data?.files?.length || 0}</span>
            </div>
            <div class="stat-item" style="margin: 10px 0;">
                <span class="stat-label" style="color: #888;">Nodes</span>
                <span class="stat-value" id="nodes-count" style="color: #fff; float: right;">${data?.nodes?.length || 0}</span>
            </div>
            <div class="stat-item" style="margin: 10px 0;">
                <span class="stat-label" style="color: #888;">Issues</span>
                <span class="stat-value" id="issues-count" style="color: #fff; float: right;">${data?.issues?.length || 0}</span>
            </div>
        </div>
    `;

    // Create visualization container
    const vizContainer = document.createElement('div');
    vizContainer.style.flex = '1';
    vizContainer.style.height = '100%';
    vizContainer.style.position = 'relative';
    container.appendChild(vizContainer);

    // Add visualization canvas
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    vizContainer.appendChild(canvas);

    // Cleanup function
    const cleanup = () => {
        root.innerHTML = '';
    };

    return { cleanup };
}

// REMOVED OBSOLETE WEBGL VISUALIZATION CODE BLOCK
// The code from approximately line 211 to 433 related to 
// shaderFiles, fetchShader, loadShaders, initVisualizationInternal, 
// createBuffers, drawBackground, drawNodes, drawEdges, drawParticles, 
// and createShaderProgram has been removed as it's not used by the 
// current D3-based visualization system managed by initCodeVisualizer.