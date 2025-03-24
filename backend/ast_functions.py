def traverse(node):
    """Recursively yield all nodes in an AST."""
    yield node
    for child in node.children:
        yield from traverse(child)

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


