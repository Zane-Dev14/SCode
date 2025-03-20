import tree_sitter_python as tspython
from tree_sitter import Language, Parser

PY_LANGUAGE = Language(tspython.language())  # tspython.language() returns an int
parser = Parser(PY_LANGUAGE)
print(parser)
