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

#My other libraries.
from vulnerability_scanner import detect_vulnerabilities
from language_detector import detect_language
from ast_functions import traverse,extract_imports,extract_variables,resolve_function_call


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
                    # Instantiate parser using the proper language mapping
                    parser = Parser(Language(LANGUAGE_MAPPING[lang]))
                    tree = parser.parse(bytes(code, "utf-8"))
                    ast_map[file_path] = tree.root_node
                    for node in traverse(tree.root_node):
                        func_types = [
                            'function_definition', 'method_definition', 'function_declaration', 'function_item',
                            'method_declaration', 'constructor_declaration', 'arrow_function'
                        ]
                        if node.type in func_types:
                            # For languages like C, C++ and Rust, try to extract the function name from 'declarator'
                            if lang in ['c', 'cpp', 'rust']:
                                declarator = node.child_by_field_name('declarator')
                                func_name = None
                                if declarator:
                                    for child in declarator.children:
                                        if child.type == 'identifier':
                                            func_name = child.text.decode('utf-8')
                                            break
                                # If not found in declarator, fallback to the usual 'name' field.
                                if not func_name:
                                    name_node = node.child_by_field_name('name')
                                    if name_node:
                                        func_name = name_node.text.decode('utf-8')
                                    else:
                                        func_name = 'unnamed'
                            else:
                                # For other languages (Python, JavaScript, Java, Go, Ruby, C#), use 'name'
                                name_node = node.child_by_field_name('name')
                                if name_node:
                                    func_name = name_node.text.decode('utf-8')
                                else:
                                    func_name = 'unnamed'
                            
                            qualified_name = func_name
                            # Check parent nodes for namespace or class/struct context
                            parent = node.parent
                            while parent:
                                if parent.type == 'impl_item':
                                    type_node = parent.child_by_field_name('type')
                                    if type_node:
                                        qualified_name = f"{type_node.text.decode('utf-8')}::{func_name}"
                                        break
                                elif parent.type in ['class_declaration', 'struct_item']:
                                    parent_name_node = parent.child_by_field_name('name')
                                    if parent_name_node:
                                        qualified_name = f"{parent_name_node.text.decode('utf-8')}::{func_name}"
                                        break
                                parent = parent.parent
                            
                            # Determine parameter count from the parameters node if available
                            param_count = 0
                            params_node = node.child_by_field_name('parameters')
                            if params_node:
                                param_types = ['identifier', 'parameter', 'formal_parameter', 'simple_parameter']
                                param_count = sum(1 for child in params_node.children if child.type in param_types)
                            
                            # Map the function by a tuple key (file_path, qualified_name, param_count)
                            function_map[(file_path, qualified_name, param_count)] = node
                            # print(f"Mapped: {(file_path, qualified_name, param_count)}")
    return ast_map, function_map






