const path = require("path");

module.exports = {
  entry: "./index.js",
  devtool: 'inline-source-map',
  devServer: {
    contentBase: './dist',
    clientLogLevel: 'error'
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    publicPath: "/",
    library: 'bookworm',
    libraryTarget: 'umd', 
    filename: "output.js"
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: "babel-loader",
        exclude: /(node_modules)/
      },
      {
        test: /\.(s?css)$/,
        use: [
          {
            // Adds CSS to the DOM by injecting a `<style>` tag
            loader: 'style-loader'
          },
          {
            // Interprets `@import` and `url()` like `import/require()` and will resolve them
            loader: 'css-loader'
          },
          {
            // Loader for webpack to process CSS with PostCSS
            loader: 'postcss-loader',
            options: {
              plugins: function () {
                return [
                  require('autoprefixer')
                ];
              }
            }
          },
          {
            loader: 'sass-loader'
          }
        ]
      }
    ]
  }
};
