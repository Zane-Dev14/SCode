from flask import Flask, request, jsonify
import os
from analyzer import analyze_project
from logger import logger

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
    
    logger.info(f"Received analyze request for {project_dir}")
    
    # Run analysis
    result = analyze_project(project_dir)
    
    return jsonify(result)

@app.route('/ast', methods=['GET'])
def get_ast():
    """Get the AST for a specific file"""
    file_path = request.args.get('file')
    ast_file = request.args.get('ast_file', os.getenv('AST_OUTPUT', '/tmp/ast_output.json'))
    
    if not file_path:
        return jsonify({"error": "No file specified"}), 400
    
    if not os.path.exists(ast_file):
        return jsonify({"error": "AST file not found"}), 404
    
    # Read the AST file
    try:
        import json
        with open(ast_file, 'r') as f:
            ast_data = json.load(f)
        
        # Return the AST for the specified file
        if file_path in ast_data:
            return jsonify(ast_data[file_path])
        else:
            return jsonify({"error": f"AST for {file_path} not found"}), 404
    except Exception as e:
        logger.error(f"Error reading AST file: {str(e)}")
        return jsonify({"error": f"Error reading AST file: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)