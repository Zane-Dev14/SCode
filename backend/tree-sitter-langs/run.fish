#!/usr/bin/env fish

# Set paths
set BASE_DIR (pwd)
set BUILD_DIR "$BASE_DIR/build"

# Step 3: Compile Each Parser into Object Files
echo "\n🔨 Compiling shared library..."
mkdir -p "$BUILD_DIR"

# Clean up old object files
rm -f "$BUILD_DIR"/*.o

# Compile each parser separately into .o files
set PARSER_FILES ""
for dir in $BASE_DIR/tree-sitter-*
    if test -f "$dir/src/parser.c"
        set OUTPUT "$BUILD_DIR/"(basename "$dir")".o"
        echo "✅ Compiling $dir/src/parser.c → $OUTPUT"

        # Compile each .c file individually
        gcc -c "$dir/src/parser.c" -fPIC -o "$OUTPUT" \
            -I "$dir/src" || begin
            echo "❌ Compilation failed for $dir/src/parser.c"
            exit 1
        end

        # Collect the object files
        set PARSER_FILES "$PARSER_FILES $OUTPUT"
    else
        echo "⚠️ Missing parser.c in $dir. Skipping..."
    end
end

# Step 4: Verify Object Files
echo "\n🔎 Verifying compiled object files..."
if test -z "$PARSER_FILES"
    echo "❌ No object files were compiled. Exiting..."
    exit 1
end

# Print the valid .o files
echo "✅ Object files to link:"
echo "$PARSER_FILES"

# Step 5: Link All Object Files with `eval` or `xargs`
echo "\n🔗 Linking all object files into the shared library..."
# Use eval to properly expand paths
eval "gcc -shared -o \"$BUILD_DIR/my-languages.so\" $PARSER_FILES"

# Alternatively, use xargs if you still face issues
# echo $PARSER_FILES | xargs gcc -shared -o "$BUILD_DIR/my-languages.so"

# Verify the shared library
if test -f "$BUILD_DIR/my-languages.so"
    echo "\n✅ Shared library compiled successfully: $BUILD_DIR/my-languages.so"
else
    echo "\n❌ Compilation failed."
    exit 1
end

# Step 6: Prepare for Docker Build
echo "\n📦 Preparing Docker Build..."
cp "$BUILD_DIR/my-languages.so" "$BASE_DIR/../backend/tree-sitter-langs/build/my-languages.so"
echo "✅ Shared library copied to Docker build folder."

# Done
echo "\n🚀 Tree-sitter setup completed successfully!"
