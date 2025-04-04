import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import LoadingScreen from './LoadingScreen';
import EntrypointSelector from './EntrypointSelector';
import CodeVisualizer from './CodeVisualizer';

// Main App component
export default function App() {
  const [currentView, setCurrentView] = useState('loading');
  const [loadingMessage, setLoadingMessage] = useState('Initializing visualization...');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [projectDir, setProjectDir] = useState(null);
  const [astData, setAstData] = useState(null);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  
  // Initialize the communication with the VS Code extension
  useEffect(() => {
    // Ensure vscode API is available
    if (!window.vscode) {
      console.error('VS Code API not found');
      setError('VS Code API not available');
      return;
    }
    
    // Set initial loading state
    setCurrentView('loading');
    setLoadingMessage('Initializing visualization...');
    setLoadingProgress(0);
    
    // Simulate loading progress for at least 5 seconds
    const loadingInterval = setInterval(() => {
      setLoadingProgress(prev => {
        const newProgress = Math.min(prev + 0.05, 0.9);
        return newProgress;
      });
    }, 500);
    
    // Listen for messages from the extension
    const messageHandler = (event) => {
      const message = event.data;
      
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
          
        case 'analysis':
          console.log('Received analysis data:', message.data);
          // We received AST data, but keep loading screen for at least 5 seconds
          setAstData(message.data);
          setLoadingProgress(0.95);
          
          // Use a delay to show the completed progress before switching
          setTimeout(() => {
            clearInterval(loadingInterval);
            setLoadingProgress(1);
            
            // Additional delay to ensure loading screen is visible for at least 5-10 seconds
            setTimeout(() => {
              setCurrentView('ast');
            }, 2000);
          }, 3000);
          break;
          
        case 'error':
          setError(message.message);
          setLoadingMessage(`Error: ${message.message}`);
          clearInterval(loadingInterval);
          break;
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Request initial analysis data
    window.vscode.postMessage({ command: 'getAnalysis' });
    
    // Clean up the event listener and interval on unmount
    return () => {
      window.removeEventListener('message', messageHandler);
      clearInterval(loadingInterval);
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
    } else if (message.includes('Analyzing code')) {
      setLoadingProgress(0.7);
    } else if (message.includes('Generating visualization')) {
      setLoadingProgress(0.9);
    }
  };
  
  // Handle entrypoint selection
  const handleSelectEntrypoint = (projectDir, entrypoint) => {
    setProjectDir(projectDir);
    setCurrentView('ast');
  };
  
  // Switch between views
  const switchView = (view) => {
    setCurrentView(view);
  };
  
  // Render the current view
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
            projectDir={projectDir} 
            onSelect={handleSelectEntrypoint} 
          />
        );
      case 'ast':
        return (
          <CodeVisualizer 
            astData={astData} 
            files={files} 
            onBack={() => switchView('entrypoint')} 
          />
        );
      case 'visualization':
        return <VisualizationPanel data={analysisData} />;
      default:
        return <div>Unknown view: {currentView}</div>;
    }
  };
  
  return (
    <div className="app-container">
      <AnimatePresence mode="wait">
        {renderView()}
      </AnimatePresence>
    </div>
  );
} 