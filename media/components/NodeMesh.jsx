import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';

// Color mapping for node types
const NODE_COLORS = {
  function: new THREE.Color('#4CAF50'),    // Green
  variable: new THREE.Color('#2196F3'),    // Blue
  vulnerability: new THREE.Color('#F44336'), // Red
  module: new THREE.Color('#FFC107'),      // Yellow/Amber
  comment: new THREE.Color('#9E9E9E'),     // Gray
  call: new THREE.Color('#9C27B0'),        // Purple
  literal: new THREE.Color('#9575CD'),     // Light Purple
  default: new THREE.Color('#78909C')      // Blue Gray
};

// Node sizes based on importance
const getNodeSize = (node, baseSize = 1) => {
  const nodeType = node.nodeType || 'default';
  
  let multiplier = 1;
  
  // Size by type
  switch (nodeType) {
    case 'function':
      multiplier = 1.5;
      break;
    case 'call':
      multiplier = 0.8;
      break;
    case 'vulnerability':
      multiplier = 1.3;
      break;
    default:
      multiplier = 1;
  }
  
  // Adjust by depth if available
  if (node.depth) {
    // Deeper nodes are smaller
    multiplier *= Math.max(0.5, 1 - node.depth * 0.05);
  }
  
  // Adjust by importance if available
  if (node.importance) {
    multiplier *= node.importance;
  }
  
  return baseSize * multiplier;
};

// Get color based on node type
const getNodeColor = (node) => {
  const nodeType = node.nodeType || 'default';
  return NODE_COLORS[nodeType] || NODE_COLORS.default;
};

// Node mesh component with custom shader
const NodeMesh = ({
  node,
  position = [0, 0, 0],
  size = 1,
  isSelected = false,
  isHighlighted = false,
  onClick,
  onHover,
  onUnhover,
  showLabel = true,
  pulseEffect = true
}) => {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  const color = useMemo(() => getNodeColor(node), [node]);
  const nodeSize = useMemo(() => getNodeSize(node, size), [node, size]);
  const nodeLabel = node.name || (node.tooltip ? node.tooltip.split('\n')[0] : node.id || 'Node');
  
  // Handle hover and click events
  const handlePointerOver = (e) => {
    e.stopPropagation();
    setHovered(true);
    if (onHover) onHover(node);
  };
  
  const handlePointerOut = (e) => {
    e.stopPropagation();
    setHovered(false);
    if (onUnhover) onUnhover();
  };
  
  const handleClick = (e) => {
    e.stopPropagation();
    if (onClick) onClick(node);
  };
  
  // Apply animations and effects
  useEffect(() => {
    if (!meshRef.current) return;
    
    let targetScale = nodeSize;
    
    if (isSelected) {
      targetScale = nodeSize * 1.3;
    } else if (hovered || isHighlighted) {
      targetScale = nodeSize * 1.15;
    }
    
    // Animate scale
    gsap.to(meshRef.current.scale, {
      x: targetScale,
      y: targetScale,
      z: targetScale,
      duration: 0.3,
      ease: 'power2.out'
    });
    
    // Update uniforms if using custom shader material
    if (meshRef.current.material && meshRef.current.material.uniforms) {
      gsap.to(meshRef.current.material.uniforms.importance, {
        value: isSelected ? 2 : isHighlighted ? 1.5 : hovered ? 1.3 : 1,
        duration: 0.3
      });
    }
  }, [isSelected, isHighlighted, hovered, nodeSize]);
  
  // Animation loop for effects
  useFrame(({ clock }) => {
    if (meshRef.current && meshRef.current.material && meshRef.current.material.uniforms) {
      // Update time uniform for animated effects
      meshRef.current.material.uniforms.time.value = clock.getElapsedTime();
    }
  });
  
  // Create custom shader material
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: color },
        importance: { value: 1.0 }
      },
      vertexShader: `
        uniform float time;
        uniform float importance;
        varying vec3 vPosition;
        varying float vImportance;
        
        void main() {
          vPosition = position;
          vImportance = importance;
          
          // Calculate position with time-based animation
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          
          // Subtle oscillation based on time and importance
          float oscillation = sin(time * 2.0 + position.x * 0.5) * 0.05 * importance;
          mvPosition.y += oscillation;
          
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        uniform float importance;
        varying vec3 vPosition;
        varying float vImportance;
        
        void main() {
          // Calculate distance from center for circular gradient
          float dist = length(vPosition);
          
          // Create a glowing effect
          float glow = smoothstep(1.0, 0.0, dist) * 0.8;
          
          // Animated pulse based on importance
          float pulse = 1.0 + 0.2 * sin(time * 3.0) * vImportance;
          
          // Edge highlighting
          float edge = smoothstep(0.9, 1.0, dist) * 0.5;
          
          // Final color with glow and pulse
          vec3 finalColor = color * glow * pulse + vec3(1.0, 1.0, 1.0) * edge;
          
          gl_FragColor = vec4(finalColor, glow);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }, [color]);
  
  return (
    <group position={position}>
      {/* Main node sphere with custom shader */}
      <mesh
        ref={meshRef}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <sphereGeometry args={[1, 32, 32]} />
        <primitive object={shaderMaterial} attach="material" />
      </mesh>
      
      {/* Node label */}
      {showLabel && (
        <Text
          position={[0, nodeSize * 1.3, 0]}
          fontSize={nodeSize * 0.5}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor="#000000"
          maxWidth={nodeSize * 5}
        >
          {nodeLabel}
        </Text>
      )}
      
      {/* Tooltip on hover */}
      {(hovered || isSelected) && node.tooltip && (
        <Html
          position={[0, nodeSize * -1.5, 0]}
          className="node-tooltip"
          center
          distanceFactor={10}
        >
          <div className="tooltip-content">
            {node.tooltip.split('\n').map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </Html>
      )}
      
      {/* Highlight ring for selected nodes */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[nodeSize * 1.2, nodeSize * 1.3, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
      
      {/* Flowing particles around important nodes */}
      {(isSelected || isHighlighted) && pulseEffect && (
        <mesh>
          <sphereGeometry args={[nodeSize * 1.5, 8, 8]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.2}
            wireframe
          />
        </mesh>
      )}
    </group>
  );
};

export default NodeMesh; 