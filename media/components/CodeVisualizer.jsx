import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Html, Line, Text } from '@react-three/drei';
import { EffectComposer, Bloom, SSAO, Vignette, Outline } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import gsap from 'gsap';
import { motion } from 'framer-motion';

import NodeMesh from './NodeMesh';
import EdgeMesh from './EdgeMesh';
import { createForceSimulation, runSimulation, applyForceSimulation } from '../utils/forceSimulation';

// Camera controller with zoom to node capability
const CameraController = ({ focusNode, focusDistance = 10 }) => {
  const { camera, invalidate } = useThree();
  const controlsRef = useRef();
  
  // Handle focusing on a specific node
  useEffect(() => {
    if (focusNode && controlsRef.current) {
      const targetPosition = new THREE.Vector3(
        focusNode.x || 0,
        focusNode.y || 0,
        focusNode.z || 0
      );
      
      // Calculate camera position
      const cameraPosition = targetPosition.clone().add(
        new THREE.Vector3(focusDistance, focusDistance, focusDistance)
      );
      
      // Animate camera movement
      gsap.to(camera.position, {
        x: cameraPosition.x,
        y: cameraPosition.y,
        z: cameraPosition.z,
        duration: 1.5,
        ease: 'power3.inOut',
        onUpdate: invalidate
      });
      
      // Set controls target
      gsap.to(controlsRef.current.target, {
        x: targetPosition.x,
        y: targetPosition.y,
        z: targetPosition.z,
        duration: 1.5,
        ease: 'power3.inOut',
        onUpdate: () => {
          controlsRef.current.update();
          invalidate();
        }
      });
    }
  }, [focusNode, focusDistance, camera, invalidate]);
  
  return <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.1} />;
};

// Background with stars and grid
const Background = () => {
  const gridRef = useRef();
  
  useFrame(({ clock }) => {
    if (gridRef.current) {
      gridRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.1) * 0.05;
      gridRef.current.rotation.z = Math.cos(clock.getElapsedTime() * 0.1) * 0.05;
    }
  });
  
  return (
    <>
      <Stars radius={100} depth={50} count={5000} factor={4} fade />
      <gridHelper
        ref={gridRef}
        args={[100, 100, '#444444', '#222222']}
        position={[0, -15, 0]}
      />
      <fog attach="fog" args={['#030518', 50, 200]} />
    </>
  );
};

