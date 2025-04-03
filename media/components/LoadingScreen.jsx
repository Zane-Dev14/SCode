import React, { useRef, useEffect, useState } from 'react';
import { useFrame, Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import gsap from 'gsap';
import { createParticleSystem } from '../utils/shaderUtils';

const PARTICLE_COUNT = 500;
const CODE_SYMBOLS = ['{', '}', '(', ')', ';', '=', '+', '-', '*', '/', '<', '>', '[]', '{}', '=>', '&&', '||'];

// Animated background with shader
const AnimatedBackground = () => {
  const shaderRef = useRef();
  
  useFrame(({ clock }) => {
    if (shaderRef.current) {
      shaderRef.current.material.uniforms.time.value = clock.getElapsedTime();
    }
  });
  
  return (
    <mesh ref={shaderRef} position={[0, 0, -10]}>
      <planeGeometry args={[50, 50]} />
      <shaderMaterial
        uniforms={{
          time: { value: 0 },
          resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        }}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float time;
          uniform vec2 resolution;
          varying vec2 vUv;
          
          // Simplex noise function - simplified version for the component
          float snoise(vec2 v) {
            return sin(v.x * 10.0 + time) * cos(v.y * 10.0 - time) * 0.5 + 
                  sin(v.x * 30.0 - time * 0.5) * cos(v.y * 30.0 + time * 0.5) * 0.25;
          }
          
          void main() {
            vec2 uv = vUv;
            
            // Create animated noise pattern
            float n1 = snoise(uv * 3.0 + time * 0.1);
            float n2 = snoise(uv * 6.0 - time * 0.05);
            float noise = 0.6 * n1 + 0.4 * n2;
            
            // Create gradient background
            vec3 color1 = vec3(0.1, 0.12, 0.2); // Dark blue
            vec3 color2 = vec3(0.3, 0.15, 0.4); // Purple
            vec3 baseColor = mix(color1, color2, uv.y);
            
            // Add highlights based on noise
            float highlight = smoothstep(0.4, 0.6, noise) * 0.5;
            vec3 highlightColor = vec3(0.5, 0.3, 0.7); // Light purple
            
            // Add subtle pulse
            float pulse = sin(time) * 0.05 + 0.95;
            
            // Final color
            vec3 finalColor = (baseColor + highlightColor * highlight) * pulse;
            
            // Add vignette
            float vignette = 1.0 - smoothstep(0.4, 1.4, length(uv - 0.5) * 2.0);
            finalColor *= vignette;
            
            gl_FragColor = vec4(finalColor, 1.0);
          }
        `}
      />
    </mesh>
  );
};

// Animated progress indicator
const ProgressIndicator = ({ progress }) => {
  const ringRef = useRef();
  const textRef = useRef();
  
  useEffect(() => {
    if (ringRef.current) {
      gsap.to(ringRef.current.scale, {
        x: progress,
        y: progress,
        z: progress,
        duration: 0.5,
        ease: "power2.out"
      });
    }
  }, [progress]);
  
  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = clock.getElapsedTime() * 0.2;
    }
    if (textRef.current) {
      textRef.current.rotation.z = -clock.getElapsedTime() * 0.1;
    }
  });
  
  return (
    <group position={[0, 0, 0]}>
      {/* Outer glowing ring */}
      <mesh ref={ringRef} scale={[0, 0, 0]}>
        <ringGeometry args={[1.8, 2, 64]} />
        <meshBasicMaterial color="#8a2be2" transparent opacity={0.8} />
      </mesh>
      
      {/* Inner ring */}
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <ringGeometry args={[1.7, 1.75, 64]} />
        <meshBasicMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      
      {/* Progress percentage text */}
      <group ref={textRef}>
        <mesh position={[0, 0, 0.1]}>
          <circleGeometry args={[1.6, 32]} />
          <meshBasicMaterial color="#000" transparent opacity={0.7} />
        </mesh>
      </group>
    </group>
  );
};

// Floating code particles
const CodeParticles = () => {
  const particlesRef = useRef();
  
  useEffect(() => {
    // Create random particles
    const particles = [];
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const isSymbol = Math.random() > 0.5;
      const symbol = CODE_SYMBOLS[Math.floor(Math.random() * CODE_SYMBOLS.length)];
      
      particles.push({
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20
        ),
        color: new THREE.Color(
          0.5 + Math.random() * 0.5,
          0.3 + Math.random() * 0.3,
          0.7 + Math.random() * 0.3
        ),
        size: isSymbol ? 0.5 + Math.random() * 1.5 : 0.2 + Math.random() * 0.6,
        speed: 0.5 + Math.random() * 2,
        symbol: isSymbol ? symbol : null
      });
    }
    
    // Create particle system
    const particleSystem = createParticleSystem(particles);
    particlesRef.current = particleSystem;
    
    return () => {
      particleSystem.geometry.dispose();
      particleSystem.material.dispose();
    };
  }, []);
  
  useFrame(({ clock, scene }) => {
    if (particlesRef.current) {
      // Update time uniform for animation
      particlesRef.current.material.uniforms.time.value = clock.getElapsedTime();
      
      // Make sure particles are in the scene
      if (!scene.children.includes(particlesRef.current)) {
        scene.add(particlesRef.current);
      }
    }
  });
  
  return null; // Particles are added directly to the scene
};

// Loading message with animation
const LoadingMessage = ({ message }) => {
  const [displayMessage, setDisplayMessage] = useState(message);
  
  useEffect(() => {
    if (message !== displayMessage) {
      // Animate message change
      gsap.to('.loading-message-text', {
        opacity: 0,
        y: -20,
        duration: 0.3,
        onComplete: () => {
          setDisplayMessage(message);
          gsap.to('.loading-message-text', {
            opacity: 1,
            y: 0,
            duration: 0.3
          });
        }
      });
    }
  }, [message, displayMessage]);
  
  return (
    <div className="loading-message">
      <div className="loading-message-text">{displayMessage}</div>
    </div>
  );
};

// Main loading screen component
const LoadingScreen = ({ message = 'Initializing...', progress = 0, isVisible = true }) => {
  if (!isVisible) return null;
  
  return (
    <div className="loading-screen">
      <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
        <AnimatedBackground />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <ProgressIndicator progress={progress} />
        <CodeParticles />
        <EffectComposer>
          <Bloom 
            intensity={1.5}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            blendFunction={BlendFunction.SCREEN}
          />
          <Vignette
            offset={0.5}
            darkness={0.5}
            blendFunction={BlendFunction.NORMAL}
          />
        </EffectComposer>
      </Canvas>
      <LoadingMessage message={message} />
    </div>
  );
};

export default LoadingScreen; 