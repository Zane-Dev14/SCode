import * as THREE from 'three';
import { initShaderBackground } from './shaders';
import { initParticleSystem } from './particles';
import { initD3Background } from './d3Background';

export function initEntrypointSelector(root, analysisData, onSelect) {
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

    // Create UI container
    const uiContainer = document.createElement('div');
    uiContainer.style.position = 'absolute';
    uiContainer.style.top = '50%';
    uiContainer.style.left = '50%';
    uiContainer.style.transform = 'translate(-50%, -50%)';
    uiContainer.style.width = '80%';
    uiContainer.style.maxWidth = '800px';
    uiContainer.style.backgroundColor = 'rgba(30, 30, 30, 0.9)';
    uiContainer.style.borderRadius = '8px';
    uiContainer.style.padding = '20px';
    uiContainer.style.color = 'white';
    uiContainer.style.fontFamily = 'sans-serif';
    uiContainer.style.zIndex = '1';
    container.appendChild(uiContainer);

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Select Entry Point';
    title.style.margin = '0 0 20px 0';
    title.style.fontSize = '24px';
    uiContainer.appendChild(title);

    // File list
    const fileList = document.createElement('div');
    fileList.style.maxHeight = '400px';
    fileList.style.overflowY = 'auto';
    fileList.style.marginBottom = '20px';
    uiContainer.appendChild(fileList);

    // Add files to list
    analysisData.files.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.style.padding = '10px';
        fileItem.style.margin = '5px 0';
        fileItem.style.backgroundColor = 'rgba(255,255,255,0.1)';
        fileItem.style.borderRadius = '4px';
        fileItem.style.cursor = 'pointer';
        fileItem.style.transition = 'background-color 0.2s';
        fileItem.textContent = file.path;

        fileItem.addEventListener('mouseover', () => {
            fileItem.style.backgroundColor = 'rgba(255,255,255,0.2)';
        });

        fileItem.addEventListener('mouseout', () => {
            fileItem.style.backgroundColor = 'rgba(255,255,255,0.1)';
        });

        fileItem.addEventListener('click', () => {
            onSelect(file);
        });

        fileList.appendChild(fileItem);
    });

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        particles.update();
        renderer.render(scene, camera);
        d3Background.update();
    }
    animate();

    // Return cleanup function
    return () => {
        renderer.dispose();
        d3Background.cleanup();
    };
} 