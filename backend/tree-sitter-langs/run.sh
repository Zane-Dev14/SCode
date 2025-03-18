#!/usr/bin/env fish

# Set paths
set BASE_DIR (pwd)
set BUILD_DIR "$BASE_DIR/build"

# Step 1: Install Node.js Dependencies
echo "📦 Installing Node.js dependencies..."
for dir in $BASE_DIR/tree-sitter-*
    echo "🔹 Installing dependencies for $dir..."
    cd "$dir"
    npm install
    cd "$BASE_DIR"
end

# Step 2: Generate Parsers
echo "\n⚙️ Generating Tree-sitter parsers..."
for dir in $BASE_DIR/tree-sitter-*
    echo "🔹 Generating parser for $dir..."
    cd "$dir"
    tree-sitter generate
    cd "$BASE_DIR"
end

# Step 3: Compile the Shared Library
echo "\n🔨 Compiling shared library..."
mkdir -p "$BUILD_DIR"

gcc -o "$BUILD_DIR/my-languages.so" -shared -fPIC \
    tree-sitter-python/src/parser.c \
    tree-sitter-javascript/src/parser.c \
    tree-sitter-typescript/src/parser.c \
    tree-sitter-java/src/parser.c \
    tree-sitter-cpp/src/parser.c \
    tree-sitter-c/src/parser.c \
    tree-sitter-go/src/parser.c \
    tree-sitter-rust/src/parser.c \
    tree-sitter-php/src/parser.c \
    tree-sitter-ruby/src/parser.c \
    tree-sitter-c-sharp/src/parser.c \
    -I tree-sitter-python/src \
    -I tree-sitter-javascript/src \
    -I tree-sitter-typescript/src \
    -I tree-sitter-java/src \
    -I tree-sitter-cpp/src \
    -I tree-sitter-c/src \
    -I tree-sitter-go/src \
    -I tree-sitter-rust/src \
    -I tree-sitter-php/src \
    -I tree-sitter-ruby/src \
    -I tree-sitter-c-sharp/src

# Verify the shared library
if test -f "$BUILD_DIR/my-languages.so"
    echo "\n✅ Shared library compiled successfully: $BUILD_DIR/my-languages.so"
else
    echo "\n❌ Compilation failed."
    exit 1
end

# Step 4: Prepare for Docker Build
echo "\n📦 Preparing Docker Build..."

# Copy the compiled shared library into Docker project
cp "$BUILD_DIR/my-languages.so" "$BASE_DIR/../backend/tree-sitter-langs/build/my-languages.so"
echo "✅ Shared library copied to Docker build folder."

# Done
echo "\n🚀 Tree-sitter setup completed successfully!"
