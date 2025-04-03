uniform vec3 color;
uniform float time;
varying vec3 vPosition;
varying float vStrength;

void main() {
    // Animate color along the edge
    float pulse = sin(time * 3.0 + vPosition.x * 10.0) * 0.5 + 0.5;
    
    // Create a glowing effect
    vec3 glowColor = color * (0.8 + 0.2 * pulse);
    
    // Make stronger connections more visible
    float alpha = 0.3 + 0.7 * vStrength * (0.8 + 0.2 * pulse);
    
    // Add a flowing effect for data flow
    float flow = fract(vPosition.x * 0.1 - time * 0.5);
    float flowIntensity = smoothstep(0.9, 1.0, flow) * 0.6 * vStrength;
    
    // Add the flow effect to the final color
    glowColor += vec3(1.0, 1.0, 1.0) * flowIntensity;
    
    gl_FragColor = vec4(glowColor, alpha);
} 