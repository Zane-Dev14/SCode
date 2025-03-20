import os
import json
from tree_sitter import Parser, Language
from tree_sitter_python import language as python_language
from tree_sitter_javascript import language as js_language
from tree_sitter_java import language as java_language
from tree_sitter_cpp import language as cpp_language
from tree_sitter_c import language as c_language
from tree_sitter_go import language as go_language
from tree_sitter_ruby import language as ruby_language
from tree_sitter_c_sharp import language as csharp_language
from tree_sitter_rust import language as rust_language
from language_detector import detect_language, get_all_source_files

# Map your language names to their Tree-sitter language objects.
LANGUAGE_MAPPING = {
    'python': python_language(),
    'javascript': js_language(),
    'java': java_language(),
    'cpp': cpp_language(),
    'c': c_language(),
    'go': go_language(),
    'ruby': ruby_language(),
    'c-sharp': csharp_language(),
    'rust': rust_language()
}

def detect_vulnerabilities(node):
    vulnerabilities = []
    if node.type == 'call_expression':
        function_name = None
        for child in node.children:
            if child.type == 'identifier':
                function_name = child.text.decode('utf-8')
                break
        
        # Check if the function is a vulnerable one (e.g., eval, exec)
        if function_name in ['eval', 'exec', 'system', 'subprocess']:
            vulnerabilities.append(f"Vulnerable function used: {function_name}")

    # Add more patterns for other vulnerabilities (SQL injection, etc.) if needed
    return vulnerabilities
# --- Improved AST conversion and saving ---
def node_to_dict(node):
    """
    Recursively convert a Tree-sitter node to a dictionary containing only
    important details: type, start/end points, and only named children.
    This reduces noise by filtering out punctuation and low-level details.
    """
    result = {
        "type": node.type,

    }

    # Only include named children (skipping punctuation, etc.)
    named_children = [child for child in node.children if child.is_named]
    if named_children:
        result["children"] = [node_to_dict(child) for child in named_children]
        
    # Check for vulnerabilities in the current node and add to result
    vulnerabilities = detect_vulnerabilities(node)
    if vulnerabilities:
        result["vulnerabilities"] = vulnerabilities

    return result

def save_ast_to_file(tree, filename):
    """Save the AST as a dictionary in a JSON file."""
    ast_dict = node_to_dict(tree.root_node)
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(ast_dict, f, indent=4)
    print(f"✅ AST saved to {filename}")

def generate_ast(file_path, language):
    """Generate an AST for a given file and language."""
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        code = f.read()
    
    # Create a new Parser for the specified language.
    parser = Parser()
    parser=Parser(Language(LANGUAGE_MAPPING[language]))
    tree = parser.parse(bytes(code, "utf8"))
    
    # Save AST output to a designated file
    output_filename = os.path.join('/app/backend/sample_project', 'ast_output.json')
    save_ast_to_file(tree, output_filename)
    
    return tree

def generate_project_asts(project_dir):
    """Generate ASTs for all supported files in a project directory."""
    asts = {}
    source_files = get_all_source_files(project_dir)
    
    for file_path in source_files:
        lang = detect_language(file_path)
        try:
            ast = generate_ast(file_path, lang)
            if ast:
                asts[file_path] = ast
                print(f"Generated AST → {file_path}")
            else:
                print(f"Failed to parse → {file_path}")
        except Exception as e:
            print(f"Error generating AST for {file_path}: {e}")
    return asts
project_dir = '/app/backend/sample_project'
ast_map = generate_project_asts(project_dir)
print(f"\nGenerated ASTs for {len(ast_map)} files.")

if __name__ == '__main__':
    project_dir = '/app/backend/test_project'
    ast_map = generate_project_asts(project_dir)
    print(f"\nGenerated ASTs for {len(ast_map)} files.")
