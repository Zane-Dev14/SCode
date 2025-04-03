const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './src/extension.js',
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode',
    'child_process': 'commonjs child_process',
    'path': 'commonjs path',
    'fs': 'commonjs fs',
    'http': 'commonjs http',
    'url': 'commonjs url',
    'react': 'commonjs react',
    'react-dom': 'commonjs react-dom',
    'three': 'commonjs three',
    '@react-three/fiber': 'commonjs @react-three/fiber',
    '@react-three/drei': 'commonjs @react-three/drei',
    '@react-three/postprocessing': 'commonjs @react-three/postprocessing',
    'd3': 'commonjs d3',
    'framer-motion': 'commonjs framer-motion',
    'gsap': 'commonjs gsap'
  },
  resolve: {
    extensions: ['.js', '.jsx']
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
            plugins: [
              '@babel/plugin-proposal-class-properties',
              '@babel/plugin-transform-runtime'
            ]
          }
        }
      },
      {
        test: /\.glsl$/,
        type: 'asset/source'
      }
    ]
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'media', to: 'media' }
      ]
    })
  ],
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          parse: {
            ecma: 8
          },
          compress: {
            ecma: 5,
            warnings: false,
            comparisons: false
          },
          mangle: {
            safari10: true
          },
          output: {
            ecma: 5,
            comments: false,
            ascii_only: true
          }
        },
        parallel: true
      })
    ]
  }
};