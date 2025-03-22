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
    'rust': rust_language(),
    # 'typescript':ts_language()
}

def parse_all_files(project_dir):
    """Parse all source files into separate, unlinked ASTs and build a function map."""
    ast_map = {}  # file_path → AST root node
    function_map = {}  # (file_path, func_name, param_count) → function definition node
    for root, _, files in os.walk(project_dir):
        for file in files:
            if file.endswith(('.py', '.js', '.java', '.cpp', '.c', '.go', '.rb', '.cs', '.rs')):
                file_path = os.path.join(root, file)
                lang = detect_language(file_path)
                if lang in LANGUAGE_MAPPING:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        code = f.read()
                    parser = Parser()
                    parser=Parser(Language(LANGUAGE_MAPPING[lang]))
                    tree = parser.parse(bytes(code, "utf-8"))
                    ast_map[file_path] = tree.root_node
                    # Extract function definitions universally
                    for node in traverse(tree.root_node):
                        if node.type in ['function_definition', 'method_definition', 'function_declaration']:
                            name_node = node.child_by_field_name('name')
                            params_node = node.child_by_field_name('parameters')
                            if name_node and params_node:
                                func_name = name_node.text.decode('utf-8')
                                # Count parameters (language-agnostic)
                                param_count = sum(1 for child in params_node.children if child.type == 'identifier')
                                function_map[(file_path, func_name, param_count)] = node
    return ast_map, function_map

def traverse(node):
    """Recursively yield all nodes in an AST."""
    yield node
    for child in node.children:
        yield from traverse(child)

def detect_vulnerabilities(node):
    """Detect potential vulnerabilities in function calls."""
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

def extract_variables(node):
    """Extract variables and their values where possible."""
    variables = {}
    if node.type == 'assignment':
        left = node.child_by_field_name('left')
        right = node.child_by_field_name('right')
        if left and left.type == 'identifier' and right:
            variables[left.text.decode('utf-8')] = right.text.decode('utf-8')
    elif node.type in ['function_definition', 'method_definition', 'function_declaration']:
        params = node.child_by_field_name('parameters')
        if params:
            for child in params.children:
                if child.type == 'identifier':
                    variables[child.text.decode('utf-8')] = None  # Parameters have no value
    # print("Variables :",variables)
    return variables

def resolve_function_call(call_node, function_map):
    """Resolve a function call to its definition based on name and parameter count."""
    func_part = call_node.child_by_field_name('function')
    if not func_part or func_part.type != 'identifier':
        return None
    func_name = func_part.text.decode('utf-8')
    args = call_node.child_by_field_name('arguments')
    arg_count = 0 if not args else sum(1 for child in args.children if child.type not in ['(', ')', ','])
    # Search globally in function_map
    for (file_path, name, param_count), def_node in function_map.items():
        if name == func_name and param_count == arg_count:
            return def_node
    return None

def node_to_dict(node, function_map, expanded_asts, modules_used, visited=None):
    if visited is None:
        visited = set()
    result = {"type": node.type, "Text": node.text.decode('utf-8')}

    # Track modules correctly
    if node.type == 'import_from_statement':
        module_node = node.children[1]  # 'test' in 'from test import fd'
        if module_node.type == 'dotted_name':
            modules_used.add(module_node.text.decode('utf-8'))  # Add "test"
    elif node.type == 'import_statement':
        module_node = node.child_by_field_name('module')
        if module_node:
            modules_used.add(module_node.text.decode('utf-8'))

    # Extract variables (e.g., for assignments and parameters)
    vars = extract_variables(node)
    if vars:
        result["variables"] = vars

    # Handle function definitions
    if node.type == 'function_definition':
        name_node = node.child_by_field_name('name')
        if name_node:
            result["name"] = name_node.text.decode('utf-8')

    # Process children
    named_children = [child for child in node.children if child.is_named]
    if named_children:
        result["children"] = []
        for child in named_children:
            # Skip all children for call and assignment
            if node.type in ['call', 'assignment']:
                continue
            # Skip parameters in function definitions
            if node.type == 'function_definition' and child.type == 'parameters':
                continue
            # Recursively process other children
            child_dict = node_to_dict(child, function_map, expanded_asts, modules_used, visited)
            if child.type == 'call':
                called_ast = resolve_function_call(child, function_map)
                if called_ast:
                    # Handle function inlining (omitted for brevity)
                    pass
                else:
                    child_dict["is_library"] = True
            result["children"].append(child_dict)

    # Add vulnerabilities
    vulnerabilities = detect_vulnerabilities(node)
    if vulnerabilities:
        result["vulnerabilities"] = vulnerabilities

    return result

def generate_project_asts(project_dir, entrypoint_file):
    """Generate expanded AST for the entrypoint using all project ASTs."""
    ast_map, function_map = parse_all_files(project_dir)
    main_ast = ast_map[entrypoint_file]
    expanded_asts = {}
    modules_used = set()  # Track modules used in the entrypoint
    ast_dict = node_to_dict(main_ast, function_map, expanded_asts, modules_used)
    
    # Structure output with main AST and modules used
    ast_map_dict = {
        "main_ast": ast_dict,
        "modules_used": list(modules_used)
    }
    for file_path, root_node in ast_map.items():
        if file_path != entrypoint_file:
            ast_map_dict[file_path] = {
                "type": root_node.type,
                "text": root_node.text.decode('utf-8')
            }
    save_ast_to_file(ast_map_dict, '/app/backend/sample_project/ast_output.json')

def save_ast_to_file(ast_map, filename):
    """Save the AST dictionary to a JSON file."""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(ast_map, f, indent=4)
    print(f"✅ ASTs saved to {filename}")
project_dir = '/app/backend/sample_project'
entrypoint_file = os.path.join(project_dir, 'main.py')
generate_project_asts(project_dir, entrypoint_file)
if __name__ == '__main__':
    project_dir = '/app/backend/test_project'
    entrypoint_file = os.path.join(project_dir, 'main.js')
    generate_project_asts(project_dir, entrypoint_file)