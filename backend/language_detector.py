import os

# Supported languages with their file extensions
LANGUAGE_EXTENSIONS = {
    '.py': 'python',
    '.js': 'javascript',
    '.ts': 'typescript',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.go': 'go',
    '.rb': 'ruby',
    '.php': 'php',
    '.cs': 'c-sharp',
    '.rs': 'rust',
}

def detect_language(file_path):
    """
    Detects the language based on the file extension.
    """
    _, ext = os.path.splitext(file_path)
    return LANGUAGE_EXTENSIONS.get(ext.lower(), None)

def get_all_source_files(root_dir):
    """
    Recursively finds all source code files based on supported extensions.
    """
    source_files = []
    for root, _, files in os.walk(root_dir):
        for file in files:
            if any(file.endswith(ext) for ext in LANGUAGE_EXTENSIONS):
                source_files.append(os.path.join(root, file))
    return source_files

if __name__ == '__main__':
    project_dir = '/app/backend/test_project'  # Example path
    files = get_all_source_files(project_dir)
    for file in files:
        lang = detect_language(file)
        print(f"Detected {lang} → {file}")