// Main visualization scene
const VisualizationScene = ({
  astData,
  onNodeClick,
  onNodeHover,
  selectedNode,
  selectedTypes = []
}) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [cameraFocus, setCameraFocus] = useState(null);
  const nodesRef = useRef({});
  const edgesRef = useRef({});
  const simulation = useRef(null);
  
  // Process AST data into nodes and edges
  useEffect(() => {
    if (!astData) return;
    
    const processedNodes = [];
    const processedEdges = [];
    const nodeMap = {};
    
    // Process functions
    if (astData.functions) {
      astData.functions.forEach(func => {
        // Add function node
        processedNodes.push({
          ...func,
          nodeType: 'function',
          size: func.children?.length || 1,
          x: func.x || (Math.random() - 0.5) * 50,
          y: func.y || (Math.random() - 0.5) * 50,
          z: func.z || (Math.random() - 0.5) * 50
        });
        
        nodeMap[func.id] = func;
        
        // Process children (calls, etc)
        if (func.children) {
          func.children.forEach(child => {
            processedNodes.push({
              ...child,
              size: 0.8,
              x: child.x || func.x + (Math.random() - 0.5) * 10,
              y: child.y || func.y + (Math.random() - 0.5) * 10,
              z: child.z || func.z + (Math.random() - 0.5) * 10
            });
            
            // Add edge from function to child
            processedEdges.push({
              id: `${func.id}_${child.id}`,
              source: func.id,
              target: child.id,
              type: 'call',
              strength: 1
            });
            
            nodeMap[child.id] = child;
          });
        }
      });
    }
    
    // Process variables
    if (astData.variables) {
      astData.variables.forEach(variable => {
        processedNodes.push({
          ...variable,
          nodeType: 'variable',
          size: 0.7,
          x: variable.x || (Math.random() - 0.5) * 50,
          y: variable.y || (Math.random() - 0.5) * 50,
          z: variable.z || (Math.random() - 0.5) * 50
        });
        
        nodeMap[variable.id] = variable;
      });
    }
    
    // Process modules
    if (astData.modules) {
      astData.modules.forEach((module, index) => {
        const moduleId = `module_${index}`;
        processedNodes.push({
          id: moduleId,
          name: module,
          nodeType: 'module',
          size: 1.2,
          x: (Math.random() - 0.5) * 50,
          y: (Math.random() - 0.5) * 50,
          z: (Math.random() - 0.5) * 50
        });
        
        nodeMap[moduleId] = { id: moduleId, name: module, nodeType: 'module' };
      });
    }
    
    // Process vulnerabilities
    if (astData.vulnerabilities) {
      astData.vulnerabilities.forEach(vuln => {
        processedNodes.push({
          ...vuln,
          nodeType: 'vulnerability',
          size: 1.1,
          x: vuln.x || (Math.random() - 0.5) * 50,
          y: vuln.y || (Math.random() - 0.5) * 50,
          z: vuln.z || (Math.random() - 0.5) * 50
        });
        
        nodeMap[vuln.id] = vuln;
        
        // If the vulnerability has a node_id, link to that node
        if (vuln.node_id && nodeMap[vuln.node_id]) {
          processedEdges.push({
            id: `${vuln.id}_${vuln.node_id}`,
            source: vuln.id,
            target: vuln.node_id,
            type: 'reference',
            strength: 1.2
          });
        }
      });
    }
    
    // Process dataflow edges
    if (astData.dataflow) {
      astData.dataflow.forEach((flow, index) => {
        if (nodeMap[flow.from] && nodeMap[flow.to]) {
          processedEdges.push({
            id: `dataflow_${index}`,
            source: flow.from,
            target: flow.to,
            type: 'dataflow',
            strength: 1
          });
        }
      });
    }
    
    setNodes(processedNodes);
    setEdges(processedEdges);
    
    // Create force simulation
    simulation.current = createForceSimulation(
      processedNodes,
      processedEdges.map(edge => ({
        ...edge,
        source: nodeMap[edge.source],
        target: nodeMap[edge.target]
      })),
      { dimensions: 3 }
    );
    
    // Run initial simulation
    runSimulation(simulation.current, 100);
    
  }, [astData]);
  
  // Filter nodes based on selected types
  const filteredNodes = useMemo(() => {
    if (!selectedTypes.length) return nodes;
    return nodes.filter(node => selectedTypes.includes(node.nodeType));
  }, [nodes, selectedTypes]);
  
  // Filter edges based on filtered nodes
  const filteredEdges = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    return edges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  }, [filteredNodes, edges]);
  
  // Handle node click
  const handleNodeClick = (node) => {
    if (onNodeClick) onNodeClick(node);
    setCameraFocus(node);
  };
  
  // Handle node hover
  const handleNodeHover = (node) => {
    setHoveredNode(node);
    if (onNodeHover) onNodeHover(node);
  };
  
  // Animation frame updates
  useFrame(() => {
    if (simulation.current && simulation.current.alpha() > simulation.current.alphaMin()) {
      simulation.current.tick();
      
      // Apply positions from simulation to visual nodes
      simulation.current.nodes().forEach(node => {
        if (nodesRef.current[node.id]) {
          nodesRef.current[node.id].position.x = node.x;
          nodesRef.current[node.id].position.y = node.y;
          nodesRef.current[node.id].position.z = node.z;
        }
      });
      
      // Update edges
      edges.forEach(edge => {
        const sourceNode = simulation.current.nodes().find(n => n.id === edge.source);
        const targetNode = simulation.current.nodes().find(n => n.id === edge.target);
        
        if (sourceNode && targetNode && edgesRef.current[edge.id]) {
          edgesRef.current[edge.id].update(sourceNode, targetNode);
        }
      });
    }
  });
  
  // Get related nodes for highlighting
  const relatedNodeIds = useMemo(() => {
    if (!selectedNode && !hoveredNode) return new Set();
    
    const focusNode = selectedNode || hoveredNode;
    const relatedIds = new Set([focusNode.id]);
    
    // Add connected nodes via edges
    edges.forEach(edge => {
      if (edge.source === focusNode.id) {
        relatedIds.add(edge.target);
      } else if (edge.target === focusNode.id) {
        relatedIds.add(edge.source);
      }
    });
    
    return relatedIds;
  }, [selectedNode, hoveredNode, edges]);
  
  // Render node objects
  const renderNodes = () => {
    return filteredNodes.map(node => {
      const isSelected = selectedNode && selectedNode.id === node.id;
      const isHighlighted = relatedNodeIds.has(node.id) && !isSelected;
      
      return (
        <NodeMesh
          key={node.id}
          ref={el => { if (el) nodesRef.current[node.id] = el; }}
          node={node}
          position={[node.x || 0, node.y || 0, node.z || a0]}
          isSelected={isSelected}
          isHighlighted={isHighlighted}
          onClick={handleNodeClick}
          onHover={handleNodeHover}
          onUnhover={() => setHoveredNode(null)}
        />
      );
    });
  };
  
  // Render edge objects
  const renderEdges = () => {
    return filteredEdges.map(edge => {
      const sourceNode = filteredNodes.find(n => n.id === edge.source);
      const targetNode = filteredNodes.find(n => n.id === edge.target);
      
      if (!sourceNode || !targetNode) return null;
      
      const isHighlighted = (selectedNode || hoveredNode) && 
        (relatedNodeIds.has(edge.source) && relatedNodeIds.has(edge.target));
      
      return (
        <EdgeMesh
          key={edge.id}
          ref={el => { if (el) edgesRef.current[edge.id] = el; }}
          source={sourceNode}
          target={targetNode}
          type={edge.type}
          strength={edge.strength}
          isHighlighted={isHighlighted}
        />
      );
    });
  };
  
  return (
    <>
      {/* 3D Objects */}
      <Background />
      <CameraController focusNode={cameraFocus} />
      
      {/* Nodes and Edges */}
      <group>
        {renderEdges()}
        {renderNodes()}
      </group>
      
      {/* Post-processing effects */}
      <EffectComposer>
        <Bloom
          intensity={1.3}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          blendFunction={BlendFunction.SCREEN}
        />
        <SSAO
          radius={0.05}
          intensity={20}
          luminanceInfluence={0.6}
          color="black"
        />
        <Vignette
          offset={0.5}
          darkness={0.5}
          blendFunction={BlendFunction.NORMAL}
        />
      </EffectComposer>
    </>
  );
};

