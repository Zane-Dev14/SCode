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
    // Filter out initialization messages
    if (args[0]?.includes('Initializing application') || 
        args[0]?.includes('Bundle loaded')) {
        return;
    }
    
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

// Add a flag to track if visualization is already being initialized
let isInitializingVisualization = false;

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
            const startup = initStartupAnimation(root, () => {
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
            const loadingUpdater = initLoadingScreen(root, state.progress);
            currentViewUpdater = loadingUpdater;
            break;
        case 'visualization':
            if (!isInitializingVisualization) {
                isInitializingVisualization = true;
                const visualization = initVisualizationPanel(root, state.visualizationData);
                currentCleanup = visualization.cleanup;
                isInitializingVisualization = false;
            }
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
    container.style.display = 'flex';
    container.style.padding = '20px';
    container.style.gap = '20px';
    container.style.background = '#1e1e1e';
    root.appendChild(container);

    // Create sidebar
    const sidebar = document.createElement('div');
    sidebar.style.width = '200px';
    sidebar.style.backgroundColor = '#252526';
    sidebar.style.padding = '15px';
    sidebar.style.borderRadius = '8px';
    container.appendChild(sidebar);

    // Create main content area
    const mainContent = document.createElement('div');
    mainContent.style.flex = '1';
    mainContent.style.backgroundColor = '#252526';
    mainContent.style.padding = '20px';
    mainContent.style.borderRadius = '8px';
    mainContent.style.overflow = 'auto';
    container.appendChild(mainContent);

    // Create navigation buttons
    const sections = [
        { name: 'Modules', icon: '📦', render: renderModules },
        { name: 'Functions', icon: '🔧', render: renderFunctions },
        { name: 'Vulnerabilities', icon: '⚠️', render: renderVulnerabilities },
        { name: 'Variables', icon: '📊', render: renderVariables }
    ];

    sections.forEach((section, index) => {
        const button = document.createElement('button');
        button.style.width = '100%';
        button.style.padding = '10px';
        button.style.marginBottom = '10px';
        button.style.border = 'none';
        button.style.borderRadius = '4px';
        button.style.backgroundColor = index === 0 ? '#37373d' : '#2d2d2d';
        button.style.color = 'white';
        button.style.cursor = 'pointer';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.gap = '8px';
        button.innerHTML = `${section.icon} ${section.name}`;
        
        button.addEventListener('mouseover', () => {
            if (button.style.backgroundColor !== '#37373d') {
                button.style.backgroundColor = '#333333';
            }
        });
        
        button.addEventListener('mouseout', () => {
            if (button.style.backgroundColor !== '#37373d') {
                button.style.backgroundColor = '#2d2d2d';
            }
        });
        
        button.addEventListener('click', () => {
            // Reset all buttons
            sidebar.querySelectorAll('button').forEach(btn => {
                btn.style.backgroundColor = '#2d2d2d';
            });
            
            // Highlight clicked button
            button.style.backgroundColor = '#37373d';
            
            // Clear and update content
            mainContent.innerHTML = '';
            section.render(mainContent, data);
        });
        
        sidebar.appendChild(button);
    });

    // Show first section by default
    sidebar.querySelector('button').click();

    return {
        cleanup: () => {
            root.innerHTML = '';
        }
    };
}

function renderModules(container, data) {
    const header = document.createElement('h2');
    header.textContent = 'Modules';
    header.style.margin = '0 0 20px 0';
    container.appendChild(header);

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
    grid.style.gap = '15px';
    container.appendChild(grid);

    data?.modules?.forEach(module => {
        const card = document.createElement('div');
        card.style.backgroundColor = '#333333';
        card.style.padding = '15px';
        card.style.borderRadius = '6px';
        card.style.border = '1px solid #404040';

        const name = document.createElement('div');
        name.textContent = module.name;
        name.style.fontSize = '16px';
        name.style.fontWeight = 'bold';
        name.style.marginBottom = '8px';

        const path = document.createElement('div');
        path.textContent = module.path;
        path.style.fontSize = '12px';
        path.style.color = '#888';

        card.appendChild(name);
        card.appendChild(path);
        grid.appendChild(card);
    });
}

function renderFunctions(container, data) {
    const header = document.createElement('h2');
    header.textContent = 'Functions';
    header.style.margin = '0 0 20px 0';
    container.appendChild(header);

    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '10px';
    container.appendChild(list);

    data?.functions?.forEach(func => {
        const item = document.createElement('div');
        item.style.backgroundColor = '#333333';
        item.style.padding = '15px';
        item.style.borderRadius = '6px';
        item.style.border = '1px solid #404040';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';

        const info = document.createElement('div');
        
        const name = document.createElement('div');
        name.textContent = func.name;
        name.style.fontSize = '16px';
        name.style.fontWeight = 'bold';
        name.style.marginBottom = '4px';

        const location = document.createElement('div');
        location.textContent = `${func.path}:${func.line}`;
        location.style.fontSize = '12px';
        location.style.color = '#888';

        info.appendChild(name);
        info.appendChild(location);
        item.appendChild(info);
        list.appendChild(item);
    });
}

function renderVulnerabilities(container, data) {
    const header = document.createElement('h2');
    header.textContent = 'Vulnerabilities';
    header.style.margin = '0 0 20px 0';
    container.appendChild(header);

    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '10px';
    container.appendChild(list);

    data?.vulnerabilities?.forEach(vuln => {
        const item = document.createElement('div');
        item.style.backgroundColor = '#333333';
        item.style.padding = '15px';
        item.style.borderRadius = '6px';
        item.style.border = '1px solid #404040';

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '8px';

        const name = document.createElement('div');
        name.textContent = vuln.name;
        name.style.fontSize = '16px';
        name.style.fontWeight = 'bold';

        const severity = document.createElement('div');
        severity.textContent = vuln.severity;
        severity.style.padding = '4px 8px';
        severity.style.borderRadius = '4px';
        severity.style.fontSize = '12px';
        severity.style.backgroundColor = vuln.severity === 'high' ? '#cf6679' : '#ff4081';

        header.appendChild(name);
        header.appendChild(severity);

        const location = document.createElement('div');
        location.textContent = `${vuln.path}:${vuln.line}`;
        location.style.fontSize = '12px';
        location.style.color = '#888';

        item.appendChild(header);
        item.appendChild(location);
        list.appendChild(item);
    });
}

function renderVariables(container, data) {
    const header = document.createElement('h2');
    header.textContent = 'Variables';
    header.style.margin = '0 0 20px 0';
    container.appendChild(header);

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
    grid.style.gap = '15px';
    container.appendChild(grid);

    data?.variables?.forEach(variable => {
        const card = document.createElement('div');
        card.style.backgroundColor = '#333333';
        card.style.padding = '15px';
        card.style.borderRadius = '6px';
        card.style.border = '1px solid #404040';

        const name = document.createElement('div');
        name.textContent = variable.name;
        name.style.fontSize = '16px';
        name.style.fontWeight = 'bold';
        name.style.marginBottom = '8px';

        const type = document.createElement('div');
        type.textContent = `Type: ${variable.type}`;
        type.style.fontSize = '12px';
        type.style.color = '#888';
        type.style.marginBottom = '4px';

        const value = document.createElement('div');
        value.textContent = `Value: ${variable.value}`;
        value.style.fontSize = '12px';
        value.style.color = '#888';

        card.appendChild(name);
        card.appendChild(type);
        card.appendChild(value);
        grid.appendChild(card);
    });
}

// REMOVED OBSOLETE WEBGL VISUALIZATION CODE BLOCK
// The code from approximately line 211 to 433 related to 
// shaderFiles, fetchShader, loadShaders, initVisualizationInternal, 
// createBuffers, drawBackground, drawNodes, drawEdges, drawParticles, 
// and createShaderProgram has been removed as it's not used by the 
// current D3-based visualization system managed by initCodeVisualizer.