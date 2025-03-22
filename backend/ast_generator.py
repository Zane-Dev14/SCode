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
}

def parse_all_files(project_dir):
    """Parse all source files into ASTs and build a function map."""
    ast_map = {}  # file_path → AST root node
    function_map = {}  # (file_path, func_name, param_count) → function definition node -> Example{('/app/backend/sample_project/new.py', 'idk', 3): <Node type=function_definition, start_point=(1, 0), end_point=(4, 10)>, ('/app/backend/sample_project/test.py', 'fd', 0): <Node type=function_definition, start_point=(1, 0), end_point=(3, 17)>}
    for root, _, files in os.walk(project_dir):
        for file in files:
            if file.endswith(('.py', '.js', '.java', '.cpp', '.c', '.go', '.rb', '.cs', '.rs')):
                file_path = os.path.join(root, file)
                lang = detect_language(file_path)
                if lang in LANGUAGE_MAPPING:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        code = f.read()
                    # Fix: Properly set up parser with language
                    parser = Parser(Language(LANGUAGE_MAPPING[lang]))
                    tree = parser.parse(bytes(code, "utf-8"))
                    ast_map[file_path] = tree.root_node
                    # Extract function definitions universally
                    for node in traverse(tree.root_node):
                        # Support various function node types across languages
                        func_types = ['function_definition', 'method_definition', 'function_declaration', 'function_item']
                        if node.type in func_types:
                            name_node = node.child_by_field_name('name')
                            params_node = node.child_by_field_name('parameters')
                            if name_node and params_node:
                                func_name = name_node.text.decode('utf-8')
                                # Count parameters generically
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

def extract_imports(node, modules_used):
    """Extract imported modules from the AST node."""
    if node.type in ['import_statement', 'import_from_statement']:
        for child in node.children:
            if child.type == 'dotted_name':
                modules_used.add(child.text.decode('utf-8'))
                break
    for child in node.children:
        extract_imports(child, modules_used)

def extract_variables(node):
    """Extract variables and their values across languages."""
    variables = {}
    # Handle assignments (e.g., Python 'assignment', JavaScript 'variable_declarator')
    assignment_types = ['assignment', 'variable_declarator', 'assignment_expression']
    if node.type in assignment_types:
        left = node.child_by_field_name('left') or node.child_by_field_name('name')
        right = node.child_by_field_name('right') or node.child_by_field_name('value')
        if left and left.type == 'identifier' and right:
            variables[left.text.decode('utf-8')] = right.text.decode('utf-8')
    # Handle function parameters
    func_types = ['function_definition', 'method_definition', 'function_declaration', 'function_item']
    if node.type in func_types:
        params = node.child_by_field_name('parameters')
        if params:
            for child in params.children:
                if child.type == 'identifier':
                    variables[child.text.decode('utf-8')] = None  # Parameters have no initial value
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
    """Convert node to dict, expanding function calls recursively with cycle prevention."""
    if visited is None:
        visited = set()
    if node.type == 'comment':
        return None
    result = {"type": node.type, "Text": node.text.decode("utf-8")}
    
    # Extract variables
    vars = extract_variables(node)
    if vars:
        result["variables"] = vars
    
    leaf_types = [
        'identifier', 'string', 'integer', 'float', 'boolean', 'true', 'false', 'null', 'number', 'character',
        'dotted_name', 'argument_list', 'parameters'
    ]
    structural_nodes = ['call', 'assignment', 'function_definition']
    
    if node.type not in leaf_types:
        named_children = [child for child in node.children if child.is_named]
        if named_children:
            if node.type == 'expression_statement' and len(named_children) == 1:
                # Unwrap expression_statement
                return node_to_dict(named_children[0], function_map, expanded_asts, modules_used, visited)
            elif node.type in structural_nodes:
                if node.type == 'call' and resolve_function_call(node, function_map):
                    called_ast = resolve_function_call(node, function_map)
                    if called_ast:
                        func_key = (called_ast.start_point, called_ast.end_point)
                        file_path, func_name, param_count = next(
                            k for k, v in function_map.items() if v == called_ast
                        )
                        ref_key = f"{file_path}:{func_name}:{param_count}"
                        visited_key = (file_path, func_name, param_count)
                        if func_key in expanded_asts:
                            result["called_function"] = {"ref": ref_key}
                        elif visited_key not in visited:
                            visited.add(visited_key)
                            expanded_ast = node_to_dict(called_ast, function_map, expanded_asts, modules_used, visited)
                            if expanded_ast["type"] == "function_definition":
                                expanded_ast["id"] = ref_key  # Tag function definition
                            expanded_asts[func_key] = expanded_ast
                            result["called_function"] = expanded_ast
                        else:
                            result["called_function"] = {"ref": ref_key}
                elif node.type == 'function_definition':
                    result["children"] = []
                    block_node = next((c for c in named_children if c.type == 'block'), None)
                    if block_node:
                        for block_child in block_node.children:
                            if block_child.is_named and block_child.type != 'comment':
                                child_dict = node_to_dict(block_child, function_map, expanded_asts, modules_used, visited)
                                if child_dict and child_dict["type"] == "expression_statement" and len(child_dict.get("children", [])) == 1:
                                    result["children"].append(child_dict["children"][0])
                                elif child_dict:
                                    result["children"].append(child_dict)
                # Assignment and simple calls have no children
            else:
                result["children"] = []
                for child in named_children:
                    child_dict = node_to_dict(child, function_map, expanded_asts, modules_used, visited)
                    if child_dict:
                        result["children"].append(child_dict)
    
    vulnerabilities = detect_vulnerabilities(node)
    if vulnerabilities:
        result["vulnerabilities"] = vulnerabilities
    if node.type == 'call' and not resolve_function_call(node, function_map) and not result.get("vulnerabilities"):
        result["is_library"] = True
    
    # Add visual metadata for D3.js
    if "vulnerabilities" in result:
        result["color"] = "red"
    elif "is_library" in result:
        result["color"] = "blue"
    elif "variables" in result:
        result["color"] = "green"
    
    return result
def generate_project_asts(project_dir, entrypoint_file):
    """Generate expanded AST for the entrypoint using all project ASTs."""
    ast_map, function_map = parse_all_files(project_dir)
    main_ast = ast_map[entrypoint_file]
    expanded_asts = {}
    modules_used = set()
    # Collect imports from all files
    for root_node in ast_map.values():
        extract_imports(root_node, modules_used)
    ast_dict = node_to_dict(main_ast, function_map, expanded_asts, modules_used)
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