// main.js
// Entry point for the React application
import React from 'react';
import ReactDOM from 'react-dom';
import App from './components/App.jsx';

// Initialize React app
document.addEventListener('DOMContentLoaded', () => {
    try {
        const root = document.getElementById('root');
        if (!root) {
            throw new Error('Root element not found');
        }
        
        // Initialize React app
        const app = React.createElement(React.StrictMode, null,
            React.createElement(App, { initialData: window.analysisData || {} })
        );
        
        ReactDOM.render(app, root);
        
        // Load shaders after React is initialized
        loadShaders().catch(error => {
            console.error('Failed to load shaders:', error);
            vscode.postMessage({
                command: 'error',
                message: `Failed to load shaders: ${error.message}`
  });
});
    } catch (error) {
        console.error('Failed to initialize app:', error);
        vscode.postMessage({
            command: 'error',
            message: `Failed to initialize app: ${error.message}`
        });
    }
});

// Shader definitions
const shaders = [
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
        const fullPath = `${window.shadersPath}/${path}`;
        const response = await fetch(fullPath);
        if (!response.ok) {
            throw new Error(`Failed to load shader: ${response.statusText}`);
        }
        return await response.text();
    } catch (error) {
        console.error(`Error loading shader from ${path}:`, error);
        throw error;
    }
}

// Load all shaders
async function loadShaders() {
    if (!window.shadersPath) {
        throw new Error('Shaders path not set in webview');
    }

    const loadPromises = shaders.map(async shader => {
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