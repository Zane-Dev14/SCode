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
    ast_map = {}
    function_map = {}
    for root, _, files in os.walk(project_dir):
        for file in files:
            if file.endswith(('.py', '.js', '.java', '.cpp', '.c', '.go', '.rb', '.cs', '.rs')):
                file_path = os.path.join(root, file)
                lang = detect_language(file_path)
                if lang in LANGUAGE_MAPPING:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        code = f.read()
                    # print(Language(LANGUAGE_MAPPING[lang]),lang)
                    parser = Parser(Language(LANGUAGE_MAPPING[lang]))
                    tree = parser.parse(bytes(code, "utf-8"))
                    ast_map[file_path] = tree.root_node
                    for node in traverse(tree.root_node):
                        func_types = [
                            'function_definition', 'method_definition', 'function_declaration', 'function_item',
                            'method_declaration', 'constructor_declaration', 'arrow_function'
                        ]
                        if node.type in func_types:
                            name_node = node.child_by_field_name('name')
                            params_node = node.child_by_field_name('parameters')
                            if name_node:
                                func_name = name_node.text.decode('utf-8')
                                qualified_name = func_name
                                # Check for namespace (Rust impl, C++ class, etc.)
                                parent = node.parent
                                while parent:
                                    if parent.type == 'impl_item':
                                        type_node = parent.child_by_field_name('type')
                                        if type_node:
                                            qualified_name = f"{type_node.text.decode('utf-8')}::{func_name}"
                                            break
                                    elif parent.type in ['class_declaration', 'struct_item']:
                                        name_node = parent.child_by_field_name('name')
                                        if name_node:
                                            qualified_name = f"{name_node.text.decode('utf-8')}::{func_name}"
                                            break
                                    parent = parent.parent
                                param_count = 0
                                if params_node:
                                    param_types = ['identifier', 'parameter', 'formal_parameter', 'simple_parameter']
                                    param_count = sum(1 for child in params_node.children if child.type in param_types)
                                function_map[(file_path, qualified_name, param_count)] = node
                                # print(f"Mapped: {(file_path, qualified_name, param_count)}")
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
        'use_declaration','use_list', 'scoped_use_list'
    ]
    
    # Module name node types across languages
    module_name_types = [
        'dotted_name', 'identifier', 'namespace_name', 'qualified_identifier',
        'string_literal', 'string', 'raw_string_literal','scoped_identifier'
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
    
    assignment_types = [
        'assignment', 'variable_declarator', 'assignment_expression', 'variable_declaration',
        'local_variable_declaration', 'declaration', 'init_declarator',
        'short_var_declaration', 'var_declaration', 'var_spec', 'assignment_statement',
        'local_variable_assignment', 'let_declaration', 'assignment_expression', 'let_condition',
        'match_arm', 'tuple_struct_pattern'
    ]
    
    if node.type in assignment_types:
        left = (node.child_by_field_name('left') or 
                node.child_by_field_name('name') or 
                node.child_by_field_name('declarator') or 
                node.child_by_field_name('pattern'))
        right = (node.child_by_field_name('right') or 
                 node.child_by_field_name('value') or 
                 node.child_by_field_name('initializer') or 
                 node.child_by_field_name('expression'))
        
        if left:
            identifier = left
            while identifier and identifier.type not in ['identifier', 'field_identifier']:
                for child in identifier.children:
                    if child.type in ['identifier', 'field_identifier']:
                        identifier = child
                        break
                else:
                    break
            
            if identifier and identifier.type in ['identifier', 'field_identifier']:
                var_name = identifier.text.decode('utf-8')
                var_value = right.text.decode('utf-8') if right else None
                variables[var_name] = var_value
        
        # Handle let Some(query) and match patterns
        if node.type in ['let_condition', 'match_arm', 'tuple_struct_pattern']:
            if node.type == 'tuple_struct_pattern':
                for child in node.children:
                    if child.type == 'identifier' and child.text.decode('utf-8') != 'Some':  # Skip constructor
                        variables[child.text.decode('utf-8')] = None
            elif node.type == 'let_condition':
                pattern = node.children[0] if node.children else None
                if pattern and pattern.type == 'tuple_struct_pattern':
                    for child in pattern.children:
                        if child.type == 'identifier' and child.text.decode('utf-8') != 'Some':
                            variables[child.text.decode('utf-8')] = None
    
    func_types = [
        'function_definition', 'function_declaration', 'method_definition', 'arrow_function',
        'method_declaration', 'constructor_declaration', 'function_declarator',
        'method', 'singleton_method', 'function_item', 'function_signature_item'
    ]
    
    if node.type in func_types:
        param_container_fields = ['parameters', 'parameter_list', 'formal_parameters']
        for field_name in param_container_fields:
            params = node.child_by_field_name(field_name)
            if params:
                param_types = ['identifier', 'parameter', 'formal_parameter', 'simple_parameter']
                for child in params.children:
                    if child.type in param_types:
                        param_id = child.child_by_field_name('pattern') or child
                        while param_id and param_id.type not in ['identifier', 'variable_name']:
                            name_node = param_id.child_by_field_name('name')
                            if name_node:
                                param_id = name_node
                                break
                            for subchild in param_id.children:
                                if subchild.type in ['identifier', 'variable_name']:
                                    param_id = subchild
                                    break
                            else:
                                break
                        if param_id and param_id.type in ['identifier', 'variable_name']:
                            variables[param_id.text.decode('utf-8')] = None
                break
    
    return variables

def resolve_function_call(call_node, function_map):
    """Resolve a function call to its definition across all supported languages."""
    function_field_names = ['function', 'callee', 'name', 'method', 'identifier']
    func_part = next((call_node.child_by_field_name(f) for f in function_field_names if call_node.child_by_field_name(f)), None)
    if not func_part:
        for child in call_node.children:
            if child.type in ['identifier', 'member_expression', 'field_access', 'field_expression', 'scoped_identifier']:
                func_part = child
                break
    
    if not func_part or func_part.type not in ['identifier', 'member_expression', 'field_access', 'field_expression', 'scoped_identifier']:
        return None
    
    full_func_name = func_part.text.decode('utf-8')  # e.g., "Gemini::parse"
    base_func_name = full_func_name.split('::')[-1].split('.')[-1]  # e.g., "parse"
    
    arg_field_names = ['arguments', 'argument_list', 'args']
    args = next((call_node.child_by_field_name(f) for f in arg_field_names if call_node.child_by_field_name(f)), None)
    arg_count = 0
    if args:
        # Count all named children as arguments
        arg_count = sum(1 for child in args.children if child.is_named)
    
    # Try full name, base name, and constructor-like (e.g., Gemini::parse → GeminiModel::new)
    for (file_path, name, param_count), def_node in function_map.items():
        if param_count == arg_count:
            if name == full_func_name or name.endswith(f"::{base_func_name}"):
                # print(f"Resolved: {full_func_name} → {(file_path, name, param_count)}")
                return def_node
            # Constructor heuristic: if call is "Type::func", check "TypeModel::func" or "Type::new"
            type_prefix = full_func_name.split('::')[0]
            if name.startswith(f"{type_prefix}Model::") or name == f"{type_prefix}::new":
                # print(f"Resolved (constructor): {full_func_name} → {(file_path, name, param_count)}")
                return def_node
    
    # print(f"Unresolved: {full_func_name} with {arg_count} args")
    return None


def node_to_dict(node, function_map, expanded_asts, modules_used, referenced_files, visited=None, file_path=None):
    """Convert node to dict, expanding function calls recursively with cycle prevention and track referenced files."""
    if visited is None:
        visited = set()
    
    comment_types = ['comment', 'line_comment', 'block_comment', 'documentation_comment']
    if node.type in comment_types:
        return None
    
    result = {"type": node.type}
    
    # Expanded leaf nodes to stop unnecessary child expansion
    leaf_types = [
        'string_literal', 'identifier', 'integer', 'string', 'number', 'token_tree'
    ]
    if node.type in leaf_types:
        result["Text"] = node.text.decode("utf-8")
        return result  # Stop recursion here
    
    # Nodes where text is sufficient and children can be skipped
    text_sufficient_types = ['use_declaration', 'mod_item', 'attribute_item', 'dotted_name']
    if node.type in text_sufficient_types:
        result["Text"] = node.text.decode("utf-8")
        return result  # Skip children entirely if Text is present
    
    key_node_types = [
        'function_definition', 'method_definition', 'function_declaration', 'method_declaration',
        'function_item', 'constructor_declaration', 'arrow_function',
        'call', 'call_expression', 'method_invocation', 'method_call', 'macro_invocation',
        'assignment', 'variable_declarator', 'assignment_expression', 'short_var_declaration',
        'var_declaration', 'local_variable_declaration', 'declaration', 'let_declaration'
    ]
    if node.start_point and node.type in key_node_types:
        result["source"] = {"file": file_path or "unknown", "line": node.start_point[0] + 1}
    
    structural_nodes = [
        'call', 'call_expression', 'method_invocation', 'method_call', 'macro_invocation',
        'assignment', 'variable_declarator', 'assignment_expression', 'short_var_declaration',
        'var_declaration', 'local_variable_declaration', 'declaration', 'let_declaration',
        'function_definition', 'method_definition', 'function_declaration', 'method_declaration',
        'function_item', 'constructor_declaration', 'arrow_function',
        'struct_item', 'if_expression', 'match_expression', 'block', 'source_file',
        'match_arm', 'match_block', 'else_clause', 'let_condition',
        'module', 'import_statement', 'import_from_statement'
    ]
    
    expression_statements = [
        'expression_statement', 'stmt_expr', 'expression_stmt', 'simple_statement', 'expr_stmt'
    ]
    
    named_children = [child for child in node.children if child.is_named]
    if named_children:
        if node.type in expression_statements and len(named_children) == 1:
            return node_to_dict(named_children[0], function_map, expanded_asts, modules_used, referenced_files, visited, file_path)
        elif node.type in structural_nodes:
            if node.type in ['call', 'call_expression', 'method_invocation', 'method_call', 'macro_invocation']:
                func = node.child_by_field_name('function') or (node.children[0] if node.type == 'macro_invocation' else None)
                if func:
                    full_func_name = func.text.decode('utf-8')
                    base_name = full_func_name.split('(')[0].split('::')[-1].split('.')[0]
                    result["function_call"] = base_name
                    called_ast = resolve_function_call(node, function_map)
                    if called_ast:
                        func_key = (called_ast.start_point, called_ast.end_point)
                        file_path_key, defined_name, param_count = next(k for k, v in function_map.items() if v == called_ast)
                        referenced_files.add(file_path_key)
                        ref_key = f"{file_path_key}:{defined_name}:{param_count}"
                        visited_key = (file_path_key, defined_name, param_count)
                        if func_key in expanded_asts:
                            result["called_function"] = {"ref": ref_key}
                        elif visited_key not in visited:
                            visited.add(visited_key)
                            expanded_ast = node_to_dict(called_ast, function_map, expanded_asts, modules_used, referenced_files, visited, file_path_key)
                            if expanded_ast["type"] in [
                                'function_definition', 'method_definition', 'function_declaration', 
                                'method_declaration', 'function_item', 'constructor_declaration', 'arrow_function'
                            ]:
                                expanded_ast["id"] = ref_key
                            expanded_asts[func_key] = expanded_ast
                            result["called_function"] = expanded_ast
                        else:
                            result["called_function"] = {"ref": ref_key}
                    elif not detect_vulnerabilities(node):
                        result["is_library"] = True
                    # Flatten scoped_identifier for function calls
                    if func.type == 'scoped_identifier':
                        result["function_call"] = func.text.decode('utf-8')
                    # Simplify arguments
                    args = node.child_by_field_name('arguments')
                    if args:
                        args_children = [c for c in args.children if c.is_named]
                        if len(args_children) == 1 and args_children[0].type in leaf_types:
                            result["arguments"] = {"Text": args_children[0].text.decode('utf-8')}
                        elif args_children:
                            result["arguments"] = [
                                node_to_dict(c, function_map, expanded_asts, modules_used, referenced_files, visited, file_path)
                                for c in args_children if c.type not in comment_types
                            ]
            elif node.type in [
                'function_definition', 'method_definition', 'function_declaration', 
                'method_declaration', 'function_item', 'constructor_declaration', 'arrow_function'
            ]:
                name_node = node.child_by_field_name('name')
                if name_node:
                    result["function_name"] = name_node.text.decode('utf-8')
                params = node.child_by_field_name('parameters')
                if params:
                    result["param_count"] = sum(1 for c in params.children if c.type in ['parameter', 'identifier'])
                body_field_names = ['body', 'block', 'value', 'statement']
                block_node = next((node.child_by_field_name(f) for f in body_field_names if node.child_by_field_name(f)), None)
                if not block_node:
                    for child in named_children:
                        if child.type in ['block', 'compound_statement', 'block_statement']:
                            block_node = child
                            break
                if block_node:
                    result["children"] = [
                        node_to_dict(child, function_map, expanded_asts, modules_used, referenced_files, visited, file_path)
                        for child in block_node.children if child.is_named and child.type not in comment_types
                    ]
            # Handle imports for module tracking (moved from use_declaration)
            elif node.type in ['import_statement', 'import_from_statement']:
                module_node = node.child_by_field_name('module_name') or node.child_by_field_name('name')
                if module_node and module_node.type == 'dotted_name':
                    module_name = module_node.text.decode('utf-8')
                    modules_used.add(module_name)
        
        # Process children for non-leaf structural nodes
        if "children" not in result and "arguments" not in result:
            result["children"] = [
                node_to_dict(child, function_map, expanded_asts, modules_used, referenced_files, visited, file_path)
                for child in named_children if child.type not in comment_types
            ]
        result["children"] = [c for c in result.get("children", []) if c]
        if not result["children"]:
            del result["children"]
    
    vulnerabilities = detect_vulnerabilities(node)
    if vulnerabilities:
        result["vulnerabilities"] = vulnerabilities
    
    return result


def generate_project_asts(project_dir, entrypoint_file, output_file=None):
    """Generate expanded AST for the entrypoint using all project ASTs."""
    ast_map, function_map = parse_all_files(project_dir)
    
    # Check if entrypoint exists
    if entrypoint_file not in ast_map:
        raise ValueError(f"Entrypoint file '{entrypoint_file}' not found in project directory '{project_dir}'")
    # print(ast_map)
    # for i in ast_map:
    #     print(ast_map[i])
    main_ast = ast_map[entrypoint_file]
    # print(main_ast)
    expanded_asts = {}
    modules_used = set()
    referenced_files = set([entrypoint_file])  # Initialize with the entrypoint file
    
    # Generate the expanded AST and track referenced files
    ast_dict = node_to_dict(main_ast, function_map, expanded_asts, modules_used, referenced_files, file_path=entrypoint_file)
    # print("\n",main_ast,"\n", function_map,"\n", expanded_asts,"\n", modules_used,"\n", referenced_files,entrypoint_file)
    # print(ast_dict)
    # Collect imports from referenced files after expansion
    for file_path in referenced_files:
        root_node = ast_map[file_path]
        extract_imports(root_node, modules_used)
    
    # Build the result dictionary
    ast_map_dict = {
        "main_ast": ast_dict,
        "modules_used": sorted(list(modules_used)),  # Sorted for consistent output
        "referenced_files": sorted(list(referenced_files))  # Include file names for visualization
    }
    
    # Optionally include ASTs for referenced files (unexpanded)
    # for file_path in referenced_files:
    #     if file_path != entrypoint_file:
    #         ast_map_dict[file_path] = {
    #             "type": ast_map[file_path].type,
    #             "text": ast_map[file_path].text.decode('utf-8')
    #         }
    
    # Use provided output file or default to a project-specific path
    output_path = output_file or "/app/backend/sample_project/ast_output.json"
    # print(ast_map_dict)
    save_ast_to_file(ast_map_dict, output_path)
    
    return ast_map_dict  # Return for further use or testing

def save_ast_to_file(ast_map, filename):
    """Save the AST dictionary to a JSON file."""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(ast_map, f, indent=4)
    print(f"✅ ASTs saved to {filename}")

