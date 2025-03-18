import os
import tree_sitter
from tree_sitter import Language, Parser
from language_detector import detect_language, get_all_source_files

# Path to the Tree-sitter languages
TREE_SITTER_LIB = "/app/backend/tree-sitter-langs/build/my-languages.so"

# Load parsers for all supported languages
LANGUAGE_MAPPING = {
    'python': 'python',
    'javascript': 'javascript',
    'typescript': 'typescript',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'go': 'go',
    'ruby': 'ruby',
    'php': 'php',
    'c-sharp': 'c_sharp',
    'rust': 'rust'
}

# Initialize parsers for all languages
PARSERS = {}
for lang, ts_lang in LANGUAGE_MAPPING.items():
    PARSERS[lang] = Parser()
    PARSERS[lang].set_language(Language(TREE_SITTER_LIB, ts_lang))

def generate_ast(file_path, language):
    """
    Generates AST using Tree-sitter for a single file.
    """
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        code = f.read()

    if language not in PARSERS:
        print(f"No parser for language: {language}")
        return None

    parser = PARSERS[language]
    tree = parser.parse(bytes(code, "utf8"))
    return tree

def generate_project_asts(project_dir):
    """
    Generates ASTs for all files in the project directory.
    Returns a dictionary: {file_path: AST}.
    """
    asts = {}
    source_files = get_all_source_files(project_dir)

    for file_path in source_files:
        language = detect_language(file_path)
        
        if not language:
            print(f"Skipping unsupported file: {file_path}")
            continue

        try:
            ast = generate_ast(file_path, language)
            if ast:
                asts[file_path] = ast
                print(f"Generated AST → {file_path}")
            else:
                print(f"Failed to parse → {file_path}")
        except Exception as e:
            print(f"Error generating AST for {file_path}: {e}")

    return asts

if __name__ == '__main__':
    project_dir = '/app/backend/test_project'  # Example project directory
    ast_map = generate_project_asts(project_dir)
    
    print(f"\nGenerated ASTs for {len(ast_map)} files.")
