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

    // Create main container with gradient background
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.position = 'relative';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.background = 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)';
    root.appendChild(container);

    // Initialize background effects
    const background = initShaderBackground(container);
    const particles = initParticleSystem(background.scene);
    const d3Bg = initD3Background(container);

    // Create header
    const header = document.createElement('div');
    header.style.padding = '20px';
    header.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    container.appendChild(header);

    const title = document.createElement('h1');
    title.textContent = 'SCode Analysis Dashboard';
    title.style.color = 'white';
    title.style.margin = '0';
    title.style.fontSize = '24px';
    title.style.fontWeight = '500';
    header.appendChild(title);

    const stats = document.createElement('div');
    stats.style.display = 'flex';
    stats.style.gap = '20px';
    header.appendChild(stats);

    const statItems = [
        { label: 'Modules', value: data?.modules?.length || 0, color: '#4A9EFF' },
        { label: 'Functions', value: data?.functions?.length || 0, color: '#FFB74D' },
        { label: 'Vulnerabilities', value: data?.vulnerabilities?.length || 0, color: '#FF5252' },
        { label: 'Variables', value: data?.variables?.length || 0, color: '#66BB6A' }
    ];

    statItems.forEach(item => {
        const stat = document.createElement('div');
        stat.style.display = 'flex';
        stat.style.flexDirection = 'column';
        stat.style.alignItems = 'center';
        
        const value = document.createElement('div');
        value.textContent = item.value;
        value.style.color = item.color;
        value.style.fontSize = '24px';
        value.style.fontWeight = 'bold';
        
        const label = document.createElement('div');
        label.textContent = item.label;
        label.style.color = 'rgba(255, 255, 255, 0.7)';
        label.style.fontSize = '14px';
        
        stat.appendChild(value);
        stat.appendChild(label);
        stats.appendChild(stat);
    });

    // Create main content area
    const contentArea = document.createElement('div');
    contentArea.style.display = 'flex';
    contentArea.style.flex = '1';
    contentArea.style.overflow = 'hidden';
    container.appendChild(contentArea);

    // Create sidebar
    const sidebar = document.createElement('div');
    sidebar.style.width = '250px';
    sidebar.style.backgroundColor = 'rgba(30, 30, 30, 0.8)';
    sidebar.style.padding = '20px';
    sidebar.style.display = 'flex';
    sidebar.style.flexDirection = 'column';
    sidebar.style.gap = '10px';
    contentArea.appendChild(sidebar);

    // Create main panel
    const mainPanel = document.createElement('div');
    mainPanel.style.flex = '1';
    mainPanel.style.backgroundColor = 'rgba(30, 30, 30, 0.8)';
    mainPanel.style.margin = '20px';
    mainPanel.style.borderRadius = '10px';
    mainPanel.style.overflow = 'hidden';
    contentArea.appendChild(mainPanel);

    // Navigation buttons
    const sections = [
        { 
            name: 'Modules', 
            icon: '📦', 
            color: '#4A9EFF',
            description: 'Project modules and their dependencies'
        },
        { 
            name: 'Functions', 
            icon: '🔧', 
            color: '#FFB74D',
            description: 'Function calls and data flow analysis'
        },
        { 
            name: 'Vulnerabilities', 
            icon: '⚠️', 
            color: '#FF5252',
            description: 'Security vulnerabilities and risks'
        },
        { 
            name: 'Variables', 
            icon: '📊', 
            color: '#66BB6A',
            description: 'Variable usage and data types'
        }
    ];

    const contentSections = [];
    let activeSection = 0;

    sections.forEach((section, index) => {
        // Create navigation button
        const button = document.createElement('button');
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.gap = '10px';
        button.style.width = '100%';
        button.style.padding = '15px';
        button.style.border = 'none';
        button.style.borderRadius = '8px';
        button.style.backgroundColor = index === 0 ? section.color + '20' : 'transparent';
        button.style.color = 'white';
        button.style.cursor = 'pointer';
        button.style.transition = 'all 0.3s';
        button.style.textAlign = 'left';
        
        const icon = document.createElement('span');
        icon.textContent = section.icon;
        icon.style.fontSize = '20px';
        
        const text = document.createElement('div');
        text.style.display = 'flex';
        text.style.flexDirection = 'column';
        
        const name = document.createElement('span');
        name.textContent = section.name;
        name.style.fontWeight = 'bold';
        
        const desc = document.createElement('span');
        desc.textContent = section.description;
        desc.style.fontSize = '12px';
        desc.style.opacity = '0.7';
        
        text.appendChild(name);
        text.appendChild(desc);
        
        button.appendChild(icon);
        button.appendChild(text);
        sidebar.appendChild(button);

        // Create content section
        const content = document.createElement('div');
        content.style.display = index === 0 ? 'block' : 'none';
        content.style.padding = '20px';
        content.style.height = '100%';
        content.style.overflow = 'auto';
        mainPanel.appendChild(content);
        contentSections.push(content);

        // Add click handler
        button.addEventListener('click', () => {
            activeSection = index;
            contentSections.forEach((c, i) => {
                c.style.display = i === index ? 'block' : 'none';
                sidebar.children[i].style.backgroundColor = i === index ? sections[i].color + '20' : 'transparent';
            });
        });
    });

    // Modules Section
    const modulesContent = contentSections[0];
    if (data?.modules) {
        const modulesGrid = document.createElement('div');
        modulesGrid.style.display = 'grid';
        modulesGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
        modulesGrid.style.gap = '20px';
        modulesContent.appendChild(modulesGrid);

        data.modules.forEach(module => {
            const moduleCard = document.createElement('div');
            moduleCard.style.backgroundColor = 'rgba(74, 158, 255, 0.1)';
            moduleCard.style.padding = '20px';
            moduleCard.style.borderRadius = '8px';
            moduleCard.style.color = 'white';
            moduleCard.style.borderLeft = `4px solid ${sections[0].color}`;
            
            const name = document.createElement('div');
            name.textContent = module;
            name.style.fontWeight = 'bold';
            name.style.fontSize = '18px';
            name.style.marginBottom = '10px';
            
            const path = document.createElement('div');
            path.textContent = module.split('/').pop();
            path.style.opacity = '0.7';
            path.style.fontSize = '14px';
            
            moduleCard.appendChild(name);
            moduleCard.appendChild(path);
            modulesGrid.appendChild(moduleCard);
        });
    }

    // Functions Section
    const functionsContent = contentSections[1];
    const functionsContainer = document.createElement('div');
    functionsContainer.style.width = '100%';
    functionsContainer.style.height = '100%';
    functionsContent.appendChild(functionsContainer);

    // Initialize D3 force-directed graph
    const svg = d3.select(functionsContainer)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%');

    const simulation = d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.id))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(functionsContainer.clientWidth / 2, functionsContainer.clientHeight / 2));

    if (data?.dataflow) {
        const link = svg.append('g')
            .selectAll('line')
            .data(data.dataflow)
            .enter()
            .append('line')
            .attr('stroke', 'rgba(255, 183, 77, 0.3)')
            .attr('stroke-width', 2);

        if (data?.functions) {
            const node = svg.append('g')
                .selectAll('circle')
                .data(data.functions)
                .enter()
                .append('circle')
                .attr('r', 10)
                .attr('fill', 'rgba(255, 183, 77, 0.8)');

            simulation.nodes(data.functions).on('tick', () => {
                link
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);

                node
                    .attr('cx', d => d.x)
                    .attr('cy', d => d.y);
            });
        }
    }

    // Vulnerabilities Section
    const vulnContent = contentSections[2];
    if (data?.vulnerabilities) {
        const vulnGrid = document.createElement('div');
        vulnGrid.style.display = 'grid';
        vulnGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(400px, 1fr))';
        vulnGrid.style.gap = '20px';
        vulnContent.appendChild(vulnGrid);

        data.vulnerabilities.forEach(vuln => {
            const vulnCard = document.createElement('div');
            vulnCard.style.backgroundColor = 'rgba(255, 82, 82, 0.1)';
            vulnCard.style.padding = '20px';
            vulnCard.style.borderRadius = '8px';
            vulnCard.style.color = 'white';
            vulnCard.style.borderLeft = `4px solid ${sections[2].color}`;
            
            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.marginBottom = '15px';
            
            const title = document.createElement('div');
            title.style.fontWeight = 'bold';
            title.style.fontSize = '18px';
            title.textContent = vuln.vulnerability || 'Security Issue';
            
            const line = document.createElement('div');
            line.style.backgroundColor = 'rgba(255, 82, 82, 0.2)';
            line.style.padding = '5px 10px';
            line.style.borderRadius = '4px';
            line.style.fontSize = '14px';
            line.textContent = `Line ${vuln.line}`;
            
            header.appendChild(title);
            header.appendChild(line);
            
            const file = document.createElement('div');
            file.style.marginBottom = '10px';
            file.style.opacity = '0.7';
            file.textContent = vuln.file.split('/').pop();
            
            const desc = document.createElement('div');
            desc.style.opacity = '0.8';
            desc.textContent = vuln.description;
            
            vulnCard.appendChild(header);
            vulnCard.appendChild(file);
            vulnCard.appendChild(desc);
            vulnGrid.appendChild(vulnCard);
        });
    }

    // Variables Section
    const varsContent = contentSections[3];
    if (data?.variables) {
        const varsGrid = document.createElement('div');
        varsGrid.style.display = 'grid';
        varsGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
        varsGrid.style.gap = '20px';
        varsContent.appendChild(varsGrid);

        data.variables.forEach(variable => {
            const varCard = document.createElement('div');
            varCard.style.backgroundColor = 'rgba(102, 187, 106, 0.1)';
            varCard.style.padding = '20px';
            varCard.style.borderRadius = '8px';
            varCard.style.color = 'white';
            varCard.style.borderLeft = `4px solid ${sections[3].color}`;
            
            const name = document.createElement('div');
            name.style.fontWeight = 'bold';
            name.style.fontSize = '18px';
            name.style.marginBottom = '10px';
            name.textContent = variable.name;
            
            const type = document.createElement('div');
            type.style.marginBottom = '5px';
            type.style.opacity = '0.8';
            type.textContent = `Type: ${variable.type}`;
            
            const value = document.createElement('div');
            value.style.opacity = '0.8';
            value.textContent = `Value: ${variable.value}`;
            
            varCard.appendChild(name);
            varCard.appendChild(type);
            varCard.appendChild(value);
            varsGrid.appendChild(varCard);
        });
    }

    // Cleanup function
    const cleanup = () => {
        if (typeof background.cleanup === 'function') background.cleanup();
        if (typeof d3Bg.cleanup === 'function') d3Bg.cleanup();
    };

    return { cleanup };
}

// REMOVED OBSOLETE WEBGL VISUALIZATION CODE BLOCK
// The code from approximately line 211 to 433 related to 
// shaderFiles, fetchShader, loadShaders, initVisualizationInternal, 
// createBuffers, drawBackground, drawNodes, drawEdges, drawParticles, 
// and createShaderProgram has been removed as it's not used by the 
// current D3-based visualization system managed by initCodeVisualizer.