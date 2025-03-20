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

# Initialize a set to keep track of parsed files
parsed_files = set()

def detect_vulnerabilities(node):
    vulnerabilities = []
    if node.type == 'call': 
        function_name = None
        for child in node.children:
            if child.type == 'identifier':
                function_name = child.text.decode('utf-8')
                break
        if function_name in ['eval', 'exec', 'system', 'subprocess']:
            print(function_name)
            vulnerabilities.append(f"Vulnerable function used: {function_name}")
    return vulnerabilities

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

def save_ast_to_file(ast_map, filename):
    """Save the ASTs as a dictionary in a JSON file."""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(ast_map, f, indent=4)
    print(f"✅ ASTs saved to {filename}")

def parse_file(file_path, language, ast_map):
    """Parse a single file and add it to the AST map."""
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        code = f.read()
    
    # Create a new Parser for the specified language.
    parser = Parser()
    parser = Parser(Language(LANGUAGE_MAPPING[language]))
    tree = parser.parse(bytes(code, "utf8"))
    
    # Convert AST to dictionary and add to the map
    ast_dict = node_to_dict(tree.root_node)
    ast_map[file_path] = ast_dict

    # Mark the file as parsed
    parsed_files.add(file_path)

    # Check for imports and parse them as well
    find_and_parse_imports(file_path, code, ast_map)

def find_and_parse_imports(file_path, code, ast_map):
    """Find imports in the code and parse them if not already parsed."""
    # Search for import statements and handle them (this is just for Python as an example)
    # You can extend this to other languages.
    import_statements = []
    for line in code.splitlines():
        if line.startswith('import ') or line.startswith('from '):
            import_statements.append(line)

    # Parse the files mentioned in import statements
    for statement in import_statements:
        # Extract the file/module being imported (very basic extraction, you can improve this)
        if 'import' in statement:
            imported_file = statement.split()[1]
        elif 'from' in statement:
            imported_file = statement.split()[1]

        # Assuming the import refers to a filename without the extension (you may need to adjust this logic)
        imported_file_path = f"{os.path.dirname(file_path)}/{imported_file}.py"
        
        if imported_file_path not in parsed_files and os.path.exists(imported_file_path):
            print(f"Parsing imported file: {imported_file_path}")
            parse_file(imported_file_path, detect_language(imported_file_path), ast_map)

def generate_project_asts(project_dir):
    """Generate ASTs for all supported files in a project directory."""
    ast_map = {}
    source_files = get_all_source_files(project_dir)
    
    for file_path in source_files:
        if file_path not in parsed_files:
            try:
                lang = detect_language(file_path)
                parse_file(file_path, lang, ast_map)
                print(f"Generated AST → {file_path}")
            except Exception as e:
                print(f"Error generating AST for {file_path}: {e}")
        else:
            print(f"File {file_path} already parsed, skipping.")

    # Save all the parsed ASTs
    save_ast_to_file(ast_map, 'final_ast_output.json')

project_dir = '/app/backend/sample_project'
generate_project_asts(project_dir)

if __name__ == '__main__':
    project_dir = '/app/backend/test_project'
    generate_project_asts(project_dir)
