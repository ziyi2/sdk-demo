var gulp = require("gulp");
var ts = require("gulp-typescript");
var tsProject = ts.createProject("tsconfig.json");

gulp.task("default", function () {
  // tsProject.src() 默认会基于 tsconfig.json 中的 files、exclude 和 include 指定的源文件进行编译
  return tsProject.src().pipe(tsProject()).js.pipe(gulp.dest("lib"));
});
