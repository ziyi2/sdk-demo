var gulp = require("gulp");
var ts = require("gulp-typescript");
var tsProject = ts.createProject("tsconfig.json");

// 获取 gulp 的参数，例如 gulp --outdir=dist --color， 则 opts = { _: [], outdir: 'dist', color: true }
// const opts = require('minimist')(process.argv.slice(2));

gulp.task("default", function () {
  // tsProject.src() 默认会基于 tsconfig.json 中的 files、exclude 和 include 指定的源文件进行编译
  return tsProject
    .src()
    .pipe(tsProject())
    .js.pipe(gulp.dest(process.env.npm_package_config_outdir));
});
