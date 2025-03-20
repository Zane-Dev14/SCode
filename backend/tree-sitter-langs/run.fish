# Compile tree-sitter-cpp/src/parser.c as a C file.
gcc -c -std=gnu99 -fPIC tree-sitter-langs/tree-sitter-cpp/src/parser.c -o tree-sitter-cpp.o

# Now compile the rest with g++ (ensuring you use -fPIC and -lstdc++)
g++ -shared -o build/my-languages.so -fPIC \
    tree-sitter-langs/tree-sitter-python/src/parser.c \
    tree-sitter-langs/tree-sitter-python/src/scanner.c \
    tree-sitter-langs/tree-sitter-javascript/src/parser.c \
    tree-sitter-langs/tree-sitter-javascript/src/scanner.c \
    tree-sitter-langs/tree-sitter-java/src/parser.c \
    tree-sitter-langs/tree-sitter-cpp/src/scanner.c \
    tree-sitter-cpp.o \
    tree-sitter-langs/tree-sitter-c/src/parser.c \
    tree-sitter-langs/tree-sitter-go/src/parser.c \
    tree-sitter-langs/tree-sitter-ruby/src/parser.c \
    tree-sitter-langs/tree-sitter-ruby/src/scanner.c \
    tree-sitter-langs/tree-sitter-c-sharp/src/parser.c \
    tree-sitter-langs/tree-sitter-c-sharp/src/scanner.c \
    tree-sitter-langs/tree-sitter-rust/src/parser.c \
    tree-sitter-langs/tree-sitter-rust/src/scanner.c \
    -lstdc++
