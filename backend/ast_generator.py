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
    """Detect potential vulnerabilities in function calls across languages."""
    vulnerabilities = []
    # Expanded list of vulnerable function patterns across languages
    vulnerable_functions = {
        'python': ['eval', 'exec', 'os.system', 'subprocess'],
        'javascript': ['eval', 'Function', 'setTimeout', 'setInterval', 'document.write'],
        'java': ['Runtime.exec', 'ProcessBuilder', 'System.load'],
        'c': ['system', 'exec', 'popen', 'gets', 'strcpy', 'strcat'],
        'cpp': ['system', 'exec', 'popen', 'gets', 'strcpy', 'strcat'],
        'go': ['exec.Command', 'syscall.Exec', 'os.StartProcess'],
        'ruby': ['eval', 'system', 'exec', 'send', 'const_get'],
        'c-sharp': ['Process.Start', 'Activator.CreateInstance', 'Assembly.Load'],
        'rust': ['std::process::Command', 'std::ptr::write_volatile'],
    }
    
    # Universal function call detection across languages
    call_types = ['call', 'call_expression', 'method_invocation', 'method_call']
    if node.type in call_types:
        function_name = None
        # Handle different ways functions are identified across languages
        for child in node.children:
            if child.type in ['identifier', 'dotted_name', 'member_expression', 'field_access', 'field_expression']:
                function_name = child.text.decode('utf-8')
                break
        
        # Check all language vulnerabilities (since we may not know the exact language)
        if function_name:
            for lang_vulns in vulnerable_functions.values():
                if any(vuln in function_name for vuln in lang_vulns):
                    vulnerabilities.append(f"Vulnerable function used: {function_name}")
                    break
    
    return vulnerabilities

def extract_imports(node, modules_used):
    """Extract imported modules from the AST node across all supported languages."""
    # Import statement types across languages
    import_types = [
        # Python
        'import_statement', 'import_from_statement',
        # JavaScript
        'import_declaration', 'import_specifier',
        # Java
        'import_declaration',
        # C/C++
        'preproc_include',
        # Go
        'import_spec', 'import_declaration',
        # Ruby
        'require', 'require_relative',
        # C#
        'using_directive',
        # Rust
        'use_declaration'
    ]
    
    # Module name node types across languages
    module_name_types = [
        'dotted_name', 'identifier', 'namespace_name', 'qualified_identifier',
        'string_literal', 'string', 'raw_string_literal'
    ]
    
    if node.type in import_types:
        for child in node.children:
            if child.type in module_name_types:
                # Strip quotes if present (for C/C++ includes and some others)
                module_text = child.text.decode('utf-8').strip('"\'<>')
                modules_used.add(module_text)
                break
    
    # Recursive search
    for child in node.children:
        extract_imports(child, modules_used)

def extract_variables(node):
    """Extract variables and their values across all supported languages."""
    variables = {}
    
    # Comprehensive assignment types across languages
    assignment_types = [
        # Python
        'assignment', 
        # JavaScript
        'variable_declarator', 'assignment_expression', 'variable_declaration',
        # Java
        'variable_declarator', 'assignment', 'local_variable_declaration',
        # C/C++
        'declaration', 'init_declarator', 'assignment_expression',
        # Go
        'short_var_declaration', 'var_declaration', 'var_spec', 'assignment_statement',
        # Ruby
        'assignment', 'local_variable_assignment',
        # C#
        'variable_declaration', 'assignment_expression',
        # Rust
        'let_declaration', 'assignment_expression'
    ]
    
    # Handle variable assignments
    if node.type in assignment_types:
        # Handle different field names across languages
        left = (node.child_by_field_name('left') or 
                node.child_by_field_name('name') or 
                node.child_by_field_name('declarator') or 
                node.child_by_field_name('pattern'))
        
        right = (node.child_by_field_name('right') or 
                 node.child_by_field_name('value') or 
                 node.child_by_field_name('initializer') or 
                 node.child_by_field_name('expression'))
        
        # Handle the case where left/right might be nested
        if left:
            # Extract identifier from potentially nested structure
            identifier = left
            # Navigate through potential wrappers to find the actual identifier
            while identifier and identifier.type not in ['identifier', 'field_identifier']:
                for child in identifier.children:
                    if child.type in ['identifier', 'field_identifier']:
                        identifier = child
                        break
                else:
                    break  # No identifier found in children
            
            if identifier and identifier.type in ['identifier', 'field_identifier']:
                var_name = identifier.text.decode('utf-8')
                var_value = right.text.decode('utf-8') if right else None
                variables[var_name] = var_value
    
    # Comprehensive function definition types across languages
    func_types = [
        # Python
        'function_definition', 
        # JavaScript
        'function_declaration', 'method_definition', 'arrow_function',
        # Java
        'method_declaration', 'constructor_declaration',
        # C/C++
        'function_definition', 'function_declarator',
        # Go
        'function_declaration', 'method_declaration',
        # Ruby
        'method', 'singleton_method',
        # C#
        'method_declaration', 'constructor_declaration',
        # Rust
        'function_item', 'function_signature_item'
    ]
    
    # Handle function parameters
    if node.type in func_types:
        # Parameter container node types
        param_container_fields = ['parameters', 'parameter_list', 'formal_parameters']
        
        # Try to find parameters using various field names
        for field_name in param_container_fields:
            params = node.child_by_field_name(field_name)
            if params:
                # Parameter types across languages
                param_types = ['identifier', 'parameter', 'formal_parameter', 'simple_parameter']
                
                for child in params.children:
                    if child.type in param_types:
                        # Extract parameter name from potentially nested structure
                        param_id = child
                        # For complex parameter declarations (like in typed languages)
                        while param_id and param_id.type not in ['identifier', 'variable_name']:
                            name_node = param_id.child_by_field_name('name')
                            if name_node:
                                param_id = name_node
                                break
                            
                            # Search through children
                            for subchild in param_id.children:
                                if subchild.type in ['identifier', 'variable_name']:
                                    param_id = subchild
                                    break
                            else:
                                break
                        
                        if param_id and param_id.type in ['identifier', 'variable_name']:
                            var_name = param_id.text.decode('utf-8')
                            variables[var_name] = None  # Parameters have no initial value
                break
    
    return variables

