import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';

// Edge type colors
const EDGE_COLORS = {
  call: new THREE.Color('#8e44ad'),      // Purple
  dataflow: new THREE.Color('#3498db'),  // Blue
  dependency: new THREE.Color('#f39c12'), // Orange
  reference: new THREE.Color('#1abc9c'), // Teal
  default: new THREE.Color('#95a5a6')    // Gray
};

// Edge mesh component with animated shader
const EdgeMesh = ({
  source,
  target,
  type = 'default',
  strength = 1,
  isHighlighted = false,
  onClick,
  onHover,
  onUnhover,
  useArrows = true,
  animated = true
}) => {
  const lineRef = useRef();
  const particlesRef = useRef();
  const [hovered, setHovered] = useState(false);
  
  // Calculate edge positions and direction
  const positions = useMemo(() => {
    return new Float32Array([
      source.x, source.y, source.z,
      target.x, target.y, target.z
    ]);
  }, [source, target]);
  
  // Edge color based on type
  const color = useMemo(() => {
    return EDGE_COLORS[type] || EDGE_COLORS.default;
  }, [type]);
  
  // Handle interaction events
  const handlePointerOver = (e) => {
    e.stopPropagation();
    setHovered(true);
    if (onHover) onHover();
  };
  
  const handlePointerOut = (e) => {
    e.stopPropagation();
    setHovered(false);
    if (onUnhover) onUnhover();
  };
  
  const handleClick = (e) => {
    e.stopPropagation();
    if (onClick) onClick();
  };
  
  // Animation effects
  useEffect(() => {
    if (!lineRef.current) return;
    
    const line = lineRef.current;
    const isActive = isHighlighted || hovered;
    
    // Animate line properties based on state
    gsap.to(line.material, {
      opacity: isActive ? 0.9 : 0.5,
      duration: 0.3
    });
    
    if (line.material.uniforms) {
      gsap.to(line.material.uniforms.strength, {
        value: isActive ? Math.min(1.5, strength * 1.5) : strength,
        duration: 0.3
      });
    }
    
    // Scale the line width if using basic materials
    if (!line.material.isShaderMaterial) {
      line.material.linewidth = isActive ? 2 : 1;
    }
  }, [isHighlighted, hovered, strength]);
  
  // Custom shader for animated edges
  const edgeShaderMaterial = useMemo(() => {
    if (!animated) return null;
    
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: color },
        strength: { value: strength }
      },
      vertexShader: `
        uniform float time;
        uniform float strength;
        attribute float lineDistance;
        
        varying vec3 vPosition;
        varying float vLineDistance;
        varying float vStrength;
        
        void main() {
          vPosition = position;
          vLineDistance = lineDistance;
          vStrength = strength;
          
          // Calculate position with subtle animation
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          
          // Apply a subtle wave effect
          float wave = sin(lineDistance * 10.0 + time * 2.0) * 0.02 * strength;
          mvPosition.y += wave;
          
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        uniform float strength;
        
        varying vec3 vPosition;
        varying float vLineDistance;
        varying float vStrength;
        
        void main() {
          // Animate color along the edge
          float pulse = sin(time * 3.0 + vLineDistance * 10.0) * 0.5 + 0.5;
          
          // Create a glowing effect
          vec3 glowColor = color * (0.8 + 0.2 * pulse);
          
          // Make stronger connections more visible
          float alpha = 0.3 + 0.7 * vStrength * (0.7 + 0.3 * pulse);
          
          // Add a flowing effect for data flow
          float flow = fract(vLineDistance * 0.5 - time * 0.5);
          float flowIntensity = smoothstep(0.9, 1.0, flow) * 0.6 * vStrength;
          
          // Add the flow effect to the final color
          glowColor += vec3(1.0, 1.0, 1.0) * flowIntensity;
          
          gl_FragColor = vec4(glowColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }, [color, strength, animated]);
  
  // Animation loop for shader effects
  useFrame(({ clock }) => {
    // Update time uniform for shader animations
    if (lineRef.current && lineRef.current.material.uniforms) {
      lineRef.current.material.uniforms.time.value = clock.getElapsedTime();
    }
    
    // Animate flow particles if they exist
    if (particlesRef.current && animated) {
      const time = clock.getElapsedTime();
      const geometry = particlesRef.current.geometry;
      const positionAttribute = geometry.getAttribute('position');
      
      // Direction vector for particle flow
      const direction = new THREE.Vector3(
        target.x - source.x,
        target.y - source.y,
        target.z - source.z
      ).normalize();
      
      // Update each particle position
      for (let i = 0; i < positionAttribute.count; i++) {
        const offset = i * 3;
        
        // Calculate particle progress (0 to 1)
        let progress = (time * 0.5 + i * 0.1) % 1;
        
        // Position along the line
        positionAttribute.setXYZ(
          i,
          source.x + direction.x * progress * (target.x - source.x),
          source.y + direction.y * progress * (target.y - source.y),
          source.z + direction.z * progress * (target.z - source.z)
        );
      }
      
      positionAttribute.needsUpdate = true;
    }
  });
  
  // Create flow particles for data visualization
  const createFlowParticles = () => {
    if (!animated || type !== 'dataflow') return null;
    
    // Create particles to flow along the edge
    const particleCount = Math.max(2, Math.floor(strength * 5));
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    
    // Initialize particle positions
    for (let i = 0; i < particleCount; i++) {
      const progress = i / particleCount;
      particlePositions[i * 3] = source.x + (target.x - source.x) * progress;
      particlePositions[i * 3 + 1] = source.y + (target.y - source.y) * progress;
      particlePositions[i * 3 + 2] = source.z + (target.z - source.z) * progress;
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    
    // Create material for particles
    const particleMaterial = new THREE.PointsMaterial({
      color: color,
      size: 0.3 * strength,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    
    return (
      <points ref={particlesRef} geometry={particleGeometry} material={particleMaterial} />
    );
  };
  
  // Create arrow for directional edges
  const createArrow = () => {
    if (!useArrows) return null;
    
    // Calculate midpoint position
    const midpoint = {
      x: source.x + (target.x - source.x) * 0.7,
      y: source.y + (target.y - source.y) * 0.7,
      z: source.z + (target.z - source.z) * 0.7
    };
    
    // Calculate direction for rotation
    const direction = new THREE.Vector3(
      target.x - source.x,
      target.y - source.y,
      target.z - source.z
    ).normalize();
    
    // Create arrow pointing from source to target
    return (
      <mesh position={[midpoint.x, midpoint.y, midpoint.z]}>
        <coneGeometry args={[0.2 * strength, 0.5 * strength, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} />
      </mesh>
    );
  };
  
  // Basic line to use when not using shader
  const createBasicLine = () => {
    return (
      <line ref={lineRef}>
        <bufferGeometry attach="geometry">
          <bufferAttribute
            attachObject={['attributes', 'position']}
            array={positions}
            count={positions.length / 3}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          attach="material"
          color={color}
          transparent
          opacity={0.5}
          linewidth={1}
        />
      </line>
    );
  };
  
  // Create line with custom shader for animation
  const createShaderLine = () => {
    // Create line geometry with distance attribute for animation
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Calculate line distance for shader animation
    const lineDistance = Math.sqrt(
      Math.pow(target.x - source.x, 2) +
      Math.pow(target.y - source.y, 2) +
      Math.pow(target.z - source.z, 2)
    );
    
    const lineDistances = new Float32Array([0, lineDistance]);
    geometry.setAttribute('lineDistance', new THREE.BufferAttribute(lineDistances, 1));
    
    return (
      <line ref={lineRef} geometry={geometry}>
        <primitive object={edgeShaderMaterial} attach="material" />
      </line>
    );
  };
  
  return (
    <group
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {/* Main edge line with shader or basic material */}
      {animated && edgeShaderMaterial ? createShaderLine() : createBasicLine()}
      
      {/* Optional directional arrow */}
      {createArrow()}
      
      {/* Flow particles for data visualization */}
      {createFlowParticles()}
    </group>
  );
};

export default EdgeMesh; 