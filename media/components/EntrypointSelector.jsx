import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';

// 3D file icon component
const FileIcon = ({ isSelected, isLikelyEntry, onClick, position }) => {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  
  // Animate on hover, selection changes
  useEffect(() => {
    if (!meshRef.current) return;
    
    let targetScale = 1;
    let targetColor = '#3a506b'; // Default blue-gray
    
    if (isSelected) {
      targetScale = 1.2;
      targetColor = '#6c5ce7'; // Purple
    } else if (hovered) {
      targetScale = 1.1;
      targetColor = '#00cec9'; // Teal
    } else if (isLikelyEntry) {
      targetColor = '#00b894'; // Green
    }
    
    gsap.to(meshRef.current.scale, {
      x: targetScale,
      y: targetScale,
      z: targetScale,
      duration: 0.3,
      ease: 'power2.out'
    });
    
    gsap.to(meshRef.current.material, {
      color: new THREE.Color(targetColor),
      emissive: new THREE.Color(isSelected ? '#6c5ce7' : hovered ? '#00cec9' : '#000'),
      emissiveIntensity: isSelected ? 0.5 : hovered ? 0.3 : 0,
      duration: 0.3
    });
    
    // Bounce animation for likely entries
    if (isLikelyEntry && !isSelected && !hovered) {
      gsap.to(meshRef.current.position, {
        y: position[1] + Math.sin(Date.now() * 0.001) * 0.1,
        duration: 1,
        repeat: -1,
        yoyo: true
      });
    } else {
      gsap.to(meshRef.current.position, {
        y: position[1],
        duration: 0.3
      });
    }
  }, [hovered, isSelected, isLikelyEntry, position]);
  
  return (
    <>
      <mesh
        ref={meshRef}
        position={position}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[1, 1.4, 0.1]} />
        <meshStandardMaterial
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>
      
      {/* File icon details */}
      <mesh position={[position[0], position[1], position[2] + 0.06]}>
        <planeGeometry args={[0.8, 0.8]} />
        <meshBasicMaterial color="#fff" transparent opacity={0.7} />
      </mesh>
      
      {/* Label */}
      <Text
        position={[position[0], position[1] - 0.8, position[2] + 0.1]}
        fontSize={0.15}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {isLikelyEntry ? '★ Entry ★' : 'File'}
      </Text>
    </>
  );
};

// File list item
const FileListItem = ({ file, isSelected, onSelect }) => {
  return (
    <motion.div
      className={`file-item ${file.isLikelyEntry ? 'likely-entry' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(file)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      whileHover={{
        scale: 1.02,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
      }}
    >
      <div className="file-icon">
        {file.isLikelyEntry && <div className="likely-badge">★</div>}
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path
            fill={isSelected ? '#6c5ce7' : file.isLikelyEntry ? '#00b894' : '#3a506b'}
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
          />
          <path
            fill={isSelected ? '#d6c5ff' : file.isLikelyEntry ? '#c1ffeb' : '#dfe6e9'}
            d="M14 2v6h6"
          />
          <path
            fill={isSelected ? '#d6c5ff' : file.isLikelyEntry ? '#c1ffeb' : '#dfe6e9'}
            d="M16 13H8M16 17H8M10 9H8"
          />
        </svg>
      </div>
      <div className="file-info">
        <span className="file-name">{file.name}</span>
        <span className="file-path">{file.path}</span>
      </div>
      {file.isLikelyEntry && <span className="likely-badge-text">Likely Entry</span>}
    </motion.div>
  );
};

// 3D File visualization
const FileVisualization = ({ files, selectedFile, onSelectFile }) => {
  // Position files in a grid or circle
  const getFilePosition = (index, total) => {
    const radius = 5;
    const angle = (index / total) * Math.PI * 2;
    return [
      Math.sin(angle) * radius,
      0,
      Math.cos(angle) * radius
    ];
  };
  
  return (
    <Canvas camera={{ position: [0, 3, 10], fov: 50 }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <spotLight position={[0, 5, 0]} angle={0.3} penumbra={1} intensity={1} castShadow />
      
      {/* Ground plane with reflection */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial
          color="#0f1729"
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>
      
      {/* File icons */}
      {files.map((file, index) => (
        <FileIcon
          key={file.path}
          position={getFilePosition(index, files.length)}
          isSelected={selectedFile && selectedFile.path === file.path}
          isLikelyEntry={file.isLikelyEntry}
          onClick={() => onSelectFile(file)}
        />
      ))}
      
      {/* Center label */}
      <Text
        position={[0, 2, 0]}
        fontSize={0.5}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        fillOpacity={0.8}
      >
        Select Entry Point
      </Text>
    </Canvas>
  );
};

// Main entrypoint selector component
const EntrypointSelector = ({ files = [], projectDir, onSelectEntrypoint, isVisible = false }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Auto-select the likely entry if there's only one
  useEffect(() => {
    if (files.length === 1) {
      setSelectedFile(files[0]);
    } else if (files.length > 1) {
      const likelyEntries = files.filter(f => f.isLikelyEntry);
      if (likelyEntries.length === 1) {
        setSelectedFile(likelyEntries[0]);
      }
    }
  }, [files]);
  
  const handleSelect = (file) => {
    setSelectedFile(file);
  };
  
  const handleConfirm = () => {
    if (selectedFile) {
      onSelectEntrypoint(projectDir, selectedFile.path);
    }
  };
  
  if (!isVisible) return null;
  
  return (
    <div className="entrypoint-container">
      <motion.div
        className="entrypoint-dialog"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2>Select Entry Point</h2>
        <p>Please select a file to use as the entry point for analysis:</p>
        
        <div className="file-visualizer">
          <FileVisualization
            files={files}
            selectedFile={selectedFile}
            onSelectFile={handleSelect}
          />
        </div>
        
        <div className="file-list">
          <AnimatePresence>
            {files.map(file => (
              <FileListItem
                key={file.path}
                file={file}
                isSelected={selectedFile && selectedFile.path === file.path}
                onSelect={handleSelect}
              />
            ))}
          </AnimatePresence>
        </div>
        
        <div className="actions">
          <motion.button
            className="confirm-button"
            onClick={handleConfirm}
            disabled={!selectedFile}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Analyze with Selected File
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default EntrypointSelector; 