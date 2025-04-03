uniform float time;
attribute float alpha;
varying float vAlpha;

void main() {
    vAlpha = alpha * (1.0 - mod(time * 0.5 + alpha, 1.0)); // Fade out over time, offset by alpha
    
    vec3 pos = position;
    // Add slight radial spread originating from nozzle radius
    float angle = alpha * 6.28318; // Use alpha for pseudo-random angle
    pos.xy += vec2(cos(angle), sin(angle)) * 0.05 * (1.0 - vAlpha); // Spread reduces as particle fades
    pos.z += mod(time * 0.5 + alpha * 2.0, 1.0) * -4.0; // Move particles back, offset
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    
    // Size attenuation based on distance and alpha fade
    gl_PointSize = (12.0 / -mvPosition.z) * vAlpha * 2.5; // Make particles slightly larger
    
    gl_Position = projectionMatrix * mvPosition;
} 