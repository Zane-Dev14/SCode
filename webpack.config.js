const path = require('path');

module.exports = [
  {
    mode: 'production',
    entry: './src/extension.ts',
    output: {
      filename: 'extension.js',
      path: path.resolve(__dirname, 'dist'),
      libraryTarget: 'commonjs2'
    },
    resolve: {
      extensions: ['.ts', '.js']
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/
        }
      ]
    },
    externals: {
      vscode: 'commonjs vscode'
    }
  },
  {
    mode: 'production',
    entry: './media/main.js',
    output: {
      filename: 'main.js',
      path: path.resolve(__dirname, 'media')
    },
    resolve: {
      extensions: ['.js']
    }
  }
];