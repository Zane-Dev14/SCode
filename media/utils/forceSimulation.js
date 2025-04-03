/**
 * Utilities for D3 force simulation with Three.js integration
 */

import * as d3 from 'd3';

/**
 * Create a force simulation for a graph
 * @param {Array} nodes - Array of node objects
 * @param {Array} links - Array of link objects connecting nodes
 * @param {Object} options - Configuration options
 * @returns {d3.ForceSimulation} The D3 force simulation
 */
export const createForceSimulation = (nodes, links, options = {}) => {
    const defaults = {
        nodeStrength: -100,
        linkStrength: 0.7,
        linkDistance: 80,
        gravity: 0.05,
        decay: 0.1,
        alphaMin: 0.001,
        dimensions: 3 // 2D or 3D
    };
    
    const config = { ...defaults, ...options };
    const is3D = config.dimensions === 3;
    
    // Create a new force simulation
    const simulation = is3D 
        ? d3.forceSimulation(nodes, 3) // 3D simulation
        : d3.forceSimulation(nodes);   // 2D simulation
    
    // Configure forces
    let forces = [
        // Center force to keep the graph centered
        d3.forceCenter(0, 0),
        
        // Link force to create connections between nodes
        d3.forceLink(links)
            .id(d => d.id)
            .distance(d => config.linkDistance * (d.strength || 1))
            .strength(d => config.linkStrength * (d.strength || 1)),
        
        // Charge force for node repulsion
        d3.forceManyBody()
            .strength(d => config.nodeStrength * (d.size || 1))
            .distanceMax(500)
            .theta(0.9),
        
        // Collision force to prevent overlap
        d3.forceCollide()
            .radius(d => (d.size || 1) * 10)
            .strength(0.7)
            .iterations(2)
    ];
    
    // For 3D, add z-axis forces
    if (is3D) {
        forces.push(
            // Z-center force
            d3.forceZ(0).strength(config.gravity)
        );
    }
    
    // Apply all forces to simulation
    simulation
        .alpha(1)
        .alphaDecay(config.decay)
        .alphaMin(config.alphaMin)
        .velocityDecay(0.3)
        .force('link', forces[1])
        .force('charge', forces[2])
        .force('center', forces[0])
        .force('collision', forces[3]);
        
    if (is3D) {
        simulation.force('z', forces[4]);
    }
    
    return simulation;
};

/**
 * Run simulation for a fixed number of ticks
 * @param {d3.ForceSimulation} simulation - The D3 force simulation
 * @param {number} ticks - Number of ticks to run
 */
export const runSimulation = (simulation, ticks = 100) => {
    for (let i = 0; i < ticks; i++) {
        simulation.tick();
    }
    return simulation;
};

/**
 * Apply the results of a force simulation to Three.js objects
 * @param {Array} nodes - Array of node objects from simulation
 * @param {Array} links - Array of link objects from simulation
 * @param {Object} threeObjects - Object containing Three.js nodes and links
 * @param {boolean} animate - Whether to animate the transition
 */
export const applyForceSimulation = (nodes, links, threeObjects, animate = true) => {
    const { nodeObjects, linkObjects } = threeObjects;
    
    // Scale factor for converting D3 coordinates to Three.js
    const scale = 10;
    
    // Update node positions
    nodes.forEach((node, i) => {
        if (i < nodeObjects.length) {
            const obj = nodeObjects[i];
            
            if (animate) {
                // Use GSAP for smooth animation
                gsap.to(obj.position, {
                    x: node.x * scale,
                    y: node.y * scale,
                    z: node.z ? node.z * scale : 0,
                    duration: 1,
                    ease: "power2.out"
                });
            } else {
                // Immediate update
                obj.position.set(
                    node.x * scale,
                    node.y * scale,
                    node.z ? node.z * scale : 0
                );
            }
        }
    });
    
    // Update link positions
    links.forEach((link, i) => {
        if (i < linkObjects.length) {
            const obj = linkObjects[i];
            
            // Get source and target positions
            const sourcePos = {
                x: link.source.x * scale,
                y: link.source.y * scale,
                z: link.source.z ? link.source.z * scale : 0
            };
            
            const targetPos = {
                x: link.target.x * scale,
                y: link.target.y * scale,
                z: link.target.z ? link.target.z * scale : 0
            };
            
            // Update link geometry
            if (obj.geometry) {
                // For line geometries
                const positions = obj.geometry.attributes.position.array;
                
                positions[0] = sourcePos.x;
                positions[1] = sourcePos.y;
                positions[2] = sourcePos.z;
                positions[3] = targetPos.x;
                positions[4] = targetPos.y;
                positions[5] = targetPos.z;
                
                obj.geometry.attributes.position.needsUpdate = true;
            } else if (obj.position && obj.quaternion && obj.scale) {
                // For mesh objects (like cylinders)
                // Calculate midpoint
                const midPoint = {
                    x: (sourcePos.x + targetPos.x) / 2,
                    y: (sourcePos.y + targetPos.y) / 2,
                    z: (sourcePos.z + targetPos.z) / 2
                };
                
                // Set position to midpoint
                obj.position.set(midPoint.x, midPoint.y, midPoint.z);
                
                // Calculate direction vector
                const direction = new THREE.Vector3(
                    targetPos.x - sourcePos.x,
                    targetPos.y - sourcePos.y,
                    targetPos.z - sourcePos.z
                );
                
                // Calculate length
                const length = direction.length();
                obj.scale.set(1, length, 1);
                
                // Set rotation
                direction.normalize();
                const quaternion = new THREE.Quaternion();
                quaternion.setFromUnitVectors(
                    new THREE.Vector3(0, 1, 0),
                    direction
                );
                obj.quaternion.copy(quaternion);
            }
        }
    });
}; 