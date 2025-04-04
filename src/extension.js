const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const PythonManager = require('./pythonSetup');

let pythonManager;

async function activate(context) {
  console.log('SCode Analyzer is now active!');

  pythonManager = new PythonManager();
  await pythonManager.initialize();

  let disposable = vscode.commands.registerCommand('scode-analyzer.analyzeCode', async () => {
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('Please open a file to analyze');
        return;
      }
      // Show Webview immediately, analysis will be triggered later by main.js
      showVisualization(null, context);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to initialize analyzer: ${error.message}`);
    }
  });

  context.subscriptions.push(disposable);
}

function showVisualization(analysis, context) {
  const panel = vscode.window.createWebviewPanel(
    'scodeAnalyzer',
    'SCode Analyzer',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      enableCommandUris: true,
      retainContextWhenHidden: true,
      enableFindWidget: true,
      enableDevTools: true,
      localResourceRoots: [vscode.Uri.file(path.join(__dirname, '..', 'media'))],
    }
  );

  const mediaRoot = vscode.Uri.file(path.join(__dirname, '..', 'media'));
  const bundleUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'dist', 'bundle.js'));
  const stylesUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'styles.css'));

  const workspaceFolders = vscode.workspace.workspaceFolders;
  const projectDir = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : 'No workspace folder';

  panel.webview.html = getWebviewContent(panel.webview, bundleUri, stylesUri, projectDir);
  analyzeProject(panel).catch(error => {
    console.error('Analysis failed:', error);
  });
  panel.webview.onDidReceiveMessage(
    async (message) => {
      // console.log('Received message from webview:', message);
      switch (message.command) {
        // case 'startAnalysis':
        //   try {
        //     const analysisResult = await analyzeProject(panel);
        //     panel.webview.postMessage({
        //       type: 'fromExtension',
        //       command: 'showAnalysis',
        //       data: analysisResult,
        //     });
        //   } catch (error) {
        //     panel.webview.postMessage({
        //       type: 'fromExtension',
        //       command: 'error',
        //       error: error.message,
        //     });
        //   }
        //   break;
        // case 'getAnalysis':
        //   console.log('Sending analysis data to webview');
        //   panel.webview.postMessage({
        //     type: 'fromExtension',
        //     command: 'analysis',
        //     data: analysis,
        //   });
        //   break;
        case 'getShader':
          try {
            const shaderPath = path.join(__dirname, '..', 'media', message.path);
            // console.log('Loading shader from:', shaderPath);
            const shaderContent = fs.readFileSync(shaderPath, 'utf8');
            panel.webview.postMessage({
              command: 'shaderContent',
              path: message.path,
              content: shaderContent,
            });
          } catch (error) {
            console.error(`Error loading shader: ${error.message}`);
            // panel.webview.postMessage({
            //   command: 'shaderError',
            //   path: message.path,
            //   error: error.message,
            // });
          }
          break;
        // case 'log':
        //   console.log('Webview:', message.message);
        //   break;
        // case 'error':
        //   console.error('Webview error:', message.message);
        //   break;
      }
    },
    undefined,
    context.subscriptions
  );
}

async function analyzeProject(panel) {
  try {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      throw new Error('No active editor found');
    }
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder is open');
    }

    const rootPath = workspaceFolders[0].uri.fsPath;

    // Send initial loading state
    panel.webview.postMessage({ 
      type: 'fromExtension', 
      command: 'load' 
    });

    // Run analysis
    const result = await runAnalysis(rootPath, panel);
    
    // Send analysis data
    panel.webview.postMessage({ 
      type: 'fromExtension', 
      command: 'showAnalysis', 
      data: result 
    });
    
    return result;
  } catch (error) {
    panel.webview.postMessage({ 
      type: 'fromExtension', 
      command: 'error', 
      error: error.message 
    });
    throw error;
  }
}

async function runAnalysis(rootPath, panel) {
  try {
    // Send progress update
    panel.webview.postMessage({ 
      type: 'fromExtension', 
      command: 'updateProgress', 
      progress: 20 
    });

    // Fetch data from API
    const response = await fetch('http://localhost:5000/ast');
    const data = await response.json();

    // Map API data to visualization format
    const visualizationData = {
      modules: data.modules ? data.modules.map(module => {
        return {
          name: module.split('::').pop() || module,
          path: module
        };
      }) : [],
      
      functions: data.functions ? data.functions.map(func => {
        return {
          name: func.name,
          path: func.file,
          line: func.line,
          parameters: func.parameters || [],
          calls: func.calls || [],
          depth: func.depth,
          children: func.children ? func.children.map(child => {
            return {
              target: child.target,
              line: child.line,
              tooltip: child.tooltip
            };
          }) : []
        };
      }) : [],
      
      vulnerabilities: data.vulnerabilities ? data.vulnerabilities.map(vuln => {
        return {
          name: vuln.description.split(':')[0] || 'Vulnerability',
          path: vuln.file,
          line: vuln.line,
          severity: vuln.depth > 5 ? 'critical' : vuln.depth > 3 ? 'high' : 'medium',
          description: vuln.description
        };
      }) : [],
      
      variables: data.variables ? data.variables.map(v => {
        return {
          name: v.name,
          path: v.file,
          line: v.line,
          function: v.function,
          depth: v.depth
        };
      }) : []
    };

    // Send mapped data
    panel.webview.postMessage({ 
      type: 'fromExtension', 
      command: 'showAnalysis', 
      data: visualizationData 
    });
    
    return visualizationData;
  } catch (error) {
    console.error('Error in analysis:', error);
    throw error;
  }
}

function getWebviewContent(webview, bundleUri, stylesUri, projectDir) {
  return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src ${webview.cspSource} ws: wss:; img-src ${webview.cspSource} https: data:; script-src ${webview.cspSource} 'unsafe-eval' 'unsafe-inline' https://cdnjs.cloudflare.com blob:; style-src ${webview.cspSource} 'unsafe-inline' https://cdnjs.cloudflare.com; font-src ${webview.cspSource} https://cdnjs.cloudflare.com; worker-src blob:;">
        <title>SCode Analyzer</title>
        <link href="${stylesUri}" rel="stylesheet">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.0.0/d3.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
        <style>
            :root {
                --primary-color: #00ff9d;
                --secondary-color: #00b8ff;
                --background-color: #0a0a0a;
                --text-color: #ffffff;
                --accent-color: #ff00ff;
            }

            body { 
                margin: 0; 
                padding: 0; 
                width: 100vw; 
                height: 100vh; 
                overflow: hidden; 
                background: var(--background-color); 
                color: var(--text-color); 
                font-family: 'JetBrains Mono', monospace;
            }

            #root { 
                width: 100%; 
                height: 100%; 
                position: absolute; 
                top: 0; 
                left: 0;
                display: flex;
                flex-direction: column;
            }

            .background-canvas {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: -1;
            }

            .header {
                padding: 1rem;
                background: rgba(10, 10, 10, 0.8);
                backdrop-filter: blur(10px);
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }

            .header h1 {
                margin: 0;
                font-size: 1.5rem;
                background: linear-gradient(45deg, var(--primary-color), var(--secondary-color));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                text-shadow: 0 0 10px rgba(0, 255, 157, 0.3);
            }

            .main-content {
                flex: 1;
                display: grid;
                grid-template-columns: 250px 1fr;
                gap: 1rem;
                padding: 1rem;
            }

            .sidebar {
                background: rgba(10, 10, 10, 0.8);
                backdrop-filter: blur(10px);
                border-radius: 8px;
                padding: 1rem;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .visualization-container {
                background: rgba(10, 10, 10, 0.8);
                backdrop-filter: blur(10px);
                border-radius: 8px;
                padding: 1rem;
                border: 1px solid rgba(255, 255, 255, 0.1);
                position: relative;
                overflow: hidden;
            }

            .stats-panel {
                margin-top: 1rem;
            }

            .stat-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.5rem;
                margin-bottom: 0.5rem;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 4px;
                transition: all 0.3s ease;
            }

            .stat-item:hover {
                background: rgba(255, 255, 255, 0.1);
                transform: translateX(5px);
            }

            .view-selector {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }

            .view-button {
                padding: 0.5rem;
                background: rgba(255, 255, 255, 0.05);
                border: none;
                border-radius: 4px;
                color: var(--text-color);
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .view-button:hover {
                background: rgba(255, 255, 255, 0.1);
                transform: translateX(5px);
            }

            .view-button.active {
                background: linear-gradient(45deg, var(--primary-color), var(--secondary-color));
                color: var(--background-color);
            }

            .loading-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: var(--background-color);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            }

            .loading-content {
                text-align: center;
            }

            .loading-spinner {
                width: 50px;
                height: 50px;
                border: 3px solid rgba(255, 255, 255, 0.1);
                border-top-color: var(--primary-color);
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                to { transform: rotate(360deg); }
            }

            .mouse-trail {
                position: fixed;
                width: 20px;
                height: 20px;
                background: radial-gradient(circle, var(--primary-color) 0%, transparent 70%);
                border-radius: 50%;
                pointer-events: none;
                opacity: 0.5;
                z-index: 9999;
            }
        </style>
    </head>
    <body>
        <canvas class="background-canvas" id="background"></canvas>
        <div class="mouse-trail" id="mouse-trail"></div>
        <div id="root">
            <div class="header">
                <h1>SCode Analyzer</h1>
            </div>
            <div class="main-content">
                <div class="sidebar">
                    <div class="view-selector">
                        <button class="view-button active" data-view="ast">AST Visualization</button>
                        <button class="view-button" data-view="modules">Modules</button>
                        <button class="view-button" data-view="vulnerabilities">Vulnerabilities</button>
                    </div>
                    <div class="stats-panel">
                        <div class="stat-item">
                            <span class="stat-label">Functions</span>
                            <span class="stat-value">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Modules</span>
                            <span class="stat-value">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Vulnerabilities</span>
                            <span class="stat-value">0</span>
                        </div>
                    </div>
                </div>
                <div class="visualization-container">
                    <div id="canvas-container"></div>
                </div>
            </div>
        </div>

        <script>
            window.vscode = acquireVsCodeApi();
            window.projectDir = "${projectDir}";

            // D3 Background
            const svg = d3.select('body')
                .append('svg')
                .attr('width', '100%')
                .attr('height', '100%')
                .style('position', 'fixed')
                .style('top', 0)
                .style('left', 0)
                .style('z-index', -2);

            // Create particles
            const numParticles = 100;
            const particles = Array.from({ length: numParticles }, () => ({
                x: Math.random(),
                y: Math.random(),
                size: Math.random() * 2 + 1,
                speed: Math.random() * 0.02 + 0.01,
                direction: Math.random() * Math.PI * 2
            }));

            // Draw particles
            const particleGroup = svg.append('g');
            const particleElements = particleGroup.selectAll('circle')
                .data(particles)
                .enter()
                .append('circle')
                .attr('r', d => d.size)
                .style('fill', 'rgba(0, 255, 157, 0.1)')
                .style('stroke', 'rgba(0, 255, 157, 0.2)')
                .style('stroke-width', 0.5);

            // Animate particles
            function animateParticles() {
                particles.forEach(particle => {
                    particle.x += Math.cos(particle.direction) * particle.speed;
                    particle.y += Math.sin(particle.direction) * particle.speed;

                    // Wrap around edges
                    if (particle.x < 0) particle.x = 1;
                    if (particle.x > 1) particle.x = 0;
                    if (particle.y < 0) particle.y = 1;
                    if (particle.y > 1) particle.y = 0;
                });

                particleElements
                    .attr('cx', d => d.x * window.innerWidth)
                    .attr('cy', d => d.y * window.innerHeight);

                requestAnimationFrame(animateParticles);
            }
            animateParticles();

            // Mouse trail effect
            const mouseTrail = document.getElementById('mouse-trail');
            let mouseX = 0;
            let mouseY = 0;
            let trailX = 0;
            let trailY = 0;

            document.addEventListener('mousemove', (e) => {
                mouseX = e.clientX;
                mouseY = e.clientY;
            });

            function animate() {
                const dx = mouseX - trailX;
                const dy = mouseY - trailY;
                trailX += dx * 0.1;
                trailY += dy * 0.1;
                mouseTrail.style.left = trailX + 'px';
                mouseTrail.style.top = trailY + 'px';
                requestAnimationFrame(animate);
            }
            animate();

            // Background shader
            const canvas = document.getElementById('background');
            const gl = canvas.getContext('webgl');
            
            const vertexShader = \`
                attribute vec2 position;
                varying vec2 vUv;
                void main() {
                    vUv = position * 0.5 + 0.5;
                    gl_Position = vec4(position, 0.0, 1.0);
                }
            \`;

            const fragmentShader = \`
                precision highp float;
                uniform float time;
                uniform vec2 resolution;
                uniform vec2 mouse;
                varying vec2 vUv;

                // Simplex noise functions
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

                float fbm(vec3 p) {
                    float value = 0.0;
                    float amplitude = 0.5;
                    for (int i = 0; i < 4; i++) {
                        value += amplitude * snoise(p);
                        p *= 2.0;
                        amplitude *= 0.5;
                    }
                    return value;
                }

                void main() {
                    vec2 uv = vUv;
                    vec2 p = uv * 2.0 - 1.0;
                    p.x *= resolution.x / resolution.y;
                    
                    vec2 mouseShift = (mouse - 0.5) * 0.5;
                    p += mouseShift;

                    float timeScaled = time * 0.1;

                    float fbm1 = fbm(vec3(p * 0.5, timeScaled * 0.5));
                    fbm1 = (fbm1 + 1.0) * 0.5;

                    float fbm2 = fbm(vec3(p * 1.5 + vec2(timeScaled * 0.8, -timeScaled * 0.6), timeScaled));
                    fbm2 = (fbm2 + 1.0) * 0.5;

                    vec3 color1 = vec3(0.05, 0.05, 0.1);
                    vec3 color2 = vec3(0.1, 0.2, 0.4);
                    vec3 color3 = vec3(0.5, 0.3, 0.6);
                    vec3 color4 = vec3(0.8, 0.9, 1.0);

                    float mixFactor1 = smoothstep(0.3, 0.6, fbm1);
                    vec3 finalColor = mix(color1, color2, mixFactor1);
                    
                    float mixFactor2 = smoothstep(0.5, 0.8, fbm2);
                    finalColor = mix(finalColor, color3, mixFactor2 * 0.6);

                    float stars = smoothstep(0.85, 0.9, fbm2 * pow(fbm1, 2.0));
                    finalColor = mix(finalColor, color4, stars * 0.5);

                    float vignette = 1.0 - length(uv - 0.5) * 1.2;
                    finalColor *= smoothstep(0.0, 0.8, vignette);

                    float fadeIn = smoothstep(0.0, 1.5, time);
                    finalColor *= fadeIn;

                    gl_FragColor = vec4(finalColor, 0.1);
                }
            \`;

            function initShader() {
                const vertexShaderObj = gl.createShader(gl.VERTEX_SHADER);
                gl.shaderSource(vertexShaderObj, vertexShader);
                gl.compileShader(vertexShaderObj);

                const fragmentShaderObj = gl.createShader(gl.FRAGMENT_SHADER);
                gl.shaderSource(fragmentShaderObj, fragmentShader);
                gl.compileShader(fragmentShaderObj);

                const program = gl.createProgram();
                gl.attachShader(program, vertexShaderObj);
                gl.attachShader(program, fragmentShaderObj);
                gl.linkProgram(program);
                gl.useProgram(program);

                const positionBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                    -1, -1,
                    1, -1,
                    -1, 1,
                    1, 1
                ]), gl.STATIC_DRAW);

                const positionLocation = gl.getAttribLocation(program, 'position');
                gl.enableVertexAttribArray(positionLocation);
                gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

                const timeLocation = gl.getUniformLocation(program, 'time');
                const resolutionLocation = gl.getUniformLocation(program, 'resolution');
                const mouseLocation = gl.getUniformLocation(program, 'mouse');

                function render(time) {
                    canvas.width = window.innerWidth;
                    canvas.height = window.innerHeight;
                    gl.viewport(0, 0, canvas.width, canvas.height);
                    
                    gl.uniform1f(timeLocation, time * 0.001);
                    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
                    gl.uniform2f(mouseLocation, mouseX / canvas.width, mouseY / canvas.height);
                    
                    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                    requestAnimationFrame(render);
                }
                requestAnimationFrame(render);
            }

            initShader();
        </script>
        <script src="${bundleUri}"></script>
    </body>
    </html>`;
}

function deactivate() {
  if (pythonManager) {
    pythonManager.cleanup();
  }
}

module.exports = {
  activate,
  deactivate,
};