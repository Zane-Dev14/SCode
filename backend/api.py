from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import sys
import threading
import time
# from analyzer import analyze_project
from ast_generator import generate_project_asts
from language_detector import find_entrypoint

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

def print_server_started():
    """Print a message after a short delay to indicate the server is ready"""
    time.sleep(1)  # Wait for the server to start
    print("Server started")  # This message is needed by the Node.js code to detect server startup

@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy"})

@app.route('/analyze', methods=['POST'])
def analyze():
    """Analyze a project"""
    data = request.json
    project_dir = data.get('project_dir')
    
    # Log incoming data
    print(f"Received project_dir: {project_dir}")
    
    # Validate project_dir
    if not project_dir:
        print("No project directory specified")
        return jsonify({"error": "No project directory specified"}), 400
    
    # Convert to absolute path and log
    abs_project_dir = os.path.abspath(project_dir)
    print(f"Absolute path: {abs_project_dir}")
    
    # Check if directory exists
    if not os.path.isdir(abs_project_dir):
        print(f"Directory does not exist: {abs_project_dir}")
        return jsonify({"error": f"Directory {abs_project_dir} does not exist"}), 400
    
    # Check directory contents
    try:
        files_in_dir = os.listdir(abs_project_dir)
        print(f"Files in directory: {files_in_dir}")
        if not files_in_dir:
            print("Directory is empty")
            return jsonify({"error": f"Directory {abs_project_dir} is empty"}), 400
    except PermissionError as e:
        print(f"Permission denied accessing directory: {str(e)}")
        return jsonify({"error": f"Permission denied: {str(e)}"}), 403
    except Exception as e:
        print(f"Error accessing directory: {str(e)}")
        return jsonify({"error": f"Error accessing directory: {str(e)}"}), 500
    
    try:
        # Find the entrypoint automatically
        print("Searching for entrypoint...")
        entrypoint = find_entrypoint(abs_project_dir)
        if not entrypoint:
            print("No suitable entrypoint found")
            return jsonify({
                "status": "error",
                "message": "No suitable entrypoint found in the project",
            }), 400
        
        full_entrypoint_path = os.path.join(abs_project_dir, entrypoint)
        print(f"Selected entrypoint: {entrypoint}")
        
        # Generate AST
        print(f"Generating AST for {abs_project_dir} with entrypoint {entrypoint}")
        result = generate_project_asts(abs_project_dir, full_entrypoint_path)
        
        # Save result to file
        output_dir = os.path.join(os.path.dirname(__file__), "sample_project")
        output_file2 = os.path.join(os.path.dirname(__file__), "sample_project", "extracted.json")

        os.makedirs(output_dir, exist_ok=True)
        output_file = os.path.join(output_dir, "ast_output.json")
        with open(output_file, "w") as f:
            json.dump(result, f)
        print(f"AST saved to {output_file}")
        with open(output_file2, "r") as f:
            extracted_data = json.load(f)
        return jsonify({
            "status": "success",
            "message": "Analysis complete",
            "data": extracted_data
        })
    except Exception as e:
        error_msg = f"Error during analysis: {str(e)}"
        print(error_msg)
        app.logger.error(error_msg, exc_info=True)
        return jsonify({
            "status": "error",
            "message": error_msg,
            "error": str(e)
        }), 500
            

@app.route('/ast', methods=['GET'])
def get_ast():
    """Get the AST for the analyzed project"""
    output_file = os.path.join(os.path.dirname(__file__), "sample_project", "extracted.json")

    if not os.path.exists(output_file):
        return jsonify({"error": "AST data not found"}), 404
    
    # Read the AST file
    try:
        with open(output_file, 'r') as f:
            ast_data = json.load(f)
        
        return jsonify(ast_data)
    except Exception as e:
        app.logger.error(f"Error reading AST file: {str(e)}", exc_info=True)
        return jsonify({"error": f"Error reading AST file: {str(e)}"}), 500

@app.route('/files', methods=['GET'])
def get_files():
    """Get potential entry point files"""
    project_dir = request.args.get('project_dir')
    
    if not project_dir:
        return jsonify({"error": "No project directory specified"}), 400
    
    try:
        files = find_possible_entrypoints(project_dir)
        return jsonify({"files": files})
    except Exception as e:
        app.logger.error(f"Error getting files: {str(e)}", exc_info=True)
        return jsonify({"error": f"Error getting files: {str(e)}"}), 500

def find_possible_entrypoints(project_dir):
    """Find possible entry point files in the project"""
    result = []
    
    for root, _, files in os.walk(project_dir):
        # Skip node_modules, venv, etc.
        if any(skip in root for skip in ['node_modules', '.venv', 'venv', '__pycache__', 'dist']):
            continue
            
        for file in files:
            if file.endswith(('.js', '.ts', '.jsx', '.tsx', '.py','.rs')):
                file_path = os.path.join(root, file)
                relative_path = os.path.relpath(file_path, project_dir)
                
                # Try to determine if this is likely an entry point
                is_entry = False
                if file in ['index.js', 'app.js', 'main.js', 'main.py', 'app.py','main.rs']:
                    is_entry = True
                
                # Read a bit of the file to look for main function or similar
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read(1000)  # Read first 1000 chars
                        if 'main(' in content or 'function main' in content or '__main__' in content:
                            is_entry = True
                except:
                    pass
                    
                result.append({
                    "path": relative_path,
                    "name": file,
                    "isLikelyEntry": is_entry
                })
    
    # Sort with likely entry points first
    return sorted(result, key=lambda x: (0 if x["isLikelyEntry"] else 1, x["path"]))

if __name__ == '__main__':
    # Get port from environment or use default
    port = int(os.environ.get('PORT', 5000))
    
    # Enable debug mode in development
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    # Log startup info
    print(f"Starting Flask server on port {port}")
    print(f"Debug mode: {debug}")
    
    # Start a thread to print the server started message
    threading.Thread(target=print_server_started).start()
    
    # Run the server
    app.run(host='0.0.0.0', port=port, debug=True)