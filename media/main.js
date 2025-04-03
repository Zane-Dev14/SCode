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

// State management
const state = {
    loading: true,
    progress: 0,
    currentView: 'loading',
    analysisData: null,
    selectedEntrypoint: null,
    error: null
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

// Keep track of the current view's update functions (if any)
let currentViewUpdater = null;

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
            // If the loading screen is active, call its update function
            if (state.currentView === 'loading' && currentViewUpdater && typeof currentViewUpdater.updateProgress === 'function') {
                currentViewUpdater.updateProgress(state.progress);
            } else if (state.currentView !== 'loading') {
                // Reset updater if we switched away from loading screen
                currentViewUpdater = null;
            }
            // Note: No need to call updateUI() here unless the view itself changes
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
            // Store the returned updater from initLoadingScreen
            currentViewUpdater = initLoadingScreen(root, state.progress);
            break;
        case 'entrypoint':
            initEntrypointSelector(root, state.analysisData, handleEntrypointSelect);
            currentViewUpdater = null; // Reset updater
            break;
        case 'visualization':
            initCodeVisualizer(root, state.analysisData, state.selectedEntrypoint);
            currentViewUpdater = null; // Reset updater
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

// REMOVED OBSOLETE WEBGL VISUALIZATION CODE BLOCK
// The code from approximately line 211 to 433 related to 
// shaderFiles, fetchShader, loadShaders, initVisualizationInternal, 
// createBuffers, drawBackground, drawNodes, drawEdges, drawParticles, 
// and createShaderProgram has been removed as it's not used by the 
// current D3-based visualization system managed by initCodeVisualizer.