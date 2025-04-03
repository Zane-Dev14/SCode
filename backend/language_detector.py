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
# Common entrypoint names for each language
COMMON_ENTRYPOINTS = {
    'python': ['main.py', 'app.py', 'run.py', '__init__.py'],
    'javascript': ['index.js', 'app.js', 'main.js'],
    'typescript': ['index.ts', 'app.ts', 'main.ts'],
    'java': ['Main.java'],
    'cpp': ['main.cpp'],
    'c': ['main.c'],
    'go': ['main.go'],
    'ruby': ['app.rb', 'main.rb'],
    'php': ['index.php'],
    'c-sharp': ['Program.cs'],
    'rust': ['main.rs'],
}

def find_entrypoint(project_dir):
    """
    Finds the entrypoint file in the project directory based on the dominant language
    and common naming conventions.

    Args:
        project_dir (str): The path to the project directory.

    Returns:
        str or None: The relative path to the entrypoint file, or None if no source files are found.
    """
    # Get all source files in the project
    source_files = get_all_source_files(project_dir)
    if not source_files:
        return None

    # Count files per language to determine the dominant language
    lang_counts = {}
    for file in source_files:
        lang = detect_language(file)
        if lang:
            lang_counts[lang] = lang_counts.get(lang, 0) + 1

    if not lang_counts:
        return None

    # Determine the dominant language (language with the most files)
    dominant_lang = max(lang_counts, key=lang_counts.get)

    # Helper function to find potential entrypoints
    def get_potential_entrypoints():
        potential_entrypoints = []
        for root, _, files in os.walk(project_dir):
            for file in files:
                # Check if the file matches any common entrypoint name
                if any(file == entrypoint for lang_entrypoints in COMMON_ENTRYPOINTS.values()
                       for entrypoint in lang_entrypoints):
                    file_path = os.path.join(root, file)
                    lang = detect_language(file_path)
                    if lang:
                        potential_entrypoints.append((file_path, lang))
        return potential_entrypoints

    # Get all potential entrypoints
    potential_entrypoints = get_potential_entrypoints()

    if potential_entrypoints:
        # Sort entrypoints by language count (descending), prioritizing the dominant language
        potential_entrypoints.sort(key=lambda x: lang_counts.get(x[1], 0), reverse=True)
        # Select the entrypoint with the highest language count
        selected_path, selected_lang = potential_entrypoints[0]
        return os.path.relpath(selected_path, project_dir)
    else:
        # If no common entrypoints are found, return the first file in the dominant language
        for file in source_files:
            if detect_language(file) == dominant_lang:
                return os.path.relpath(file, project_dir)
        # If no files in dominant language (unlikely), return the first source file
        return os.path.relpath(source_files[0], project_dir)
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



# if __name__ == '__main__':
#     project_dir = '/app/backend/test_project'  # Example path
#     files = get_all_source_files(project_dir)
#     for file in files:
#         lang = detect_language(file)
#         print(f"Detected {lang} → {file}")
