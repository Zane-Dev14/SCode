/**
 * Utility functions for working with shaders in Three.js
 */

import * as THREE from 'three';

// Cache for loaded shader materials
const shaderCache = new Map();

/**
 * Load a shader material with the given name
 * @param {string} name - Shader name (e.g., 'node', 'edge', 'background', 'particle')
 * @param {Object} uniforms - Additional uniforms to add
 * @returns {THREE.ShaderMaterial} The shader material
 */
export const loadShaderMaterial = (name, additionalUniforms = {}) => {
    const cacheKey = `${name}_${JSON.stringify(additionalUniforms)}`;
    
    if (shaderCache.has(cacheKey)) {
        return shaderCache.get(cacheKey).clone();
    }
    
    // Get vertex and fragment shader code from script tags
    const vertexShader = document.getElementById(`${name}-vertex-shader`).textContent;
    const fragmentShader = document.getElementById(`${name}-fragment-shader`).textContent;
    
    // Create base uniforms
    const baseUniforms = {
        time: { value: 0.0 },
        resolution: { value: new THREE.Vector2() }
    };
    
    // Merge base uniforms with additional uniforms
    const uniforms = { ...baseUniforms, ...additionalUniforms };
    
    // Create the material
    const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    
    // Cache the material
    shaderCache.set(cacheKey, material);
    
    return material;
};

/**
 * Update shared shader uniforms (time, resolution, etc.)
 * @param {number} time - Current time in seconds
 * @param {THREE.Vector2} resolution - Current resolution
 */
export const updateShaderUniforms = (time, resolution) => {
    shaderCache.forEach(material => {
        if (material.uniforms.time) {
            material.uniforms.time.value = time;
        }
        if (material.uniforms.resolution) {
            material.uniforms.resolution.value = resolution;
        }
    });
};

/**
 * Create a background plane with shader material
 * @returns {THREE.Mesh} Background plane mesh
 */
export const createShaderBackground = () => {
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = loadShaderMaterial('background');
    const mesh = new THREE.Mesh(geometry, material);
    
    // Position the plane to cover the entire view
    mesh.position.z = -1000;
    
    // Set material specific properties
    material.depthWrite = false;
    material.depthTest = false;
    
    return mesh;
};

/**
 * Create a particle system with custom shader
 * @param {Array} particles - Array of particle data objects
 * @returns {THREE.Points} Particle system
 */
export const createParticleSystem = (particles) => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particles.length * 3);
    const colors = new Float32Array(particles.length * 3);
    const sizes = new Float32Array(particles.length);
    const speeds = new Float32Array(particles.length);
    const destinations = new Float32Array(particles.length * 3);
    
    for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        const i3 = i * 3;
        
        // Position
        positions[i3] = particle.position.x;
        positions[i3 + 1] = particle.position.y;
        positions[i3 + 2] = particle.position.z;
        
        // Color
        colors[i3] = particle.color.r;
        colors[i3 + 1] = particle.color.g;
        colors[i3 + 2] = particle.color.b;
        
        // Size
        sizes[i] = particle.size || 1.0;
        
        // Speed
        speeds[i] = particle.speed || 1.0;
        
        // Destination (if any)
        if (particle.destination) {
            destinations[i3] = particle.destination.x;
            destinations[i3 + 1] = particle.destination.y;
            destinations[i3 + 2] = particle.destination.z;
        }
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('speed', new THREE.BufferAttribute(speeds, 1));
    geometry.setAttribute('destination', new THREE.BufferAttribute(destinations, 3));
    
    const material = loadShaderMaterial('particle');
    
    return new THREE.Points(geometry, material);
};

/**
 * Clear shader cache to free memory
 */
export const clearShaderCache = () => {
    shaderCache.clear();
};

export const initShader = async (canvas, shaderPath) => {
  try {
    // Create WebGL context
    const gl = canvas.getContext('webgl');
    if (!gl) {
      throw new Error('WebGL not supported');
    }

    // Load shader source
    const response = await fetch(shaderPath);
    const shaderSource = await response.text();
    
    // Split vertex and fragment shaders
    const [vertexSource, fragmentSource] = shaderSource.split('// Fragment shader');
    
    // Create shader program
    const program = createShaderProgram(gl, vertexSource, fragmentSource);
    if (!program) {
      throw new Error('Failed to create shader program');
    }
    
    // Set up buffers
    const vertices = new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
       1.0,  1.0
    ]);
    
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    
    // Get attribute and uniform locations
    const positionLocation = gl.getAttribLocation(program, 'position');
    const timeLocation = gl.getUniformLocation(program, 'time');
    const resolutionLocation = gl.getUniformLocation(program, 'resolution');
    
    // Enable attributes
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    
    // Animation loop
    let startTime = Date.now();
    const animate = () => {
      const time = (Date.now() - startTime) * 0.001;
      
      gl.useProgram(program);
      gl.uniform1f(timeLocation, time);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(animate);
    };
    
    animate();
    
    // Handle resize
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    
    window.addEventListener('resize', resize);
    resize();
    
    return program;
  } catch (error) {
    console.error('Failed to initialize shader:', error);
    throw error;
  }
};

const createShaderProgram = (gl, vertexSource, fragmentSource) => {
  // Create shaders
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  
  if (!vertexShader || !fragmentShader) {
    return null;
  }
  
  // Create program
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  
  // Check for errors
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Failed to link program:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  
  return program;
};

const createShader = (gl, type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Failed to compile shader:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  
  return shader;
}; 