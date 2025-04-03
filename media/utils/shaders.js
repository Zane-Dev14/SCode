import * as THREE from 'three';
import vertexShader from '../shaders/background.vert';
import fragmentShader from '../shaders/background.frag';
// Import Postprocessing
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export function initShaderBackground(container) {
    // Create scene
    const scene = new THREE.Scene();

    // Create camera
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // --- Postprocessing --- 
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.8, // Lower strength for background bloom
        0.4, // Wider radius
        0.7  // Higher threshold (bloom brighter parts)
    );
    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // Uniforms including mouse position
    const uniforms = {
        time: { value: 0 },
        resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        mouse: { value: new THREE.Vector2(0.5, 0.5) } // Normalized mouse coords
    };

    // Create shader material
    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms
    });

    // Create plane (covers the screen in orthographic view)
    const geometry = new THREE.PlaneGeometry(2, 2);
    const plane = new THREE.Mesh(geometry, material);
    scene.add(plane);

    // Mouse move listener
    const mouseListener = (event) => {
        uniforms.mouse.value.x = event.clientX / window.innerWidth;
        uniforms.mouse.value.y = 1.0 - (event.clientY / window.innerHeight);
    };
    window.addEventListener('mousemove', mouseListener);

    // Handle resize
    const resizeListener = () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight); // Resize composer
        uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
        bloomPass.resolution.set(window.innerWidth, window.innerHeight); // Update bloom pass resolution
    };
    window.addEventListener('resize', resizeListener);

    // Animation loop
    let animationFrameId = null;
    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        uniforms.time.value += 0.01;
        composer.render(); // Use composer
    }

    // Return cleanup function
    const cleanup = () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('mousemove', mouseListener);
        window.removeEventListener('resize', resizeListener);
        if (container && renderer.domElement) {
            try { container.removeChild(renderer.domElement); } catch (e) { /* Ignore */ }
        }
        renderer.dispose();
        composer.dispose(); // Dispose composer resources
        // Dispose other scene resources if needed
    };

    return {
        scene,
        camera,
        renderer, // Still needed for particle system access
        composer, // Expose composer if needed
        animate,
        cleanup
    };
} 