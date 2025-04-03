import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js'; // Import tweening library
import tunnelVertexShader from '../shaders/tunnel.vert';
import tunnelFragmentShader from '../shaders/tunnel.frag';

export function initStartupAnimation(container, onComplete) {
    // --- Scene Setup ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    // Initial camera position is set by the vertex shader's progress uniform

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // --- Tunnel Geometry & Material ---
    const geometry = new THREE.CylinderGeometry(1, 1, 20, 32, 64, true); // Open-ended cylinder
    const uniforms = {
        time: { value: 0 },
        progress: { value: 0 }, // Controls camera fly-through (0 to 1)
        resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        mouse: { value: new THREE.Vector2(0.5, 0.5) }
    };
    const material = new THREE.ShaderMaterial({
        vertexShader: tunnelVertexShader,
        fragmentShader: tunnelFragmentShader,
        uniforms: uniforms,
        side: THREE.BackSide, // Render inside of cylinder
        transparent: true
    });
    const tunnel = new THREE.Mesh(geometry, material);
    scene.add(tunnel);

    // --- Animation Control ---
    let animationFrameId = null;
    let startTime = Date.now();
    const animationDuration = 3000; // 3 seconds

    // Use TWEEN for smooth progress animation
    const progressTween = new TWEEN.Tween(uniforms.progress)
        .to({ value: 1 }, animationDuration)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onComplete(() => {
            if (typeof onComplete === 'function') {
                onComplete();
            }
            cleanup(); // Clean up after animation finishes
        })
        .start();

    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        const elapsedTime = Date.now() - startTime;
        uniforms.time.value = elapsedTime * 0.001; // Update time uniform

        TWEEN.update(); // Update tweens

        renderer.render(scene, camera);
    }

    // --- Event Listeners ---
    const mouseListener = (event) => {
        uniforms.mouse.value.x = event.clientX / window.innerWidth;
        uniforms.mouse.value.y = 1.0 - (event.clientY / window.innerHeight);
    };
    window.addEventListener('mousemove', mouseListener);

    const resizeListener = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', resizeListener);

    // --- Cleanup --- 
    const cleanup = () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('mousemove', mouseListener);
        window.removeEventListener('resize', resizeListener);
        if (container && renderer.domElement) {
             try {
                 container.removeChild(renderer.domElement);
             } catch (e) { /* Ignore if already removed */ }
        }
        renderer.dispose();
        geometry.dispose();
        material.dispose();
        // Remove TWEEN?
    };

    // --- Start --- 
    animate();

    return { cleanup }; // Return cleanup function
} 