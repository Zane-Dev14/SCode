import tree_sitter_python as tspython
from tree_sitter import Language, Parser

from tree_sitter_python import language as python_language
from tree_sitter_javascript import language as js_language
from tree_sitter_java import language as java_language
from tree_sitter_cpp import language as cpp_language
from tree_sitter_c import language as c_language
from tree_sitter_go import language as go_language
from tree_sitter_ruby import language as ruby_language
from tree_sitter_c_sharp import language as csharp_language
from tree_sitter_rust import language as rust_language
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
for i in LANGUAGE_MAPPING:
    parser=Parser()
    parser=Language(LANGUAGE_MAPPING[i])
    print(parser)

# PY_LANGUAGE = Language(tspython.language())  # tspython.language() returns an int
# parser = Parser(PY_LANGUAGE)
# print(parser)
