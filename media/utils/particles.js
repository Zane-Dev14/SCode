import * as THREE from 'three';

export function initParticleSystem(scene) {
    // Create particle geometry
    const particleCount = 1000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 10;
        positions[i + 1] = (Math.random() - 0.5) * 10;
        positions[i + 2] = (Math.random() - 0.5) * 10;

        velocities[i] = (Math.random() - 0.5) * 0.02;
        velocities[i + 1] = (Math.random() - 0.5) * 0.02;
        velocities[i + 2] = (Math.random() - 0.5) * 0.02;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

    // Create particle material
    const material = new THREE.PointsMaterial({
        size: 0.05,
        color: 0x4a9eff,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
    });

    // Create particle system
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Update function
    function update() {
        const positions = particles.geometry.attributes.position.array;
        const velocities = particles.geometry.attributes.velocity.array;

        for (let i = 0; i < positions.length; i += 3) {
            positions[i] += velocities[i];
            positions[i + 1] += velocities[i + 1];
            positions[i + 2] += velocities[i + 2];

            // Wrap around boundaries
            if (positions[i] > 5) positions[i] = -5;
            if (positions[i] < -5) positions[i] = 5;
            if (positions[i + 1] > 5) positions[i + 1] = -5;
            if (positions[i + 1] < -5) positions[i + 1] = 5;
            if (positions[i + 2] > 5) positions[i + 2] = -5;
            if (positions[i + 2] < -5) positions[i + 2] = 5;
        }

        particles.geometry.attributes.position.needsUpdate = true;
    }

    return {
        update,
        particles
    };
} 