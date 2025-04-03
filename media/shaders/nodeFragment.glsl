uniform float time;
varying vec3 vColor;
varying float vImportance;
varying float vSelected;
varying vec2 vUv;
varying float vProgress;
varying float vType;

void main() {
    // Calculate distance from center for circle shape
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(gl_PointCoord, center);
    
    // Discard pixels outside of circle
    if (dist > 0.5) {
        discard;
    }
    
    // Create a glowing effect
    float glow = smoothstep(0.5, 0.35, dist);
    
    // Animated pulse based on importance
    float pulse = 1.0 + 0.2 * sin(time * 3.0) * vImportance;
    
    // Edge highlighting - stronger for selected nodes
    float edgeWidth = vSelected > 0.5 ? 0.43 : 0.45;
    float edge = smoothstep(edgeWidth, 0.5, dist) * (0.5 + vSelected * 0.5);
    
    // Final color with glow
    vec3 finalColor = vColor * glow * pulse + vec3(1.0, 1.0, 1.0) * edge;
    
    // Add slight color shift over time for important nodes
    if (vImportance > 1.5 || vSelected > 0.5) {
        float hueShift = sin(time * 0.5) * 0.1;
        finalColor.r += hueShift * vColor.g;
        finalColor.g += hueShift * vColor.b;
        finalColor.b += hueShift * vColor.r;
    }
    
    // Calculate alpha based on glow and selection state
    float alpha = glow * (1.0 - dist * 0.5);
    if (vSelected > 0.5) {
        alpha = min(1.0, alpha * 1.3);
    }
    
    gl_FragColor = vec4(finalColor, alpha);
} 