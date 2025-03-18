import json
import os
import sys
from ast_generator import generate_project_asts
from vulnerability_scanner import scan_vulnerabilities
from init_db import init_db
from logger import logger

# Environment Variables
PROJECT_DIR = os.getenv("PROJECT_DIR")  # Will be set by VSCode extension
AST_OUTPUT = os.getenv("AST_OUTPUT", "/tmp/ast_output.json")
DB_PATH = os.getenv("DB_PATH", "/app/backend/vulnerabilities.db")

def save_asts_to_json(ast_map, output_file):
    """
    Save ASTs to a JSON file in a format suitable for visualization.
    """
    try:
        # Convert ASTs to a more serializable format
        ast_dict = {}
        for file, ast in ast_map.items():
            # Convert full AST to simplified structure for visualization
            simplified = {
                "filepath": file,
                "ast": ast.root_node.sexp(),
                "type": "file"
            }
            ast_dict[file] = simplified
            
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(ast_dict, f, indent=2)
        logger.info(f"ASTs saved to {output_file}")
        return True
    except Exception as e:
        logger.error(f"Error saving ASTs: {str(e)}")
        return False

def analyze_project(project_dir=None):
    """
    Analyze the project and return results.
    Can be called directly from the VSCode extension.
    """
    if project_dir:
        logger.info(f"Setting project directory to: {project_dir}")
        global PROJECT_DIR
        PROJECT_DIR = project_dir
    
    if not PROJECT_DIR:
        logger.error("No project directory specified")
        return {"error": "No project directory specified"}
    
    logger.info(f"Starting analysis on project: {PROJECT_DIR}")
    
    # Initialize database if needed
    try:
        init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}")
        return {"error": f"Database initialization failed: {str(e)}"}
    
    # Generate ASTs
    logger.info("Generating ASTs for the project")
    try:
        ast_map = generate_project_asts(PROJECT_DIR)
        logger.info(f"Generated ASTs for {len(ast_map)} files")
    except Exception as e:
        logger.error(f"AST generation failed: {str(e)}")
        return {"error": f"AST generation failed: {str(e)}"}
    
    if not ast_map:
        logger.warning("No ASTs generated")
        return {"warning": "No ASTs generated"}
    
    # Save ASTs to JSON
    if not save_asts_to_json(ast_map, AST_OUTPUT):
        return {"error": "Failed to save ASTs"}
    
    # Scan for vulnerabilities
    logger.info("Scanning for vulnerabilities")
    try:
        vulnerabilities = scan_vulnerabilities(ast_map)
        logger.info(f"Found {len(vulnerabilities)} vulnerabilities")
    except Exception as e:
        logger.error(f"Vulnerability scanning failed: {str(e)}")
        return {"error": f"Vulnerability scanning failed: {str(e)}"}
    
    # Return results
    return {
        "status": "success",
        "ast_file": AST_OUTPUT,
        "files_analyzed": len(ast_map),
        "vulnerabilities": vulnerabilities
    }

def main():
    """
    Main function when run directly.
    """
    logger.info("Starting SCode Analysis")
    
    if not PROJECT_DIR:
        logger.error("Environment variable PROJECT_DIR not set")
        sys.exit(1)
    
    results = analyze_project()
    
    if "error" in results:
        logger.error(results["error"])
        sys.exit(1)
    
    logger.info("Analysis completed successfully")
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()