from flask import Flask, request, jsonify
import os
# from analyzer import analyze_project
from ast_generator import generate_project_asts
app = Flask(__name__)

@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy"})

@app.route('/analyze', methods=['POST'])
def analyze():
    """Analyze a project"""
    data = request.json
    project_dir = data.get('project_dir')
    
    if not project_dir:
        return jsonify({"error": "No project directory specified"}), 400
    
    # Ensure the directory exists
    if not os.path.isdir(project_dir):
        return jsonify({"error": f"Directory {project_dir} does not exist"}), 400
    
    
    # Run analysis
    # result = analyze_project(project_dir)
    
    return jsonify("")

@app.route('/ast', methods=['GET'])
def get_ast():
    """Get the AST for a specific file"""
    ast_file = "/app/backend/sample_project/ast_output.json"

    if not os.path.exists(ast_file):
        return jsonify({"error": "AST file not found"}), 404
    
    # Read the AST file
    try:
        import json
        with open(ast_file, 'r') as f:
            ast_data = json.load(f)
        
        # Return the AST for the specified file
        return jsonify(ast_data)
    except Exception as e:
        return jsonify({"error": f"Error reading AST file: {str(e)}"}), 500

if __name__ == '__main__':
    project_dir = '/app/backend/sample_project'
    entrypoint_file = os.path.join(project_dir, 'main.py')
    print(entrypoint_file)
    generate_project_asts(project_dir, entrypoint_file)
    app.run(host='0.0.0.0', port=5000)