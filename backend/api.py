from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import sys
# from analyzer import analyze_project
from ast_generator import generate_project_asts

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy"})

@app.route('/analyze', methods=['POST'])
def analyze():
    """Analyze a project"""
    data = request.json
    project_dir = data.get('project_dir')
    entrypoint = data.get('entrypoint')
    
    if not project_dir:
        return jsonify({"error": "No project directory specified"}), 400
    
    # Ensure the directory exists
    if not os.path.isdir(project_dir):
        return jsonify({"error": f"Directory {project_dir} does not exist"}), 400
    
    try:
        # Find a suitable entrypoint if not provided
        if not entrypoint:
            # First try to find common entry points
            common_entrypoints = ['index.js', 'app.js', 'main.js', 'main.py', 'app.py','main.rs']
            for entry in common_entrypoints:
                potential_path = os.path.join(project_dir, entry)
                if os.path.exists(potential_path):
                    entrypoint = entry  # Use relative path instead of absolute
                    break
            
            # If still not found, find first suitable file
            if not entrypoint:
                for root, _, files in os.walk(project_dir):
                    for file in files:
                        if file.endswith(('.js', '.ts', '.jsx', '.tsx', '.py')):
                            entrypoint = os.path.relpath(os.path.join(root, file), project_dir)  # Store relative path
                            break
                    if entrypoint:
                        break
        
        if not entrypoint or not os.path.exists(os.path.join(project_dir, entrypoint)):
            possible_entrypoints = find_possible_entrypoints(project_dir)
            return jsonify({
                "status": "needs_entrypoint",
                "message": "Please select an entry point file",
                "options": possible_entrypoints
            }), 200  # Use 200 status code for this case
            
        # Generate AST
        result = generate_project_asts(project_dir, os.path.join(project_dir, entrypoint))
        
        # Save result to file
        output_dir = os.path.join(os.path.dirname(__file__), "output")
        os.makedirs(output_dir, exist_ok=True)
        
        with open(os.path.join(output_dir, "ast_data.json"), "w") as f:
            json.dump(result, f)
            
        return jsonify({
            "status": "success",
            "message": "Analysis complete",
            "data": result
        })
    except Exception as e:
        app.logger.error(f"Error during analysis: {str(e)}", exc_info=True)
        # Make sure to return a properly formatted JSON response
        return jsonify({
            "status": "error",
            "message": f"Analysis failed: {str(e)}",
            "error": str(e)
        }), 500
@app.route('/ast', methods=['GET'])
def get_ast():
    """Get the AST for the analyzed project"""
    output_file = os.path.join(os.path.dirname(__file__), "output", "extracted_ast.json")

    if not os.path.exists(output_file):
        # If not found, check for the sample file
        output_file = os.path.join(os.path.dirname(__file__), "sample_project", "extracted_ast.json")
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
    
    # Run the server
    app.run(host='0.0.0.0', port=port, debug=debug)