uniform vec3 trailColor;
varying float vAlpha;

void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    float coreGlow = smoothstep(0.2, 0.0, dist);
    float outerGlow = smoothstep(0.5, 0.1, dist);
    
    vec3 color = trailColor * outerGlow + vec3(1.0) * coreGlow * 0.5;
    
    gl_FragColor = vec4(color, vAlpha * (outerGlow + coreGlow));
} 