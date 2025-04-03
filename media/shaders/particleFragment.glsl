uniform float time;
varying vec3 vColor;
varying float vProgress;

void main() {
    // Calculate distance from center for circular particles
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(gl_PointCoord, center);
    
    // Create a smooth circular shape
    float circle = smoothstep(0.5, 0.4, dist);
    
    // Add a glowing edge
    float edge = smoothstep(0.4, 0.5, dist) * 0.5;
    
    // Animate the particles based on progress and time
    float alpha = circle;
    if (vProgress > 0.0) {
        // Fade out as particles reach destination
        alpha *= sin(vProgress * 3.14); // Peaks at progress = 0.5
    }
    
    // Add some sparkle effect
    float sparkle = pow(sin(time * 10.0 + gl_PointCoord.x * 30.0 + gl_PointCoord.y * 20.0) * 0.5 + 0.5, 5.0) * 0.5;
    
    // Combine everything
    vec3 finalColor = vColor * circle + vec3(1.0) * edge + vec3(1.0, 1.0, 1.0) * sparkle;
    
    gl_FragColor = vec4(finalColor, alpha);
} 