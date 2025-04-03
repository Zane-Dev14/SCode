// main.js
// Entry point for the React application
import React from 'react';
import ReactDOM from 'react-dom';
import App from './components/App';

// Initialize the React app
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root');
  ReactDOM.render(<App />, root);
});

// Include shader scripts in the HTML
function addShaderScripts() {
  const shaders = [
    { id: 'node-vertex-shader', type: 'x-shader/x-vertex', src: 'shaders/nodeVertex.glsl' },
    { id: 'node-fragment-shader', type: 'x-shader/x-fragment', src: 'shaders/nodeFragment.glsl' },
    { id: 'edge-vertex-shader', type: 'x-shader/x-vertex', src: 'shaders/edgeVertex.glsl' },
    { id: 'edge-fragment-shader', type: 'x-shader/x-fragment', src: 'shaders/edgeFragment.glsl' },
    { id: 'background-vertex-shader', type: 'x-shader/x-vertex', src: 'shaders/backgroundVertex.glsl' },
    { id: 'background-fragment-shader', type: 'x-shader/x-fragment', src: 'shaders/backgroundFragment.glsl' },
    { id: 'particle-vertex-shader', type: 'x-shader/x-vertex', src: 'shaders/particleVertex.glsl' },
    { id: 'particle-fragment-shader', type: 'x-shader/x-fragment', src: 'shaders/particleFragment.glsl' }
  ];

  // Helper function to fetch shader code
  const fetchShader = async (src) => {
    try {
      const response = await fetch(src);
      if (!response.ok) {
        throw new Error(`Failed to fetch shader: ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      console.error(`Error loading shader from ${src}:`, error);
      return `// Error loading shader: ${error.message}`;
    }
  };

  // Create script tags for each shader
  const loadShaders = async () => {
    for (const shader of shaders) {
      try {
        const shaderContent = await fetchShader(shader.src);
        const scriptTag = document.createElement('script');
        scriptTag.id = shader.id;
        scriptTag.type = shader.type;
        scriptTag.textContent = shaderContent;
        document.head.appendChild(scriptTag);
      } catch (error) {
        console.error(`Failed to add shader ${shader.id}:`, error);
      }
    }
  };

  // Load the shaders
  loadShaders().catch(error => {
    console.error('Error loading shaders:', error);
  });
}

// Call the function to add shader scripts
addShaderScripts();