def resolve_function_call(call_node, function_map):
    """Resolve a function call to its definition across all supported languages."""
    # Function part field names across languages
    function_field_names = ['function', 'callee', 'name', 'method', 'identifier']
    
    # Try different field names for function part
    func_part = None
    for field_name in function_field_names:
        func_part = call_node.child_by_field_name(field_name)
        if func_part:
            break
    
    # If still not found, try to find it by traversing children
    if not func_part:
        for child in call_node.children:
            if child.type in ['identifier', 'member_expression', 'field_access', 'field_expression']:
                func_part = child
                break
    
    if not func_part or func_part.type not in ['identifier', 'member_expression', 'field_access', 'field_expression']:
        return None
    
    # Extract function name
    func_name = func_part.text.decode('utf-8')
    # For member expressions (obj.method), extract just the method name
    if '.' in func_name:
        func_name = func_name.split('.')[-1]
    
    # Arguments field names across languages
    arg_field_names = ['arguments', 'argument_list', 'args']
    
    # Try different field names for arguments
    args = None
    for field_name in arg_field_names:
        args = call_node.child_by_field_name(field_name)
        if args:
            break
    
    # Count arguments, handling different argument separators across languages
    arg_count = 0
    if args:
        separator_types = ['(', ')', ',', 'comment']
        arg_count = sum(1 for child in args.children if child.type not in separator_types)
    
    # Search globally in function_map
    for (file_path, name, param_count), def_node in function_map.items():
        if name == func_name and param_count == arg_count:
            return def_node
    
    return None

