import os

def map_project_structure(root_dir):
    """
    Recursively maps the entire project structure.
    Returns a list of file paths.
    """
    project_files = []
    
    for root, _, files in os.walk(root_dir):
        for file in files:
            project_files.append(os.path.join(root, file))
    
    return project_files

if __name__ == "__main__":
    project_dir = "/app/backend/test_project"  # Example path
    files = map_project_structure(project_dir)
    
    print("\n📁 Mapped Project Files:")
    for f in files:
        print(f)