// Type filter buttons
const TypeFilter = ({ types, selectedTypes, onChange }) => {
  return (
    <div className="type-filter">
      {types.map(type => (
        <motion.button
          key={type.id}
          className={`filter-button ${selectedTypes.includes(type.id) ? 'active' : ''}`}
          onClick={() => onChange(type.id)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <span className="filter-icon" style={{ background: type.color }}></span>
          <span className="filter-label">{type.label}</span>
        </motion.button>
      ))}
    </div>
  );
};

// Node details panel
const NodeDetailsPanel = ({ node }) => {
  if (!node) return null;
  
  return (
    <motion.div
      className="node-details-panel"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      transition={{ duration: 0.3 }}
    >
      <h3>{node.name || node.id}</h3>
      <div className="node-type">{node.nodeType}</div>
      
      <div className="node-properties">
        {Object.entries(node).map(([key, value]) => {
          // Skip rendering certain properties
          if (['id', 'name', 'nodeType', 'x', 'y', 'z', 'children'].includes(key)) return null;
          
          // Render property
          return (
            <div key={key} className="property">
              <div className="property-name">{key}:</div>
              <div className="property-value">
                {typeof value === 'object' ? JSON.stringify(value) : value.toString()}
              </div>
            </div>
          );
        })}
      </div>
      
      {node.nodeType === 'function' && node.children && (
        <div className="node-calls">
          <h4>Function Calls:</h4>
          <ul>
            {node.children.map(call => (
              <li key={call.id}>{call.target}</li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
};

// Main CodeVisualizer component
const CodeVisualizer = ({ astData, viewMode = 'ast' }) => {
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedTypes, setSelectedTypes] = useState([]);
  
  // Node type filters
  const nodeTypes = [
    { id: 'function', label: 'Functions', color: '#4CAF50' },
    { id: 'variable', label: 'Variables', color: '#2196F3' },
    { id: 'vulnerability', label: 'Vulnerabilities', color: '#F44336' },
    { id: 'module', label: 'Modules', color: '#FFC107' },
    { id: 'call', label: 'Calls', color: '#9C27B0' }
  ];
  
  // Toggle node type filter
  const toggleTypeFilter = (typeId) => {
    if (selectedTypes.includes(typeId)) {
      setSelectedTypes(selectedTypes.filter(id => id !== typeId));
    } else {
      setSelectedTypes([...selectedTypes, typeId]);
    }
  };
  
  // Handle node click
  const handleNodeClick = (node) => {
    setSelectedNode(prev => prev && prev.id === node.id ? null : node);
  };
  
  // Handle node hover
  const handleNodeHover = (node) => {
    setHoveredNode(node);
  };
  
  // Clear node selection/hover
  const handleCanvasClick = (e) => {
    if (e.target.tagName === 'CANVAS') {
      setSelectedNode(null);
    }
  };
  
  return (
    <div className="code-visualizer" onClick={handleCanvasClick}>
      <TypeFilter 
        types={nodeTypes}
        selectedTypes={selectedTypes.length ? selectedTypes : nodeTypes.map(t => t.id)}
        onChange={toggleTypeFilter}
      />
      
      <Canvas camera={{ position: [0, 0, 50], fov: 60 }}>
        <VisualizationScene
          astData={astData}
          viewMode={viewMode}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          selectedNode={selectedNode}
          selectedTypes={selectedTypes.length ? selectedTypes : nodeTypes.map(t => t.id)}
        />
      </Canvas>
      
      <NodeDetailsPanel node={selectedNode || hoveredNode} />
      
      {/* Instructions overlay */}
      <div className="instructions-overlay">
        <p>🖱️ Left-click: Rotate | Middle-click: Pan | Scroll: Zoom | Click node: Select</p>
      </div>
    </div>
  );
};

export default CodeVisualizer; 