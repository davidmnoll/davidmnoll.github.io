module.exports = {
  transpileDependencies: ["vuetify"],
  publicPath: process.env.NODE_ENV !== "develop" ? "/dist/" : "/",
  indexPath: "../index.html",
};
