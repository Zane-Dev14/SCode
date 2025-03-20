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
from language_detector import detect_language

# Map language names to Tree-sitter language objects
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

# Initialize a set to track parsed files
parsed_files = set()

def build_file_map(project_dir):
    """
    Build a dictionary mapping module names (base filenames without extension) to their full paths.
    This helps resolve imports by searching the project directory.
    """
    file_map = {}
    for root, _, files in os.walk(project_dir):
        for file in files:
            if file.endswith(('.py', '.js', '.java', '.cpp', '.c', '.go', '.rb', '.cs', '.rs')):
                base_name = os.path.splitext(file)[0]
                file_map[base_name] = os.path.join(root, file)
    print(file_map)
    return file_map

def detect_vulnerabilities(node):
    """
    Detect potential vulnerabilities in function calls (e.g., eval, exec).
    Returns a list of vulnerability messages.
    """
    vulnerabilities = []
    if node.type == 'call':
        function_name = None
        for child in node.children:
            if child.type == 'identifier':
                function_name = child.text.decode('utf-8')
                break
        if function_name in ['eval', 'exec', 'system', 'subprocess']:
            vulnerabilities.append(f"Vulnerable function used: {function_name}")
    return vulnerabilities

def resolve_function_call(call_node, current_file, function_map, file_map):
    """
    Resolve a function call to its definition's AST node.
    Handles local calls (e.g., foo()) and imported calls (e.g., module.foo()).
    """
    function_part = call_node.child_by_field_name('function')
    if not function_part:
        return None

    if function_part.type == 'identifier':
        # Local function call, e.g., foo()
        func_name = function_part.text.decode('utf-8')
        if (current_file, func_name) in function_map:
            return function_map[(current_file, func_name)]
    elif function_part.type == 'attribute':
        # Imported function call, e.g., module.foo()
        object_part = function_part.child_by_field_name('object')
        attribute_part = function_part.child_by_field_name('attribute')
        if (object_part and object_part.type == 'identifier' and 
            attribute_part and attribute_part.type == 'identifier'):
            module_name = object_part.text.decode('utf-8')
            func_name = attribute_part.text.decode('utf-8')
            if module_name in file_map:
                imported_file_path = file_map[module_name]
                if (imported_file_path, func_name) in function_map:
                    return function_map[(imported_file_path, func_name)]
    return None

def node_to_dict(node, current_file, function_map, file_map):
    """
    Convert a Tree-sitter node to a dictionary, linking function calls to their definitions.
    Includes only named children and adds vulnerabilities if detected.
    """
    result = {"type": node.type}
    named_children = [child for child in node.children if child.is_named]
    if named_children:
        result["children"] = []
        for child in named_children:
            child_dict = node_to_dict(child, current_file, function_map, file_map)
            if child.type == 'call':
                called_function_ast = resolve_function_call(child, current_file, function_map, file_map)
                if called_function_ast:
                    child_dict["called_function"] = node_to_dict(
                        called_function_ast, current_file, function_map, file_map
                    )
            result["children"].append(child_dict)
    
    vulnerabilities = detect_vulnerabilities(node)
    if vulnerabilities:
        result["vulnerabilities"] = vulnerabilities
    return result

def save_ast_to_file(ast_map, filename):
    """Save the AST dictionary to a JSON file."""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(ast_map, f, indent=4)
    print(f"✅ ASTs saved to {filename}")

def find_and_parse_imports(file_path, tree, ast_map, function_map, file_map, language):
    """
    Find import statements using Tree-sitter queries and parse the imported files recursively.
    Currently handles Python imports; extendable to other languages.
    """
    if language == 'python':
        query = Language(LANGUAGE_MAPPING[language]).query("""
                (import_statement name: (dotted_name) @module)
            """)

        captures = query.captures(tree.root_node)
        for capture in captures:
            module_name = capture[0].text.decode('utf-8')
            # Simplified: assumes module_name is the base name of a file in file_map
            if module_name in file_map:
                imported_file_path = file_map[module_name]
                if imported_file_path not in parsed_files:
                    lang = detect_language(imported_file_path)
                    parse_file(imported_file_path, lang, ast_map, function_map, file_map)
    # Add handling for other languages here if needed
def parse_file(file_path, language, ast_map, function_map, file_map):
    """
    Parse a file, extract function definitions, and store its AST.
    Recursively parses imports.
    """
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        code = f.read()
    
    
    parser=Parser(Language(LANGUAGE_MAPPING[language]))
    tree = parser.parse(bytes(code, "utf-8"))
    
    # Extract function definitions for linking
    if language == 'python':
        query = Language(LANGUAGE_MAPPING[language]).query("""
            (function_definition name: (identifier) @function_name)
        """)
        captures = query.captures(tree.root_node)
        print(captures)  # Debug output
        # If captures is a dict, access the 'function_name' key
        if isinstance(captures, dict) and 'function_name' in captures:
            for func_node in captures['function_name']:
                func_name = func_node.text.decode('utf-8')
                function_map[(file_path, func_name)] = func_node.parent
        else:
            # Standard list of tuples behavior
            for capture in captures:
                func_node = capture[0]
                func_name = func_node.text.decode('utf-8')
                function_map[(file_path, func_name)] = func_node.parent
    ast_map[file_path] = tree.root_node
    print("dsad",ast_map[file_path].text.decode('utf-8'))
    parsed_files.add(file_path)
    find_and_parse_imports(file_path, tree, ast_map, function_map, file_map, language)

def generate_project_asts(project_dir, entrypoint_file):
    """
    Generate ASTs starting from the entrypoint file, linking function calls across files.
    """
    file_map = build_file_map(project_dir)  # Map of module names to file paths
    ast_map = {}  # Raw AST nodes
    function_map = {}  # Map of (file_path, func_name) to function definition nodes
    
    # Parse the entrypoint and its imports recursively
    lang = detect_language(entrypoint_file)
    parse_file(entrypoint_file, lang, ast_map, function_map, file_map)
    
    # Convert raw ASTs to dictionaries with linked function calls
    ast_dict_map = {}
    for file_path, root_node in ast_map.items():
        ast_dict = node_to_dict(root_node, file_path, function_map, file_map)
        ast_dict_map[file_path] = ast_dict
        print(f"Generated AST with linking → {file_path}")
    
    save_ast_to_file(ast_dict_map, '/app/backend/sample_project/ast_output.json')

project_dir = '/app/backend/sample_project'
entrypoint_file = os.path.join(project_dir, 'main.js') 
generate_project_asts(project_dir, entrypoint_file)
if __name__ == '__main__':
    project_dir = '/app/backend/test_project'
    entrypoint_file = os.path.join(project_dir, 'main.js')  # Example entrypoint
    generate_project_asts(project_dir, entrypoint_file)