def node_to_dict(node, function_map, expanded_asts, modules_used, referenced_files, visited=None, file_path=None):
    """Convert node to dict, expanding function calls recursively with cycle prevention and track referenced files."""
    if visited is None:
        visited = set()
    
    comment_types = ['comment', 'line_comment', 'block_comment', 'documentation_comment']
    if node.type in comment_types:
        return None
    
    result = {"type": node.type}
    
    if node.type in ['assignment', 'variable_declaration', 'var_declaration', 'let_declaration']:
        variables = extract_variables(node)  # Call extract_variables function
        if variables:
            result["variables"] = variables  # Add variables to the result

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
            elif node.type in ['jsx_element', 'jsx_self_closing_element']:
                result["type"] = node.type
                # Find the tag name
                if node.type == 'jsx_element':
                    opening_element = next((child for child in node.children if child.type == 'jsx_opening_element'), None)
                    tag_identifier = opening_element and next((child for child in opening_element.children if child.type == 'identifier'), None)
                else:  # jsx_self_closing_element
                    tag_identifier = next((child for child in node.children if child.type == 'identifier'), None)
                
                if tag_identifier:
                    tag_name = tag_identifier.text.decode('utf-8')
                    result["component"] = tag_name
                    # Check if it's a user-defined component (capitalized)
                    if tag_name[0].isupper():
                        # Resolve component definition with flexible param_count
                        for (file_path, name, param_count), def_node in function_map.items():
                            if name == tag_name and param_count in [0, 1]:  # Allow 0 or 1 parameters
                                func_key = (def_node.start_point, def_node.end_point)
                                ref_key = f"{file_path}:{name}:{param_count}"
                                visited_key = (file_path, name, param_count)
                                if func_key in expanded_asts:
                                    result["called_function"] = {"ref": ref_key}
                                elif visited_key not in visited:
                                    visited.add(visited_key)
                                    expanded_ast = node_to_dict(def_node, function_map, expanded_asts, modules_used, referenced_files, visited, file_path)
                                    expanded_ast["id"] = ref_key
                                    expanded_asts[func_key] = expanded_ast
                                    result["called_function"] = expanded_ast
                                else:
                                    result["called_function"] = {"ref": ref_key}
                                # Add the file to referenced_files
                                referenced_files.add(file_path)
                                break
                # Process all named children (attributes, child elements, etc.)
                result["children"] = [
                    node_to_dict(child, function_map, expanded_asts, modules_used, referenced_files, visited, file_path)
                    for child in node.children if child.is_named
                ]
                # Remove empty children
                result["children"] = [c for c in result["children"] if c]
                if not result["children"]:
                    del result["children"]
            elif node.type in [
                'function_definition', 'method_definition', 'function_declaration', 
                'method_declaration', 'function_item', 'constructor_declaration', 'arrow_function'
            ]:
                # Try to get the function name directly
                name_node = node.child_by_field_name('name')
                if not name_node:
                    # Fallback: check for a declarator and then find an identifier within it
                    declarator = node.child_by_field_name('declarator')
                    if declarator:
                        for child in declarator.children:
                            if child.type == 'identifier':
                                name_node = child
                                break
                if name_node:
                    result["function_name"] = name_node.text.decode('utf-8')
                else:
                    result["function_name"] = "unnamed"
                
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
                        for child in block_node.children if child.is_named
                    ]
                    # Safely check for a docstring as the first child
                    if result.get("children") and len(result["children"]) > 0 and result["children"][0] is not None:
                        if result["children"][0].get("type") == "string":
                            result["children"][0]["type"] = "documentation_comment"
                            first_child = block_node.children[0] if block_node.children else None
                            docstring_line = first_child.start_point[0] + 1 if first_child and first_child.is_named else result["source"]["line"] + 1
                            result["children"][0]["source"] = {"file": file_path or "unknown", "line": docstring_line}


            # Handle imports for module tracking (moved from use_declaration)
            elif node.type in ['import_statement', 'import_from_statement']:
                module_node = node.child_by_field_name('module_name') or node.child_by_field_name('name')
                if module_node and module_node.type == 'dotted_name':
                    module_name = module_node.text.decode('utf-8')
                    print(module_name)
                    modules_used.add(module_name)

        
        # Process children for non-leaf structural nodes
        if "children" not in result and "arguments" not in result:
            result["children"] = [
                node_to_dict(child, function_map, expanded_asts, modules_used, referenced_files, visited, file_path)
                for child in named_children
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
    output_path = output_file or "sample_project/ast_output.json"
    # print(ast_map_dict)
    save_ast_to_file(ast_map_dict, output_path)
    # print(f"\n\n{ast_map_dict}\n")
    # print(extract_ast_details(ast_map_dict,entrypoint_file))
    writeTojson=extract_ast_details(ast_map_dict,entrypoint_file)
    with open('sample_project/extracted.json','w') as f:
        json.dump(writeTojson,f)
    return ast_map_dict  # Return for further use or testing

def extract_ast_details(ast, file_path):
    """
    Extract comprehensive details from an AST for visualization.
    
    Args:
        ast (dict): The AST dictionary containing 'main_ast', 'modules_used', and 'referenced_files'.
        file_path (str): The file path of the primary source file.
    
    Returns:
        dict: A dictionary with all extracted details for visualization.
    """
    # Initialize data structures
    functions = []
    modules = ast.get('modules_used', [])
    dataflow = []
    variables = []
    vulnerabilities = []
    comments = []

    # Visualization aids
    colors = {
        'function': 'green',
        'variable': 'blue',
        'vulnerability': 'red',
        'module': 'yellow',
        'comment': 'gray',
        'literal': 'purple'
    }
    tooltips = {}

    # Common node types across languages (Tree-sitter compatible)
    function_types = {
        'function_definition', 'function_item', 'method_definition', 'function_declaration',
        'def_statement', 'lambda', 'async_function','arrow_function','function_item', 'constructor_declaration'
    }
    module_types = {
        'use_declaration', 'import_statement', 'mod_item', 'import_from_statement',
        'import_declaration', 'require_call'
    }
    assignment_types = {
        'let_declaration', 'assignment', 'variable_declarator', 'assignment_expression',
        'variable_declaration', 'local_variable_declaration'
    }
    call_types = {
        'call', 'call_expression', 'method_invocation', 'method_call', 'macro_invocation',
        'function_call'
    }
    comment_types = {
        'comment', 'line_comment', 'block_comment', 'documentation_comment'
    }
    literal_types = {
        'string_literal', 'integer', 'number', 'float', 'boolean', 'null', 'none'
    }

    def traverse(node, parent_id=None, depth=0, current_source=None, current_function_id=None):
        """
        Recursively traverse the AST to extract details.
        
        Args:
            node (dict): Current AST node.
            parent_id (str): ID of the parent node.
            depth (int): Current depth in the tree.
            current_source (dict): Source info from the nearest ancestor with 'source'.
            current_function_id (str): ID of the enclosing function.
        """
        # print(node)
        # Update current_source if node has source info
        if 'source' in node:
            current_source = node['source']
        # Generate a unique node ID
        node_id = (
            f"{current_source['file']}:{current_source['line']}_0"
            if current_source and 'line' in current_source
            else f"unknown:{depth}_{id(node)}"
        )

        # **Comments**
        if node.get('type') in comment_types:
            line = node.start_point[0] + 1 if 'start_point' in node else 0
            text = node.get('Text', '')
            comments.append({
                'id': node_id,
                'text': text,
                'file': current_source['file'] if current_source else file_path,
                'line': line,
                'depth': depth
            })
            tooltips[node_id] = f"Comment: {text}\nLine: {line}"
            return
        # print(node)   
        # **Functions**
        if node.get('type') in function_types:
            # Try to get the function name from the node first
            func_name = node.get('function_name')
            # If it's still None or empty, iterate over children to find an identifier
            if not func_name:
                for child in node.get('children', []):
                    # print(child)
                    if child.get('type') == 'identifier' and 'Text' in child:
                        func_name = child.get('Text')
                        break
            if not func_name:
                func_name = 'unnamed'
            print(func_name)
            line = current_source.get('line', 0) if current_source else 0
            # Extract parameters (fallback to param_count or children)
            params = []
            if 'param_count' in node:
                params = [f"param_{i}" for i in range(node['param_count'])]
            else:
                for child in node.get('children', []):
                    if child['type'] in {'parameter', 'parameters', 'parameter_list'}:
                        for p in child.get('children', []):
                            if p['type'] == 'identifier':
                                params.append(p.get('Text', 'unnamed'))
            functions.append({
                'id': node_id,
                'name': func_name,
                'file': current_source['file'] if current_source else file_path,
                'line': line,
                'parameters': params,
                'depth': depth,
                'calls': [],  # Populated later via dataflow
                'expanded': False,  # flag for interactivity (collapsed by default)
                'nodeType': 'function',  # indicates this is a function node
                'x': 0, 'y': 0, 'z': 0  
            })


            tooltips[node_id] = (
                f"Function: {func_name}\n"
                f"Parameters: {', '.join(params) if params else 'None'}\n"
                f"File: {current_source['file'] if current_source else file_path}\n"
                f"Line: {line}"
            )
            current_function_id = node_id

        # **Variables and Assignments**
        if node.get('type') in assignment_types:
            var_name = None
            var_id = None
            value = None
            line = current_source.get('line', 0) if current_source else 0
            for child in node.get('children', []):
                if child['type'] == 'identifier' and not var_name:
                    var_name = child.get('Text', '')
                    var_id = f"{var_name}@{line}"
                    variables.append({
                        'id': var_id,
                        'name': var_name,
                        'file': current_source['file'] if current_source else file_path,
                        'line': line,
                        'function': current_function_id,
                        'depth': depth
                    })
                    tooltips[var_id] = (
                        f"Variable: {var_name}\n"
                        f"Line: {line}\n"
                        f"Function: {current_function_id or 'global'}"
                    )
                elif child['type'] in literal_types:
                    value = {'type': 'literal', 'value': child.get('Text', ''), 'node': child}
                elif child['type'] in call_types:
                    called_func = child.get('function_call', 'unknown_call')
                    value = {'type': 'call', 'function': called_func, 'node': child}
                elif child['type'] == 'identifier' and var_name:  # RHS variable
                    value = {'type': 'variable', 'name': child.get('Text', ''), 'node': child}

            if var_name and value:
                if value['type'] == 'literal':
                    val_id = f"literal@{line}_{id(value['node'])}"
                    variables[-1]['assigned_value'] = value['value']
                    tooltips[var_id] += f"\nAssigned: {value['value']}"
                elif value['type'] == 'call':
                    dataflow.append({
                        'from': value['function'],  # Function name, resolved later
                        'to': var_id,
                        'type': 'assignment_call',
                        'line': line
                    })
                    tooltips[var_id] += f"\nAssigned from call: {value['function']}"
                elif value['type'] == 'variable':
                    val_id = f"{value['name']}@{line}"
                    dataflow.append({
                        'from': val_id,
                        'to': var_id,
                        'type': 'assignment_var',
                        'line': line
                    })
                    tooltips[var_id] += f"\nAssigned from: {value['name']}"

        # **Function Calls**
                # **Function Calls**
        if node.get('type') in call_types and current_function_id:
            called_func = node.get('function_call', 'unknown_call')
            line = current_source.get('line', 0) if current_source else 0
            call_id = f"call_{called_func}@{line}_{id(node)}"
            dataflow.append({
                'from': current_function_id,
                'to': called_func,  # Function name, resolved later
                'type': 'call',
                'line': line
            })
            # Add to function's calls list (if function exists)
            # Add to function's calls list (if function exists)
            for func in functions:
                if func['id'] == current_function_id:
                    func['calls'].append(called_func)
                    # NEW: Ensure the function node has a 'children' list for call nodes
                    if 'children' not in func:
                        func['children'] = []
                    # Check if a call node for this target and line already exists for grouping
                    existing_call = next((child for child in func['children']
                                        if child.get('target') == called_func and child.get('line') == line), None)
                    if existing_call:
                        # Increment a count property for aggregated calls
                        existing_call['count'] = existing_call.get('count', 1) + 1
                        # Optionally, you can update the tooltip to reflect the count
                        existing_call['tooltip'] = (
                            f"Call to: {called_func} (x{existing_call['count']})\n"
                            f"From Function: {func['name']} ({current_function_id})\n"
                            f"Line: {line}"
                        )
                    else:
                        # Otherwise, create a new call node with count = 1 and add layout hints
                        func['children'].append({
                            'id': call_id,
                            'target': called_func,  # Will be resolved to function ID later
                            'line': line,
                            'tooltip': (
                                f"Call to: {called_func}\n"
                                f"From Function: {func['name']} ({current_function_id})\n"
                                f"Line: {line}"
                            ),
                            'nodeType': 'call',    # marks this as a call node
                            'expanded': False,     # for potential future nested details
                            'x': 0, 'y': 0, 'z': 0,  # optional initial layout coordinates
                            'count': 1             # new property to track multiple calls
                        })


            tooltips[call_id] = (
                f"Call to: {called_func}\n"
                f"From Function: {next((func['name'] for func in functions if func['id'] == current_function_id), 'unknown')} ({current_function_id})\n"
                f"Line: {line}"
            )


        # **Vulnerabilities**
        if 'vulnerabilities' in node:
            line = current_source.get('line', 0) if current_source else 0
            for vuln in node['vulnerabilities']:
                vuln_id = f"vuln@{line}_{id(node)}_{len(vulnerabilities)}"
                vulnerabilities.append({
                    'id': vuln_id,
                    'description': vuln,
                    'node_id': node_id,
                    'file': current_source['file'] if current_source else file_path,
                    'line': line,
                    'depth': depth
                })
                tooltips[vuln_id] = f"Vulnerability: {vuln}\nLine: {line}"
                # Attach to associated node
                if node.get('type') in function_types:
                    for func in functions:
                        if func['id'] == node_id:
                            func.setdefault('vulnerabilities', []).append(vuln)
                # elif var_id:
                #     for var in variables:
                #         if var['id'] == var_id:
                #             var.setdefault('vulnerabilities', []).append(vuln)

        # Recurse through children
        for child in node.get('children', []):
            traverse(child, node_id, depth + 1, current_source, current_function_id)
        if 'called_function' in node:
            traverse(node['called_function'], node_id, depth + 1, current_source, current_function_id)
    # Start traversal
    
    traverse(ast['main_ast'], file_path)

    # Resolve function call references (map function names to IDs where possible)
    function_map = {func['name']: func['id'] for func in functions}
    for edge in dataflow:
        if edge['to'] in function_map:
            edge['to'] = function_map[edge['to']]
        if edge['from'] in function_map:
            edge['from'] = function_map[edge['from']]

    return {
        "functions": functions,
        "modules": modules,
        "dataflow": dataflow,
        "variables": variables,
        "vulnerabilities": vulnerabilities,
        "comments": comments,
        "colors": colors,
        "tooltips": tooltips,
        "referenced_files": ast.get('referenced_files', [])
    }



def save_ast_to_file(ast_map, filename):
    """Save the AST dictionary to a JSON file."""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(ast_map, f, indent=4)
    print(f"✅ ASTs saved to {filename}")