# Custom HTTP Implementation to Replace node-fetch

If you're encountering `u is not a function` or `c is not a function` errors with the SCode Analyzer extension, you can replace the `node-fetch` implementation with Node.js's built-in HTTP module.

## Steps to Implement

1. Open `src/extension.js` in your editor
2. Remove the node-fetch dependency and add this implementation instead:

```javascript
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const http = require('http');
const pythonManager = require('./pythonSetup');

// Custom fetch implementation using Node's http module
function simpleFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        try {
            const urlObj = new URL(url);
            const reqOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: options.headers || {}
            };

            if (options.timeout) {
                reqOptions.timeout = options.timeout;
            }

            // For debugging
            console.log(`Making ${reqOptions.method} request to ${url}`);
            
            const req = http.request(reqOptions, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const response = {
                            ok: res.statusCode >= 200 && res.statusCode < 300,
                            status: res.statusCode,
                            statusText: res.statusMessage,
                            headers: res.headers,
                            text: () => Promise.resolve(data),
                            json: () => {
                                try {
                                    return Promise.resolve(JSON.parse(data));
                                } catch (e) {
                                    console.error('JSON parse error:', e, 'Raw data:', data);
                                    return Promise.reject(new Error(`Invalid JSON: ${e.message}`));
                                }
                            }
                        };
                        resolve(response);
                    } catch (error) {
                        console.error('Error in response processing:', error);
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                console.error('Request error:', error.message);
                reject(error);
            });
            
            req.on('timeout', () => {
                console.error('Request timeout');
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (options.body) {
                const body = typeof options.body === 'string' 
                    ? options.body 
                    : JSON.stringify(options.body);
                    
                // Ensure Content-Length is set correctly
                reqOptions.headers['Content-Length'] = Buffer.byteLength(body);
                // Set content type if not already set
                if (!reqOptions.headers['Content-Type'] && typeof options.body !== 'string') {
                    reqOptions.headers['Content-Type'] = 'application/json';
                }
                req.write(body);
            }
            
            req.end();
        } catch (error) {
            console.error('Error in fetch setup:', error);
            reject(error);
        }
    });
}

// Use our simple fetch implementation
const fetch = simpleFetch;
```

3. Make sure to also update the package.json to remove the node-fetch dependency:

```json
"dependencies": {
  "d3": "^7.8.5",
  "gsap": "^3.12.2",
  "react": "^17.0.2",
  "react-dom": "^17.0.2",
  "three": "^0.152.2"
}
```

4. Build the extension:

```bash
npm run build
```

5. Reload VS Code:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
   - Type "Developer: Reload Window" and select it

This implementation provides a compatible API with the fetch standard, but uses Node.js's built-in HTTP library instead of the external node-fetch package. It should resolve any compatibility issues related to the fetch implementation. 