def node_to_dict(node, function_map, expanded_asts, modules_used, visited=None, file_path=None):
    """Convert node to dict, expanding function calls recursively with cycle prevention."""
    if visited is None:
        visited = set()
    
    # Skip comment nodes across all languages
    comment_types = ['comment', 'line_comment', 'block_comment', 'documentation_comment']
    if node.type in comment_types:
        return None
    
    result = {"type": node.type, "Text": node.text.decode("utf-8")}
    
    # Add source info for key nodes across languages
    key_node_types = [
        # Function definitions
        'function_definition', 'method_definition', 'function_declaration', 'method_declaration',
        'function_item', 'constructor_declaration', 'arrow_function',
        
        # Function calls
        'call', 'call_expression', 'method_invocation', 'method_call',
        
        # Assignments
        'assignment', 'variable_declarator', 'assignment_expression', 'short_var_declaration',
        'var_declaration', 'local_variable_declaration', 'declaration', 'let_declaration'
    ]
    
    if node.start_point and node.type in key_node_types:
        result["source"] = {"file": file_path or "unknown", "line": node.start_point[0] + 1}
    
    # Extract variables
    vars = extract_variables(node)
    if vars:
        result["variables"] = vars
    
    # Leaf node types across languages (nodes that don't need further processing)
    leaf_types = [
        # Common
        'identifier', 'string', 'integer', 'float', 'boolean', 'true', 'false', 'null', 'number', 'character',
        'dotted_name', 'argument_list', 'parameters',
        
        # Language specific
        'string_literal', 'numeric_literal', 'boolean_literal', 'nil', 'nil_literal',
        'raw_string_literal', 'int_literal', 'float_literal', 'char_literal',
        'parameter_list', 'formal_parameters', 'arguments', 'formal_parameter'
    ]
    
    # Structural node types that need special handling across languages
    structural_nodes = [
        # Function calls
        'call', 'call_expression', 'method_invocation', 'method_call',
        
        # Assignments
        'assignment', 'variable_declarator', 'assignment_expression', 'short_var_declaration',
        'var_declaration', 'local_variable_declaration', 'declaration', 'let_declaration',
        
        # Function definitions
        'function_definition', 'method_definition', 'function_declaration', 'method_declaration',
        'function_item', 'constructor_declaration', 'arrow_function'
    ]
    
    # Expression statement wrappers across languages
    expression_statements = [
        'expression_statement', 'stmt_expr', 'expression_stmt',
        'simple_statement', 'expr_stmt'
    ]
    
    if node.type not in leaf_types:
        named_children = [child for child in node.children if child.is_named]
        if named_children:
            # Unwrap expression statements
            if node.type in expression_statements and len(named_children) == 1:
                return node_to_dict(named_children[0], function_map, expanded_asts, modules_used, visited, file_path)
            elif node.type in structural_nodes:
                # Handle function calls across languages
                call_types = ['call', 'call_expression', 'method_invocation', 'method_call']
                if node.type in call_types and resolve_function_call(node, function_map):
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
                            expanded_ast = node_to_dict(called_ast, function_map, expanded_asts, modules_used, visited, file_path)
                            if expanded_ast["type"] in [
                                'function_definition', 'method_definition', 'function_declaration', 
                                'method_declaration', 'function_item', 'constructor_declaration', 'arrow_function'
                            ]:
                                expanded_ast["id"] = ref_key
                            expanded_asts[func_key] = expanded_ast
                            result["called_function"] = expanded_ast
                        else:
                            result["called_function"] = {"ref": ref_key}
                # Handle function definitions across languages
                elif node.type in [
                    'function_definition', 'method_definition', 'function_declaration', 
                    'method_declaration', 'function_item', 'constructor_declaration', 'arrow_function'
                ]:
                    result["children"] = []
                    # Function body field names across languages
                    body_field_names = ['body', 'block', 'value', 'statement']
                    
                    # Try different field names for function body
                    block_node = None
                    for field_name in body_field_names:
                        block_node = node.child_by_field_name(field_name)
                        if block_node:
                            break
                    
                    # If still not found, try to find it by looking for a block type node
                    if not block_node:
                        for child in named_children:
                            if child.type in ['block', 'compound_statement', 'block_statement']:
                                block_node = child
                                break
                    
                    if block_node:
                        for block_child in block_node.children:
                            if block_child.is_named and block_child.type not in comment_types:
                                child_dict = node_to_dict(block_child, function_map, expanded_asts, modules_used, visited, file_path)
                                if child_dict:
                                    if child_dict["type"] in expression_statements and "children" in child_dict and len(child_dict["children"]) == 1:
                                        result["children"].append(child_dict["children"][0])
                                    else:
                                        result["children"].append(child_dict)
            else:
                result["children"] = []
                for child in named_children:
                    child_dict = node_to_dict(child, function_map, expanded_asts, modules_used, visited, file_path)
                    if child_dict:
                        result["children"].append(child_dict)
    
    # Detect vulnerabilities
    vulnerabilities = detect_vulnerabilities(node)
    if vulnerabilities:
        result["vulnerabilities"] = vulnerabilities
    
    # Mark library calls
    call_types = ['call', 'call_expression', 'method_invocation', 'method_call']
    if node.type in call_types and not resolve_function_call(node, function_map) and not result.get("vulnerabilities"):
        result["is_library"] = True
    
    return result
def generate_project_asts(project_dir, entrypoint_file, output_file=None):
    """Generate expanded AST for the entrypoint using all project ASTs."""
    ast_map, function_map = parse_all_files(project_dir)
    
    # Check if entrypoint exists
    if entrypoint_file not in ast_map:
        raise ValueError(f"Entrypoint file '{entrypoint_file}' not found in project directory '{project_dir}'")
    
    main_ast = ast_map[entrypoint_file]
    expanded_asts = {}
    modules_used = set()
    
    # Collect imports from all files
    for root_node in ast_map.values():
        extract_imports(root_node, modules_used)
    
    # Pass file_path for the entrypoint
    ast_dict = node_to_dict(main_ast, function_map, expanded_asts, modules_used, file_path=entrypoint_file)
    
    # Build the result dictionary
    ast_map_dict = {
        "main_ast": ast_dict,
        "modules_used": sorted(list(modules_used))  # Ensure consistent order
    }
    
    # Add other files' AST info (excluding entrypoint)
    for file_path, root_node in ast_map.items():
        if file_path != entrypoint_file:
            ast_map_dict[file_path] = {
                "type": root_node.type,
                "text": root_node.text.decode('utf-8')
            }
    
    # Use provided output file or default to a project-specific path
    output_path = "/app/backend/sample_project/ast_output.json"
    save_ast_to_file(ast_map_dict, output_path)
    
    return ast_map_dict  # Optional: return for further use

def save_ast_to_file(ast_map, filename):
    """Save the AST dictionary to a JSON file."""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(ast_map, f, indent=4)
    print(f"✅ ASTs saved to {filename}")

project_dir = '/app/backend/Clearch/src'
entrypoint_file = os.path.join(project_dir, 'main.rs')
generate_project_asts(project_dir, entrypoint_file)