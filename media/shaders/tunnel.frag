uniform float time;
uniform vec2 resolution;
uniform vec2 mouse;
varying vec2 vUv;
varying float vDepth;

// Simplex noise (same as in background.frag)
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m; m = m * m;
  vec4 px = vec4(dot(x0,p0), dot(x1,p1), dot(x2,p2), dot(x3,p3));
  return 42.0 * dot(m, px);
}

void main() {
    vec2 uv = vUv;
    float mouseDist = length(uv - mouse);
    
    // Base pattern based on UVs and time
    float pattern = sin(uv.y * 20.0 + time * 2.0) * cos(uv.x * 10.0 + time);
    pattern = smoothstep(0.4, 0.6, abs(pattern));
    
    // Noise for texture
    float noise = snoise(vec3(uv * 5.0, time * 0.3 + mouseDist * 0.5));
    noise = (noise + 1.0) * 0.5;
    
    // Combine pattern and noise
    float combined = pattern * noise * 0.8 + 0.2;

    // Color palette
    vec3 color1 = vec3(0.05, 0.1, 0.2);
    vec3 color2 = vec3(0.2, 0.4, 0.7);
    vec3 color3 = vec3(0.7, 0.8, 1.0);
    
    // Mix colors based on the combined pattern
    vec3 finalColor = mix(color1, color2, smoothstep(0.2, 0.5, combined));
    finalColor = mix(finalColor, color3, smoothstep(0.7, 0.9, combined));

    // Add glow effect based on UVs
    float glow = smoothstep(0.5, 0.1, abs(uv.x - 0.5));
    finalColor += finalColor * glow * 0.5;

    // Fade based on depth and add screen fade
    finalColor *= vDepth;
    
    gl_FragColor = vec4(finalColor, vDepth); // Use vDepth for alpha for fade out
} 