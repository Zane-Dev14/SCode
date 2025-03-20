import os
from tree_sitter import Parser,Language
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

# Map your language names to their Tree-sitter language objects
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

# Initialize parsers
PARSERS = {}
parser = Parser()

# for lang, language_obj in LANGUAGE_MAPPING.items():
#     try:
#         parser= Parser(Language(language_obj))
#         PARSERS[lang] = parser.copy()  # Create a separate parser per language
#         print(f"✅ Loaded language: {lang}")
#     except Exception as e:
#         print(f"❌ Failed to load language {lang}: {e}")

import json

def save_ast_to_file(tree, filename):
    ast_json = tree.root_node.to_json()  # Assuming Tree-sitter tree has a 'to_json' method
    with open(filename, 'w') as f:
        json.dump(ast_json, f, indent=4)

def generate_ast(file_path, language):
    """Generate an AST for a given file and language."""
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        code = f.read()
    
    parser=Parser(Language(LANGUAGE_MAPPING[language]))
    tree = parser.parse(bytes(code, "utf8"))
    save_ast_to_file(tree,'sample_project/ast_output.json')

    return tree

def generate_project_asts(project_dir):
    """Generate ASTs for all supported files in a project directory."""
    asts = {}
    source_files = get_all_source_files(project_dir)
    
    for file_path in source_files:
        language = detect_language(file_path)
        
        try:
            ast = generate_ast(file_path, language)
            print(ast)
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