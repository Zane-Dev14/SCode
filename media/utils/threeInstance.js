import * as THREE from 'three';

// Create a singleton instance
const threeInstance = THREE;

// Prevent multiple imports
Object.defineProperty(window, 'THREE', {
    get: () => threeInstance,
    set: () => threeInstance
});

export default threeInstance; 