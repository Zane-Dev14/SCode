// main.js
// Get the VS Code API (already acquired in HTML)
// const vscode = acquireVsCodeApi(); // REMOVE THIS LINE
// State
let astData = null;
let currentView = 'loading';
let selectedNode = null;
let projectDir = null;
let loadingMessage = 'Initializing...';
let fetchAbortController = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  
  // Handle messages from the extension
  window.addEventListener('message', event => {
    const message = event.data;
    console.log('Received message:', message);
    
    switch (message.command) {
      case 'loading':
        updateLoadingMessage(message.message);
        break;
        
      case 'analyze':
        // Cancel any existing request
        if (fetchAbortController) {
          fetchAbortController.abort();
        }
        fetchAbortController = new AbortController();
        
        projectDir = message.projectDir;
        console.log(`Received projectDir for analysis: ${projectDir}`);
        updateLoadingMessage('Analyzing project...');
        
        fetch(`http://localhost:5000/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_dir: projectDir }),
            signal: fetchAbortController.signal
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Received analysis data:', data); // Log the response
            if (data.error) {
                showError(data.error);
            } else if (data.status === 'needs_entrypoint') {
                showEntrypointSelector(data.options, projectDir);
            } else {
                astData = data.data;
                transitionToView('ast');
            }
        })
        .catch(error => {
            // Don't show aborted fetch errors (happens when we cancel deliberately)
            if (error.name === 'AbortError') {
                console.log('Fetch aborted');
                return;
            }
            showError(`Failed to analyze: ${error.message}`);
            
            // Retry with direct AST request as fallback
            console.log('Trying to fetch AST directly as fallback');
            setTimeout(() => {
                window.vscode.postMessage({ command: 'requestAst' });
            }, 1000);
        });
        break;
          
      case 'astData':
        // If we receive AST data directly
        console.log('Received AST data');
        // Cancel any existing request
        if (fetchAbortController) {
          fetchAbortController.abort();
          fetchAbortController = null;
        }
        
        // Clear timeout for AST request
        if (window.astRequestTimeout) {
          clearTimeout(window.astRequestTimeout);
          window.astRequestTimeout = null;
        }
        
        astData = message.data;
        transitionToView('ast');
        break;
        
      case 'error':
        showError(message.message);
        break;
    }
  });
});
    
function initApp() {
  const root = document.getElementById('root');
  
  // Create main container
  const app = document.createElement('div');
  app.className = 'app-container';
  root.appendChild(app);
  
  // Create loading screen
  const loadingScreen = document.createElement('div');
  loadingScreen.className = 'loading-screen';
  loadingScreen.innerHTML = `
    <div class="spinner"></div>
    <h2>Analyzing Codebase</h2>
    <p id="loading-message">${loadingMessage}</p>
  `;
  app.appendChild(loadingScreen);
  
  // Create main content (hidden initially)
  const mainContent = document.createElement('div');
  mainContent.className = 'main-content hidden';
  
  // Create sidebar
  const sidebar = document.createElement('div');
  sidebar.className = 'sidebar';
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <h2>Code Analyzer</h2>
    </div>
    <div class="sidebar-menu">
      <button class="menu-item active" data-view="ast">
        <span class="icon">🔍</span>
        <span>AST View</span>
      </button>
      <button class="menu-item" data-view="modules">
        <span class="icon">📦</span>
        <span>Module Dependencies</span>
      </button>
      <button class="menu-item" data-view="vulnerabilities">
        <span class="icon">🔒</span>
        <span>Vulnerabilities</span>
      </button>
    </div>
    <div class="sidebar-stats">
      <div class="stat-item">
        <span class="stat-label">Files</span>
        <span class="stat-value" id="files-count">-</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Nodes</span>
        <span class="stat-value" id="nodes-count">-</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Issues</span>
        <span class="stat-value" id="issues-count">-</span>
      </div>
    </div>
  `;
  mainContent.appendChild(sidebar);
  
  // Create visualization container
  const visContainer = document.createElement('div');
  visContainer.className = 'visualization-container';
  
  // Create entry point selector container (hidden initially)
  const entrypointContainer = document.createElement('div');
  entrypointContainer.className = 'entrypoint-container hidden';
  entrypointContainer.innerHTML = `
    <div class="entrypoint-dialog">
      <h2>Select Entry Point</h2>
      <p>Please select a file to use as the entry point for analysis:</p>
      <div class="file-list" id="entrypoint-file-list"></div>
    </div>
  `;
  visContainer.appendChild(entrypointContainer);
  
  // Create view containers
  const astView = document.createElement('div');
  astView.className = 'view-container ast-view hidden';
  astView.id = 'ast-view';
  
  const modulesView = document.createElement('div');
  modulesView.className = 'view-container modules-view hidden';
  modulesView.id = 'modules-view';
  
  const vulnerabilitiesView = document.createElement('div');
  vulnerabilitiesView.className = 'view-container vulnerabilities-view hidden';
  vulnerabilitiesView.id = 'vulnerabilities-view';
  
  visContainer.appendChild(astView);
  visContainer.appendChild(modulesView);
  visContainer.appendChild(vulnerabilitiesView);
  
  mainContent.appendChild(visContainer);
  app.appendChild(mainContent);
  
  // Set up event listeners for view switching
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.getAttribute('data-view');
      switchView(view);
      
      // Update active menu item
      document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

function updateLoadingMessage(message) {
  loadingMessage = message;
  const msgElement = document.getElementById('loading-message');
  if (msgElement) {
    msgElement.textContent = message;
  }
  
  // If we've been waiting for analysis for more than 15 seconds, try to request AST data directly
  if (message.includes('Analyzing') && !window.astRequestTimeout) {
    window.astRequestTimeout = setTimeout(() => {
      console.log('Analysis taking too long, requesting AST data directly');
      window.vscode.postMessage({ command: 'requestAst' });
    }, 15000);
  }
}

function showEntrypointSelector(files, projectDir) {
  // Hide loading screen
  document.querySelector('.loading-screen').classList.add('hidden');
  
  // Show entrypoint container
  const entrypointContainer = document.querySelector('.entrypoint-container');
  entrypointContainer.classList.remove('hidden');
  
  // Populate file list
  const fileList = document.getElementById('entrypoint-file-list');
  fileList.innerHTML = '';
  
  files.forEach(file => {
    const fileItem = document.createElement('div');
    fileItem.className = `file-item ${file.isLikelyEntry ? 'likely-entry' : ''}`;
    fileItem.innerHTML = `
      <span class="file-name">${file.name}</span>
      <span class="file-path">${file.path}</span>
      ${file.isLikelyEntry ? '<span class="likely-badge">Likely Entry</span>' : ''}
    `;
    
    fileItem.addEventListener('click', () => {
      // Select this file as entrypoint
      document.querySelectorAll('.file-item').forEach(item => {
        item.classList.remove('selected');
      });
      fileItem.classList.add('selected');
      
      // Send message to extension using vscode API
      window.vscode.postMessage({
        command: 'selectEntrypoint',
        projectDir: projectDir,
        entrypoint: file.path
      });
      
      // Show loading screen again
      entrypointContainer.classList.add('hidden');
      document.querySelector('.loading-screen').classList.remove('hidden');
      updateLoadingMessage('Analyzing with selected entry point...');
    });
    
    fileList.appendChild(fileItem);
  });
}

function transitionToView(view) {
  if (view === currentView) return;
  
  // First handle loading transition if coming from loading
  if (currentView === 'loading') {
    // Hide loading screen with animation
    const loadingScreen = document.querySelector('.loading-screen');
    loadingScreen.style.opacity = '0';
    
    setTimeout(() => {
      loadingScreen.classList.add('hidden');
      document.querySelector('.main-content').classList.remove('hidden');
      
      // Now switch to the requested view
      switchView(view);
    }, 500);
        } else {
    // Just switch views directly
    switchView(view);
  }
  
  currentView = view;
}

function switchView(view) {
  // Hide all views
  document.querySelectorAll('.view-container').forEach(container => {
    container.classList.add('hidden');
  });
  
  // Show selected view
  const viewElement = document.getElementById(`${view}-view`);
  if (viewElement) {
    viewElement.classList.remove('hidden');
    
    // Initialize view if needed and we have data
    if (astData) {
      if (view === 'ast' && !viewElement.hasAttribute('data-initialized')) {
        initASTView(viewElement);
        viewElement.setAttribute('data-initialized', 'true');
      } else if (view === 'modules' && !viewElement.hasAttribute('data-initialized')) {
        initModulesView(viewElement);
        viewElement.setAttribute('data-initialized', 'true');
      } else if (view === 'vulnerabilities' && !viewElement.hasAttribute('data-initialized')) {
        initVulnerabilitiesView(viewElement);
        viewElement.setAttribute('data-initialized', 'true');
      }
    }
  }
}

function initASTView(container) {
  console.log('Initializing AST view');
  
  // Get metadata from AST
  const metadata = astData.metadata || {};
  const files = astData.files || {};
  
  // Update stats
  document.getElementById('files-count').textContent = metadata.fileCount || Object.keys(files).length;
  document.getElementById('nodes-count').textContent = calculateTotalNodes(files);
  
  // Create placeholder message until we implement 3D view
  container.innerHTML = `
    <div class="placeholder-message">
      <h2>AST Visualization</h2>
      <p>Analyzing ${metadata.fileCount || Object.keys(files).length} files with ${calculateTotalNodes(files)} nodes.</p>
      <p>Primary language: ${metadata.primaryLanguage || 'Unknown'}</p>
    </div>
  `;
  
  // We'll add Three.js visualization in a future update
}

function initModulesView(container) {
  console.log('Initializing Modules view');
  
  // Create placeholder message until we implement module visualization
  container.innerHTML = `
    <div class="placeholder-message">
      <h2>Module Dependencies</h2>
      <p>Dependency graph visualization will be displayed here.</p>
    </div>
  `;
  
  // We'll add D3.js visualization in a future update
}

function initVulnerabilitiesView(container) {
  console.log('Initializing Vulnerabilities view');
  
  // Create placeholder message until we implement vulnerabilities
  container.innerHTML = `
    <div class="placeholder-message">
      <h2>Security Analysis</h2>
      <p>Detected vulnerabilities will be displayed here.</p>
    </div>
  `;
  
  // We'll add vulnerabilities in a future update
}

function calculateTotalNodes(files) {
  let total = 0;
  for (const file in files) {
    if (files[file].ast && files[file].ast.body) {
      total += files[file].ast.body.length;
    }
  }
  return total;
}

function showError(message) {
  // Create error message element
  const errorElement = document.createElement('div');
  errorElement.className = 'error-message';
  errorElement.textContent = message;
  document.body.appendChild(errorElement);
  
  // Show error message
  setTimeout(() => {
    errorElement.classList.add('show');
    setTimeout(() => {
      errorElement.classList.remove('show');
      setTimeout(() => errorElement.remove(), 500);
    }, 5000);
  }, 100);
  
  // Also update loading message if we're still in loading state
  if (currentView === 'loading') {
    updateLoadingMessage(`Error: ${message}`);
  }
  
  console.error('Error:', message);
}