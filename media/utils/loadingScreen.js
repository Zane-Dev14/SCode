import * as THREE from 'three';
import { initShaderBackground } from './shaders';
import { initParticleSystem } from './particles';
import { initD3Background } from './d3Background';

export function initLoadingScreen(root, progress) {
    // Create container
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    root.appendChild(container);

    // Initialize background effects
    const { scene, camera, renderer, animate } = initShaderBackground(container);
    const particles = initParticleSystem(scene);
    const d3Background = initD3Background(container);

    // Create loading UI
    const loadingUI = document.createElement('div');
    loadingUI.style.position = 'absolute';
    loadingUI.style.top = '50%';
    loadingUI.style.left = '50%';
    loadingUI.style.transform = 'translate(-50%, -50%)';
    loadingUI.style.textAlign = 'center';
    loadingUI.style.color = 'white';
    loadingUI.style.fontFamily = 'sans-serif';
    loadingUI.style.zIndex = '1';
    container.appendChild(loadingUI);

    // Progress bar
    const progressBar = document.createElement('div');
    progressBar.style.width = '300px';
    progressBar.style.height = '4px';
    progressBar.style.backgroundColor = 'rgba(255,255,255,0.1)';
    progressBar.style.borderRadius = '2px';
    progressBar.style.margin = '20px auto';
    progressBar.style.overflow = 'hidden';
    loadingUI.appendChild(progressBar);

    const progressFill = document.createElement('div');
    progressFill.style.width = '0%';
    progressFill.style.height = '100%';
    progressFill.style.backgroundColor = '#4a9eff';
    progressFill.style.transition = 'width 0.3s ease';
    progressBar.appendChild(progressFill);

    // Loading text
    const loadingText = document.createElement('div');
    loadingText.style.fontSize = '24px';
    loadingText.style.marginBottom = '10px';
    loadingText.textContent = 'Loading Visualization...';
    loadingUI.appendChild(loadingText);

    // Progress text
    const progressText = document.createElement('div');
    progressText.style.fontSize = '14px';
    progressText.style.opacity = '0.7';
    progressText.textContent = '0%';
    loadingUI.appendChild(progressText);

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        particles.update();
        renderer.render(scene, camera);
        d3Background.update();
    }
    animate();

    // Update progress
    function updateProgress(newProgress) {
        progressFill.style.width = `${newProgress}%`;
        progressText.textContent = `${Math.round(newProgress)}%`;
    }

    // Initial progress
    updateProgress(progress);

    // Return cleanup function
    return () => {
        renderer.dispose();
        d3Background.cleanup();
    };
} 