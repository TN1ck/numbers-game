const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const basePlugins = [
  new webpack.DefinePlugin({
    "process.env": {
      NODE_ENV: JSON.stringify(process.env.NODE_ENV)
    }
  }),
  new HtmlWebpackPlugin({
    template: "./index.html",
    inject: "body"
  })
];

console.log("IS PRODUCTION", IS_PRODUCTION);

module.exports = {
  devtool: "eval",
  entry: IS_PRODUCTION
    ? ["./src/index"]
    : ["webpack-dev-server/client?http://localhost:3001", "./src/index"],
  output: {
    path: path.join(__dirname, "build"),
    filename: "[name].[hash].js",
    publicPath: ""
  },
  resolve: {
    extensions: [".js", ".ts", ".tsx", ".css"],
    modules: ["node_modules", path.resolve("./")]
  },
  optimization: {
    minimize: IS_PRODUCTION
  },
  mode: IS_PRODUCTION ? "production" : "development",
  plugins: basePlugins,
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: "awesome-typescript-loader"
          }
        ],
        include: path.join(__dirname, "src")
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"]
      }
    ]
  }
};
