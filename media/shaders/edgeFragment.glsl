precision highp float;

uniform vec3 color;
uniform float time;
uniform float selectedEdge;

varying float vProgress;
varying float vThickness;
varying float vSelected;

void main() {
    // Create a glowing effect
    float glow = sin(vProgress * 20.0 - time * 2.0) * 0.5 + 0.5;
    
    // Calculate edge color with selection highlight
    vec3 edgeColor = mix(color, vec3(1.0), vSelected * 0.5);
    
    // Add thickness-based alpha
    float alpha = vThickness * (0.5 + glow * 0.5);
    
    // Add selection glow
    alpha += vSelected * 0.3;
    
    gl_FragColor = vec4(edgeColor, alpha);
} 