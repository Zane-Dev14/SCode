const path = require('path');

module.exports = {
  target: 'node',
  entry: './src/extension.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode',
    // Don't bundle these node modules
    three: 'commonjs three',
    d3: 'commonjs d3',
    react: 'commonjs react',
    'react-dom': 'commonjs react-dom',
    '@react-three/fiber': 'commonjs @react-three/fiber',
    '@react-three/drei': 'commonjs @react-three/drei',
    '@react-three/postprocessing': 'commonjs @react-three/postprocessing',
    'framer-motion': 'commonjs framer-motion',
    gsap: 'commonjs gsap'
  },
  resolve: {
    extensions: ['.js', '.jsx']
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  devtool: 'source-map'
};