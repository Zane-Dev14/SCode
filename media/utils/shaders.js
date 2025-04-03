import * as THREE from 'three';
import vertexShader from '../shaders/background.vert';
import fragmentShader from '../shaders/background.frag';

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
        uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', resizeListener);

    // Animation loop
    let animationFrameId = null;
    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        uniforms.time.value += 0.01;
        renderer.render(scene, camera);
    }

    // Return cleanup function
    const cleanup = () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('mousemove', mouseListener);
        window.removeEventListener('resize', resizeListener);
        renderer.dispose();
        container.removeChild(renderer.domElement);
    };

    return {
        scene,
        camera,
        renderer,
        animate, // Expose animate to be started by the caller
        cleanup
    };
} 