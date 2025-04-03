import * as THREE from 'three';
import { initShaderBackground } from './shaders';
import { initParticleSystem } from './particles';
import { initD3Background } from './d3Background';

// Store references to UI elements and animation components
let progressFill = null;
let progressText = null;
let backgroundCleanup = null;
let d3Cleanup = null;
let animationFrameId = null;

function updateProgress(newProgress) {
    if (progressFill && progressText) {
        const clampedProgress = Math.min(100, Math.max(0, newProgress));
        progressFill.style.width = `${clampedProgress}%`;
        progressText.textContent = `${Math.round(clampedProgress)}%`;
        console.log('Loading progress updated:', clampedProgress);
    }
}

export function initLoadingScreen(root, currentProgress) {
    // Clear previous content and cleanup if necessary
    root.innerHTML = '';
    if (typeof backgroundCleanup === 'function') backgroundCleanup();
    if (typeof d3Cleanup === 'function') d3Cleanup();
    if (animationFrameId) cancelAnimationFrame(animationFrameId);

    // Create container
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    root.appendChild(container);

    // Initialize background effects
    const background = initShaderBackground(container);
    const particles = initParticleSystem(background.scene);
    const d3Bg = initD3Background(container);
    backgroundCleanup = background.cleanup;
    d3Cleanup = d3Bg.cleanup;

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

    // Assign to module-level variable
    progressFill = document.createElement('div');
    progressFill.style.width = '0%'; // Start at 0
    progressFill.style.height = '100%';
    progressFill.style.backgroundColor = '#4a9eff';
    progressFill.style.transition = 'width 0.3s ease';
    progressBar.appendChild(progressFill);

    // Loading text
    const loadingTextElement = document.createElement('div');
    loadingTextElement.style.fontSize = '24px';
    loadingTextElement.style.marginBottom = '10px';
    loadingTextElement.textContent = 'Loading Visualization...';
    loadingUI.appendChild(loadingTextElement);

    // Progress text
    // Assign to module-level variable
    progressText = document.createElement('div');
    progressText.style.fontSize = '14px';
    progressText.style.opacity = '0.7';
    progressText.textContent = '0%'; // Start at 0
    loadingUI.appendChild(progressText);

    // Start the animation loop
    function animateLoop() {
        animationFrameId = requestAnimationFrame(animateLoop);
        particles.update();
        background.renderer.render(background.scene, background.camera); // Use returned renderer/scene/camera
        d3Bg.update();
    }
    background.animate(); // Start shader animation
    animateLoop(); // Start combined loop

    // Set initial progress
    updateProgress(currentProgress);

    // Expose the updateProgress function for external updates
    return { updateProgress };
} 