import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import LoadingScreen from './LoadingScreen';
import EntrypointSelector from './EntrypointSelector';
import CodeVisualizer from './CodeVisualizer';

// Main App component
const App = () => {
  const [currentView, setCurrentView] = useState('loading');
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [projectDir, setProjectDir] = useState(null);
  const [astData, setAstData] = useState(null);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  
  // Initialize the communication with the VS Code extension
  useEffect(() => {
    // Ensure vscode API is available
    if (!window.vscode) {
      console.error('VS Code API not found');
      setError('VS Code API not available');
      return;
    }
    
    // Listen for messages from the extension
    const messageHandler = (event) => {
      const message = event.data;
      console.log('Received message:', message);
      
      switch (message.command) {
        case 'loading':
          setLoadingMessage(message.message);
          updateLoadingProgress(message.message);
          break;
          
        case 'analyze':
          // Prepare for analysis
          setProjectDir(message.projectDir);
          setCurrentView('loading');
          setLoadingMessage('Analyzing project...');
          setLoadingProgress(0.2);
          break;
          
        case 'astData':
          // We received AST data, switch to visualization
          setAstData(message.data);
          setLoadingProgress(1);
          // Use a small delay to show the completed progress before switching
          setTimeout(() => {
            setCurrentView('ast');
          }, 500);
          break;
          
        case 'error':
          setError(message.message);
          setLoadingMessage(`Error: ${message.message}`);
          break;
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Clean up the event listener on unmount
    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, []);
  
  // Update loading progress based on message
  const updateLoadingProgress = (message) => {
    // Determine progress based on the loading message
    if (message.includes('Python environment')) {
      setLoadingProgress(0.1);
    } else if (message.includes('Starting Python server')) {
      setLoadingProgress(0.3);
    } else if (message.includes('Python server started')) {
      setLoadingProgress(0.5);
    } else if (message.includes('Analyzing')) {
      setLoadingProgress(0.7);
    }
  };
  
  // Handle selecting an entrypoint file
  const handleSelectEntrypoint = (projectDir, entrypoint) => {
    // Show loading screen while analyzing with the selected entry point
    setCurrentView('loading');
    setLoadingMessage('Analyzing with selected entry point...');
    setLoadingProgress(0.4);
    
    // Send message to extension with selected entrypoint
    window.vscode.postMessage({
      command: 'selectEntrypoint',
      projectDir,
      entrypoint
    });
  };
  
  // Handle switching the view
  const switchView = (view) => {
    if (currentView === view) return;
    setCurrentView(view);
  };
  
  // Render based on current view
  const renderView = () => {
    switch (currentView) {
      case 'loading':
        return (
          <LoadingScreen 
            message={loadingMessage}
            progress={loadingProgress}
            isVisible={true}
          />
        );
        
      case 'entrypoint':
        return (
          <EntrypointSelector
            files={files}
            projectDir={projectDir}
            onSelectEntrypoint={handleSelectEntrypoint}
            isVisible={true}
          />
        );
        
      case 'ast':
        return (
          <CodeVisualizer
            astData={astData}
            viewMode="ast"
          />
        );
        
      case 'modules':
        return (
          <CodeVisualizer
            astData={astData}
            viewMode="modules"
          />
        );
        
      case 'vulnerabilities':
        return (
          <CodeVisualizer
            astData={astData}
            viewMode="vulnerabilities"
          />
        );
        
      default:
        return (
          <div className="error-view">
            <h1>Unknown view: {currentView}</h1>
          </div>
        );
    }
  };
  
  // Effect to handle entrypoint selection when needed
  useEffect(() => {
    if (astData && astData.status === 'needs_entrypoint') {
      setFiles(astData.options || []);
      setCurrentView('entrypoint');
    }
  }, [astData]);
  
  // Render error message if there's an error
  if (error && currentView !== 'loading') {
    return (
      <div className="error-view">
        <h1>Error</h1>
        <p>{error}</p>
        <button onClick={() => window.vscode.postMessage({ command: 'requestAst' })}>
          Retry
        </button>
      </div>
    );
  }
  
  return (
    <div className="app-container">
      {/* Header with view switcher */}
      {currentView !== 'loading' && currentView !== 'entrypoint' && (
        <header className="app-header">
          <div className="app-title">Code Analyzer</div>
          <nav className="view-nav">
            <button 
              className={`nav-button ${currentView === 'ast' ? 'active' : ''}`}
              onClick={() => switchView('ast')}
            >
              AST View
            </button>
            <button 
              className={`nav-button ${currentView === 'modules' ? 'active' : ''}`}
              onClick={() => switchView('modules')}
            >
              Module Dependencies
            </button>
            <button 
              className={`nav-button ${currentView === 'vulnerabilities' ? 'active' : ''}`}
              onClick={() => switchView('vulnerabilities')}
            >
              Vulnerabilities
            </button>
          </nav>
        </header>
      )}
      
      {/* Main content with view */}
      <main className="app-content">
        <AnimatePresence mode="wait">
          {renderView()}
        </AnimatePresence>
      </main>
      
      {/* Error toast for displaying errors */}
      <AnimatePresence>
        {error && (
          <div className="error-toast">
            <div className="error-icon">⚠️</div>
            <div className="error-message">{error}</div>
            <button className="error-close" onClick={() => setError(null)}>×</button>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App; 