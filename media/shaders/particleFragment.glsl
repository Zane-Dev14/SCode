precision highp float;

uniform vec3 color;
uniform float time;

varying float vLife;
varying float vSize;

void main() {
    // Calculate distance from center for circular particles
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    
    // Create a smooth circular shape
    float alpha = smoothstep(0.5, 0.2, dist);
    
    // Add sparkle effect
    float sparkle = sin(time * 5.0 + vLife * 10.0) * 0.5 + 0.5;
    alpha *= 0.5 + sparkle * 0.5;
    
    // Fade out based on life
    alpha *= 1.0 - vLife;
    
    gl_FragColor = vec4(color, alpha);
} 