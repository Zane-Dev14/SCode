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

// Keep track of the current view's cleanup functions
let currentCleanup = null;
let currentViewUpdater = null;

// Handle extension messages
function handleExtensionMessage(message) {
    switch (message.command) {
        case 'load':
        case 'analyze':
            // If we receive load/analyze during startup, wait until startup finishes
            if (state.appState !== 'startup') {
                state.loading = true;
                state.progress = 0;
                state.appState = 'loading';
                updateUI();
            }
            break;
        case 'showAnalysis':
            // If we receive analysis during startup, wait until startup finishes
             if (state.appState !== 'startup') {
                state.loading = false;
                state.analysisData = message.data;
                state.appState = 'entrypoint';
                updateUI();
            }
            break;
        case 'updateProgress':
            state.progress = message.progress;
            // Update progress only if the loading screen is the active state
            if (state.appState === 'loading' && currentViewUpdater && typeof currentViewUpdater.updateProgress === 'function') {
                currentViewUpdater.updateProgress(state.progress);
            }
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
    root.innerHTML = '';

    // Call cleanup function for the previous view if it exists
    if (typeof currentCleanup === 'function') {
        currentCleanup();
        currentCleanup = null;
    }
    currentViewUpdater = null; // Reset updater

    if (state.error && state.appState !== 'startup') { // Don't show error during startup animation
        showError(state.error);
        return;
    }

    switch (state.appState) {
        case 'startup':
             console.log('Starting startup animation...');
             const startup = initStartupAnimation(root, () => {
                 console.log('Startup animation complete.');
                 state.appState = 'loading'; // Transition to loading state
                 updateUI(); // Render the loading screen
             });
             currentCleanup = startup.cleanup;
             break;
        case 'loading':
            console.log('Initializing loading screen...');
            const loadingUpdater = initLoadingScreen(root, state.progress);
            currentViewUpdater = loadingUpdater; // Store the updater
            // No specific cleanup needed for loading screen itself, its content is cleared
            break;
        case 'entrypoint':
            console.log('Initializing entrypoint selector...');
            const entrypoint = initEntrypointSelector(root, state.analysisData, handleEntrypointSelect);
            currentCleanup = entrypoint.cleanup; // Store cleanup function
            break;
        case 'visualization':
            console.log('Initializing code visualizer...');
            const visualizer = initCodeVisualizer(root, state.analysisData, state.selectedEntrypoint);
             currentCleanup = visualizer.cleanup; // Store cleanup function
            break;
         case 'error': // Handle error state explicitly if needed
             showError(state.error || 'An unknown error occurred.');
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

// REMOVED OBSOLETE WEBGL VISUALIZATION CODE BLOCK
// The code from approximately line 211 to 433 related to 
// shaderFiles, fetchShader, loadShaders, initVisualizationInternal, 
// createBuffers, drawBackground, drawNodes, drawEdges, drawParticles, 
// and createShaderProgram has been removed as it's not used by the 
// current D3-based visualization system managed by initCodeVisualizer.