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

def node_to_dict(node, function_map, expanded_asts, visited=None):
    """Convert node to dict, expanding function calls recursively with cycle prevention."""
    if visited is None:
        visited = set()
    result = {"type": node.type}
    named_children = [child for child in node.children if child.is_named]
    if named_children:
        result["children"] = []
        for child in named_children:
            child_dict = node_to_dict(child, function_map, expanded_asts, visited)
            if child.type == 'call':
                called_ast = resolve_function_call(child, function_map)
                if called_ast:
                    # Unique key for cycle detection and reuse
                    func_key = (called_ast.start_point, called_ast.end_point)
                    file_path, func_name, param_count = next(
                        k for k, v in function_map.items() if v == called_ast
                    )
                    visited_key = (file_path, func_name, param_count)
                    if func_key in expanded_asts:
                        # Reuse existing expansion
                        child_dict["called_function"] = {"ref": str(func_key)}
                    elif visited_key not in visited:
                        visited.add(visited_key)
                        expanded_ast = node_to_dict(called_ast, function_map, expanded_asts, visited)
                        expanded_asts[func_key] = expanded_ast
                        child_dict["called_function"] = expanded_ast
                else:
                    child_dict["is_library"] = True  # Mark unresolved calls
            result["children"].append(child_dict)
    
    vulnerabilities = detect_vulnerabilities(node)
    if vulnerabilities:
        result["vulnerabilities"] = vulnerabilities
    return result

def generate_project_asts(project_dir, entrypoint_file):
    """Generate expanded AST for the entrypoint using all project ASTs."""
    # Step 1: Parse all files into unlinked ASTs
    ast_map, function_map = parse_all_files(project_dir)
    
    # Step 2: Process the entrypoint AST
    main_ast = ast_map[entrypoint_file]
    expanded_asts = {}  # Cache of expanded ASTs by (start_point, end_point)
    ast_dict = node_to_dict(main_ast, function_map, expanded_asts)
    ast_map_dict = {entrypoint_file: ast_dict}
    
    # Step 3: Include all ASTs in output (unexpanded except entrypoint)
    for file_path, root_node in ast_map.items():
        if file_path != entrypoint_file:
            ast_map_dict[file_path] = {
                "type": root_node.type,
                "text": root_node.text.decode('utf-8')
            }
    
    # Step 4: Save the entire AST map
    save_ast_to_file(ast_map_dict, '/app/backend/sample_project/ast_output.json')

def save_ast_to_file(ast_map, filename):
    """Save the AST dictionary to a JSON file."""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(ast_map, f, indent=4)
    print(f"✅ ASTs saved to {filename}")
project_dir = '/app/backend/sample_project'
entrypoint_file = os.path.join(project_dir, 'main.js')
generate_project_asts(project_dir, entrypoint_file)
if __name__ == '__main__':
    project_dir = '/app/backend/test_project'
    entrypoint_file = os.path.join(project_dir, 'main.js')
    generate_project_asts(project_dir, entrypoint_file)