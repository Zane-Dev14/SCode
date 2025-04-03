import * as THREE from 'three';
import { Tween, Easing, update as updateTween, removeAll as removeAllTweens } from '@tweenjs/tween.js';
import * as d3 from 'd3';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';
import engineTrailVertexShader from '../shaders/engineTrail.vert';
import engineTrailFragmentShader from '../shaders/engineTrail.frag';

export function initStartupAnimation(container, onComplete) {
    // --- Core Setup ---
    let animationFrameId = null;
    const clock = new THREE.Clock();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 1.5, 16); // Start closer

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // --- D3 Overlay Setup ---
    const svg = d3.select(container).append('svg')
        .style('position', 'absolute')
        .style('top', 0).style('left', 0)
        .style('width', '100%').style('height', '100%')
        .style('pointer-events', 'none').style('z-index', '10');

    // --- Lighting ---
    scene.add(new THREE.AmbientLight(0x505070, 0.6)); // Slightly brighter ambient
    const dirLight = new THREE.DirectionalLight(0xffeedd, 0.7); // Main light
    dirLight.position.set(5, 10, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024; dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 1; dirLight.shadow.camera.far = 50;
    scene.add(dirLight);

    // --- Postprocessing --- 
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.6, // Reduced bloom strength further
        0.7, // Wider radius
        0.6  // Threshold
    );
    const afterimagePass = new AfterimagePass(0.93); // Slightly more trail

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composer.addPass(afterimagePass);

    // --- Mouse Interaction State ---
    const mouse = new THREE.Vector2(0, 0);
    const targetMouse = new THREE.Vector2(0, 0);

    // --- Scene Objects ---
    // Starfield (Reduced Count)
    const starsGroup = new THREE.Group();
    const starColors = [0xffffff, 0xbac8ff, 0xffe8cc];
    for (let layer = 0; layer < 2; layer++) { // Only 2 layers
        const starCount = 2000 * (layer + 1); // Reduced count
        const size = 0.15 + layer * 0.1;
        const spread = 1200 + layer * 600;
        const starVertices = [];
        for (let i = 0; i < starCount; i++) {
            const x = THREE.MathUtils.randFloatSpread(spread);
            const y = THREE.MathUtils.randFloatSpread(spread);
            const z = THREE.MathUtils.randFloatSpread(spread);
            if (Math.sqrt(x*x + y*y + z*z) > 180) starVertices.push(x, y, z);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        const mat = new THREE.PointsMaterial({ 
            color: starColors[layer % starColors.length], 
            size: size, sizeAttenuation: true, transparent: true, 
            opacity: 0.5 + layer * 0.1, // Dimmer opacity
            blending: THREE.AdditiveBlending 
        });
        const stars = new THREE.Points(geo, mat);
        starsGroup.add(stars);
    }
    scene.add(starsGroup);

    // Origin Planet (Dimmer, Textured)
    const planetGroup = new THREE.Group();
    const planetGeometry = new THREE.SphereGeometry(3.0, 32, 32); 
    const planetMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x353c48, // Very Dark base color
        roughness: 0.95, // Max Roughness
        map: createPlanetTexture('#353c48', 40, 15), // Very dark texture base
        transparent: true 
    });
    const planet = new THREE.Mesh(planetGeometry, planetMaterial);
    planet.castShadow = true; planet.receiveShadow = true;
    planetGroup.add(planet);
    // Atmosphere (Less Intense)
    const atmosphereMaterial = new THREE.ShaderMaterial({
        uniforms: { 
            "c":   { value: 1.5 }, // Extremely weak edge
            "p":   { value: 7.0 }, // Very sharp falloff
            glowColor: { value: new THREE.Color(0x203050) } // Barely visible glow color
        },
        vertexShader: `varying vec3 vNormal; void main() { vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float c; uniform float p; uniform vec3 glowColor; varying vec3 vNormal; void main() { float intensity = pow(max(0.0, c - dot(vNormal, vec3(0.0, 0.0, 1.0))), p); gl_FragColor = vec4(glowColor, intensity * 0.25); }`, // Minimal intensity multiplier
        side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
    });
    const atmosphere = new THREE.Mesh(planetGeometry, atmosphereMaterial);
    atmosphere.scale.set(1.015, 1.015, 1.015); // Almost same size as planet
    planetGroup.add(atmosphere);
    planetGroup.position.set(-18, -1, -15); // Adjusted position
    scene.add(planetGroup);

    // Destination Nebula (Simplified)
    const nebulaGroup = new THREE.Group();
    const nebulaParticles = 3000; // Fewer particles
    const nebulaPositions = new Float32Array(nebulaParticles * 3);
    const nebulaColors = new Float32Array(nebulaParticles * 3);
    const nebulaSizes = new Float32Array(nebulaParticles);
    const colorInside = new THREE.Color(0xaa66cc);
    const colorOutside = new THREE.Color(0x3366aa);
    for (let i = 0; i < nebulaParticles; i++) {
        const r = Math.random() * 8; // Wider, less dense spread
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        nebulaPositions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        nebulaPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        nebulaPositions[i * 3 + 2] = r * Math.cos(phi);
        const color = new THREE.Color().lerpColors(colorInside, colorOutside, Math.sqrt(r / 8.0));
        nebulaColors[i*3] = color.r; nebulaColors[i*3+1] = color.g; nebulaColors[i*3+2] = color.b;
        nebulaSizes[i] = Math.random() * 2.5 + 0.5;
    }
    const nebulaGeometry = new THREE.BufferGeometry();
    nebulaGeometry.setAttribute('position', new THREE.BufferAttribute(nebulaPositions, 3));
    nebulaGeometry.setAttribute('color', new THREE.BufferAttribute(nebulaColors, 3));
    nebulaGeometry.setAttribute('size', new THREE.BufferAttribute(nebulaSizes, 1));
    const nebulaMaterial = new THREE.PointsMaterial({size: 1.0, vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.4, depthWrite: false, sizeAttenuation: true});
    nebulaMaterial.onBeforeCompile = shader => {
        shader.vertexShader = 'attribute float size;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = size * size;');
    };
    const nebula = new THREE.Points(nebulaGeometry, nebulaMaterial);
    nebulaGroup.position.set(25, 2, -45); // Position further away
    scene.add(nebulaGroup);

    // Spaceship (Using the simpler Capsule/Cone version from before the last major change)
    const shipGroup = new THREE.Group();
    shipGroup.castShadow = true;
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb8c0cc, metalness: 0.7, roughness: 0.3 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffae42 }); // Orange glow
    // Hull (Capsule)
    const hullGeo = new THREE.CapsuleGeometry(0.12, 0.6, 4, 8);
    const hull = new THREE.Mesh(hullGeo, bodyMat);
    hull.rotation.x = Math.PI / 2;
    shipGroup.add(hull);
    // Engine Nozzle (Cone)
    const nozzleGeo = new THREE.ConeGeometry(0.08, 0.12, 8);
    const nozzle = new THREE.Mesh(nozzleGeo, glowMat);
    nozzle.position.z = -0.35;
    nozzle.rotation.x = Math.PI / 2;
    shipGroup.add(nozzle);
    // Engine Trail
    const trailGeo = new THREE.BufferGeometry();
    const trailCount = 150; // Reduced trail particles
    const trailPos = new Float32Array(trailCount * 3);
    const trailAlpha = new Float32Array(trailCount);
    for(let i=0; i<trailCount; ++i) {
        trailPos[i*3+0] = (Math.random() - 0.5) * 0.05; // Slight initial spread
        trailPos[i*3+1] = (Math.random() - 0.5) * 0.05;
        trailPos[i*3+2] = Math.random() * 1.5;
        trailAlpha[i] = Math.random();
    }
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    trailGeo.setAttribute('alpha', new THREE.BufferAttribute(trailAlpha, 1));
    const trailUniforms = { time: { value: 0.0 }, trailColor: { value: glowMat.color } };
    const trailMat = new THREE.ShaderMaterial({
        uniforms: trailUniforms, vertexShader: engineTrailVertexShader, fragmentShader: engineTrailFragmentShader,
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
    });
    const engineTrail = new THREE.Points(trailGeo, trailMat);
    engineTrail.position.z = -0.4; // Behind nozzle
    shipGroup.add(engineTrail);
    // Position Ship
    shipGroup.position.copy(camera.position).add(new THREE.Vector3(0, -0.1, -3.0)); 
    shipGroup.lookAt(nebulaGroup.position);
    shipGroup.scale.set(3.2, 3.2, 3.2); // Double the previous size (2x larger overall now)
    scene.add(shipGroup);

    // --- D3 Elements ---
    const statusText = svg.append('text')
        .attr('x', '50%').attr('y', '88%') // Position slightly higher
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(220, 230, 255, 0.9)') // Brighter fill
        .attr('font-size', '18px') // Larger font size
        .attr('font-weight', 'bold') // Bold font
        .style('text-shadow', '0 0 5px rgba(150, 180, 255, 0.7)') // Subtle glow
        .attr('font-family', 'monospace').attr('opacity', 0)
        .text('LOADING VISUALIZATION...');

    // --- Animation Control ---
    const destinationPos = nebulaGroup.position.clone(); // Target deep space
    const animationDuration = 11000; // Longer duration: 11 seconds

    // 1. Ship accelerates away
    const shipTargetPos = destinationPos.clone().add(new THREE.Vector3(0, 0, 10)); // Aim slightly past nebula center
    const shipMoveTween = new Tween(shipGroup.position)
        .to(shipTargetPos, animationDuration * 0.80)
        .easing(Easing.Quadratic.InOut); // Use imported Easing object

    // 2. Camera stays back, pans slightly, zooms subtly
    const cameraLookAtTarget = new THREE.Vector3().copy(shipGroup.position); // Start looking at ship
    const cameraFinalPos = camera.position.clone().add(new THREE.Vector3(1, -0.5, -2)); // Move camera only slightly
    const cameraMoveTween = new Tween(camera.position)
        .to(cameraFinalPos, animationDuration * 0.95)
        .easing(Easing.Quadratic.InOut); // Use imported Easing object
        
    const cameraLookTween = new Tween(cameraLookAtTarget)
        .to(destinationPos, animationDuration * 0.85)
        .easing(Easing.Quadratic.InOut) // Use imported Easing object
        .onUpdate(() => {
            camera.lookAt(cameraLookAtTarget);
            // Make ship point towards its moving target
            shipGroup.lookAt(shipTargetPos); // Points towards final destination
        });

    // 3. D3 Text Fade Timing
    const d3FadeInDelay = 1500;
    const d3FadeOutDelay = animationDuration - 2500; 
    const d3FadeDuration = 1500;
    statusText.transition().delay(d3FadeInDelay).duration(d3FadeDuration)
        .attr('opacity', 0.9) // Fade in to slightly higher opacity
        .transition().delay(d3FadeOutDelay - d3FadeInDelay - d3FadeDuration).duration(d3FadeDuration)
        .attr('opacity', 0);

    // 4. Transition Fade (Smoother, longer)
    const fadeObject = { bloom: bloomPass.strength, afterimage: afterimagePass.uniforms["damp"].value }; // Remove containerOpacity
    const fadeTween = new Tween(fadeObject)
        .to({ bloom: 0.0, afterimage: 0.98 }, d3FadeDuration + 500) // Fade bloom/afterimage slightly less abruptly 
        .delay(d3FadeOutDelay) 
        .easing(Easing.Quadratic.Out)
        .onUpdate(() => {
            bloomPass.strength = fadeObject.bloom;
            afterimagePass.uniforms["damp"].value = fadeObject.afterimage;
        })
        .onComplete(() => {
            if (typeof onComplete === 'function') onComplete();
        });

    // 5. Planet Fade Out (Early)
    const planetFade = { value: 1.0 };
    const planetFadeTween = new Tween(planetFade)
        .to({ value: 0.0 }, animationDuration * 0.25)
        .easing(Easing.Quadratic.InOut) // Use imported Easing object
        .onUpdate(() => {
            planetMaterial.opacity = planetFade.value;
            const scale = mix(1.0, 0.9, 1.0 - planetFade.value); // Less scaling
            planetGroup.scale.set(scale, scale, scale);
        }).start(); 
    const atmosphereFadeTween = new Tween(atmosphereMaterial.uniforms.c)
        .to({ value: 15.0 }, animationDuration * 0.25) // Fade out faster by increasing coefficient more
        .easing(Easing.Quadratic.InOut).start(); // Use imported Easing object

    // Start Animations
    shipMoveTween.start();
    cameraMoveTween.start();
    cameraLookTween.start(); 
    fadeTween.start();

    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        const time = clock.getElapsedTime();

        // Smooth mouse interpolation
        mouse.lerp(targetMouse, 0.05);

        // Apply Parallax Effect (Subtle)
        const parallaxFactor = 0.3;
        starsGroup.position.x = -mouse.x * parallaxFactor * 2;
        starsGroup.position.y = -mouse.y * parallaxFactor * 2;
        nebulaGroup.position.x = 25 - mouse.x * parallaxFactor * 1.0;
        nebulaGroup.position.y = 2 - mouse.y * parallaxFactor * 1.0;
        planetGroup.position.x = -18 - mouse.x * parallaxFactor * 0.3; 
        planetGroup.position.y = -1 - mouse.y * parallaxFactor * 0.3;
        
        // Rotations
        planetGroup.rotation.y += delta * 0.02;
        nebulaGroup.rotation.y += delta * 0.04;
        starsGroup.rotation.y += delta * 0.0015;

        // Engine trail time
        trailUniforms.time.value = time;

        updateTween(); // Use imported update function
        composer.render(); 
    }

    // --- Event Listeners ---
    const mouseListener = (event) => {
        targetMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        targetMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', mouseListener);
    
    const resizeListener = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight); 
        bloomPass.resolution.set(window.innerWidth, window.innerHeight);
        svg.attr('width', window.innerWidth).attr('height', window.innerHeight);
        statusText.attr('x', window.innerWidth / 2).attr('y', window.innerHeight * 0.90);
    };
    window.addEventListener('resize', resizeListener);

    // --- Cleanup --- 
    const cleanup = () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('mousemove', mouseListener);
        window.removeEventListener('resize', resizeListener);
        if (container && renderer.domElement) {
             try { container.removeChild(renderer.domElement); } catch (e) { /* Ignore */ }
        }
        svg.remove();
        renderer.dispose();
        composer.dispose();
        // Dispose Geometries & Materials
        planetGeometry.dispose(); planetMaterial.dispose(); atmosphereMaterial.dispose();
        nebulaGeometry.dispose(); nebulaMaterial.dispose();
        hullGeo.dispose(); nozzleGeo.dispose(); bodyMat.dispose(); glowMat.dispose();
        trailGeo.dispose(); trailMat.dispose();
        starsGroup.children.forEach(s => { s.geometry.dispose(); s.material.dispose(); });
        removeAllTweens(); // Use imported removeAll function
    };

    // --- Start --- 
    animate();

    return { cleanup };
}

// Helper mix function
function mix(a, b, t) { return a + (b - a) * t; }

// Updated Planet Texture Helper
function createPlanetTexture(baseColor = '#778899', baseGray = 100, grayRange = 50) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    const context = canvas.getContext('2d');
    context.fillStyle = baseColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 4000; i++) { // Reduced noise count
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const radius = Math.random() * 1.2;
        const gray = Math.floor(Math.random() * grayRange + (baseGray - grayRange/2)); 
        context.fillStyle = `rgba(${gray-5}, ${gray}, ${gray+5}, ${Math.random() * 0.2})`; // Dimmer noise
        context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
} 