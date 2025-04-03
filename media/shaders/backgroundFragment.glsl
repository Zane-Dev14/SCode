varying vec2 vUv;
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;

// Include the fbm function
#include "/media/shaders/fbm.glsl"

void main() {
    // Create a flowing noise effect using FBM
    float n1 = fbm(vec3(vUv * 3.0, uTime * 0.1));
    float n2 = fbm(vec3(vUv * 6.0, uTime * 0.2 + 10.0));
    float n3 = fbm(vec3(vUv * 9.0, uTime * 0.3 + 30.0));
    
    // Combined noise with different scales
    float combined = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
    
    // Create a grid effect
    vec2 grid = abs(fract(vUv * 10.0 - 0.5) - 0.5) / fwidth(vUv * 10.0);
    float gridLine = min(grid.x, grid.y);
    float gridEffect = 1.0 - min(gridLine, 1.0) * 0.15;
    
    // Vignette effect
    vec2 uv = vUv - 0.5;
    float vignette = 1.0 - dot(uv, uv) * 0.7;
    
    // Default colors if uniforms are not set
    vec3 colorA = uColorA;
    vec3 colorB = uColorB;
    vec3 colorC = uColorC;
    
    // Fallback colors if uniforms are not provided
    if (length(colorA) < 0.1) colorA = vec3(0.1, 0.12, 0.2); // Dark blue
    if (length(colorB) < 0.1) colorB = vec3(0.3, 0.15, 0.4); // Purple
    if (length(colorC) < 0.1) colorC = vec3(0.5, 0.3, 0.7);  // Light purple
    
    // Color mixing based on noise
    vec3 color = mix(
        mix(colorA, colorB, combined),
        colorC,
        smoothstep(0.4, 0.6, n3)
    );
    
    // Pulse effect
    float pulse = sin(uTime) * 0.5 + 0.5;
    color += pulse * 0.05;
    
    // Apply grid and vignette
    color *= gridEffect;
    color *= vignette;
    
    // Small dots pattern in the background
    float dots = smoothstep(0.3, 0.7, fbm(vec3(vUv * 50.0, uTime * 0.05)));
    color += dots * 0.03;
    
    gl_FragColor = vec4(color, 1.0);
} 