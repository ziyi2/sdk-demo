const { Command } = require("commander");
const shell = require("shelljs");
const glob = require("glob");
const fs_extra = require("fs-extra");
const fs = require("fs");
const path = require("path");
const { version } = require("../package.json");

const program = new Command();

// 使用方式：node script/build.js --outdir=dist --flat
program
  .version(version)
  // 使用 --no-flat 用于默认平铺，不传任何参数的情况下 opt.flat = true
  // 这里也可以使用 --flat，这样构建命令必须传入 --flat 才能进行平铺
  .option("--no-flat", "不对构建目录进行平铺")
  .option("--outdir <outdir>", "构建目录");
program.parse(process.argv);
const opts = program.opts();
// 默认的构建目录为 dist
opts.outdir = opts.outdir || "dist";

const build = {
  // 项目根目录路径
  rootPath: path.join(__dirname, "../"),
  // 构建目录路径
  distPath: path.join(__dirname, "../", opts.outdir),

  run() {
    // 清除构建目录
    this.clear();
    // 同步执行 gulp 构建
    this.gulp();
    // 构建完成后，平铺构建目录
    this.flat();
    // 平铺完成后，准备发布 NPM 包
    this.prepublish();
  },

  clear() {
    fs_extra.emptyDirSync(opts.outdir);
  },

  gulp() {
    // 构建参数
    // --outdir: 构建目录
    // --color: 构建时打印带颜色的日志

    // shelljs 执行参数
    // async: false => 构建同步执行
    // fatal: true  => 构建失败则退出进程
    shell.exec(`gulp --outdir=${opts.outdir} --color`, {
      async: false,
      fatal: true,
    });
  },

  flat() {
    // 如果没有平铺参数，则不进行平铺处理
    if (!opts.flat) {
      return;
    }

    // 同步获取构建目录下的所有文件
    // files:  [
    //     'dist/A',
    //     'dist/A/a.js',
    //     'dist/A/B',
    //     'dist/A/B/b.js',
    //     'dist/add.js',
    //     'dist/C',
    //     'dist/C/c.js'
    //   ]
    const files = glob.sync(`${this.distPath}/**/*.js`);
    const fileRepeatMap = {};

    // 平铺目录需要确保不能产生同名文件，例如 dist/A/a.js 和 dist/B/a.js，会因为文件名冲突无法生成 dist/a.js
    files.forEach((file) => {
      // 将 dist/A/a.js 转化为 a.js
      const fileName = file.substring(file.lastIndexOf("/") + 1);
      // { "a.js": [] }
      const fileRepeatArr = fileRepeatMap[fileName];
      // 存储 a.js 为文件名的文件路径数组，例如 { "a.js": ["dist/A/a.js"] }
      fileRepeatMap[fileName] = fileRepeatArr
        ? [...fileRepeatArr, file]
        : [file];
      // 如果 a.js 的文件路径存在多个，则提示错误并退出进程，例如 { "a.js": ["dist/A/a.js", "dist/B/a.js" ] }
      if (fileRepeatMap[fileName]?.length > 1) {
        console.error("[编译错误] 编译不允许具备相同的文件名称: ", fileName);
        console.error(
          "[编译错误] 相同的文件名称路径：",
          fileRepeatMap[fileName].join(", ")
        );
        // 清除构建目录
        this.clear();
        // 退出构建
        process.exit();
      }
    });

    // 如果没有同名文件，则进行文件平铺
    files.forEach((file) => {
      // 获取构建文件的目标代码
      let code = fs.readFileSync(file).toString();

      // 正则说明：
      // (?<=require\(")(.*?)(?="\)) 主要分为三部分: (?<=require\(")、(.*?)、(?="\))
      // (?<=require\("): 反向肯定预查, ?<=pattern, 用于匹配以 require(" 开头的字符串，注意 require\(" 是转义后的字符串，匹配的是 require("
      // (.*?): 用于匹配最短路径的内容，其中 ? 用于非贪婪匹配, * 是贪婪匹配，? 是只能匹配 0 ~ 1 次
      // (?="\)): 正向肯定预查，?=pattern, 用于匹配以 ") 结尾的字符串，注意 "\) 是转义后的字符串，匹配的是 ")

      // 正则场景解释:
      // 例如压缩后的代码： require("./common/e"),fs_1=__importDefault(require("fs")
      // 通过 (.*) 匹配后默认会匹配到 ./common/e"),fs_1=__importDefault(require("fs
      // 通过 (.*?) 匹配后默认会匹配到 ./common/e 和 fs
      // 其中 ? 的作用用于贪婪匹配中的 0 ~ 1 次, 从而阻止了 * 的 0 ~ n 次贪婪匹配

      // 平铺目录后需要将引入路径进行更改，因为平铺后目标文件的位置发送了变化，因此被引用的路径也需要改变
      // 例如在 src/add.ts 中需要引入 A/a.ts，则需要使用 import { a } from './A/a'
      // 使用 gulp 构建后，如果目录没有平铺，默认是 var a_1 = require("./A/a");
      // 但是这里希望目录可以平铺，平铺之后的结构是 add.js 和 a.js 同级，因此希望将构建代码更改为 var a_1 = require("./a"); 需要去掉中间的目录路径 A

      //   ├── src
      //   │   ├── add.ts
      //   │   ├── A/
      //   │   │   ├── B/
      //   │   │   │   └── b.ts
      //   │   │   └── a.ts
      //   │   └── C/
      //   │   		└── c.ts
      //   ├── lib
      //   │   ├── package.json     # 新增包描述文件
      //   │   ├── add.js
      //   │   ├── a.js
      //   │   ├── b.js
      //   │   ├── c.js
      //   │   ├── d.js

      // 例如: require('./A/a') => require('./a')
      code = code.replace(/(?<=require\(")(.*?)(?="\))/g, (match) => {
        if (!match) {
          return match;
        }
        // match: ./A/a
        const paths = match.split("/");
        // 获取文件名
        const fileName = paths.concat().pop();
        // 不需要更改的引用路径，例如 require("lodash")
        if (!fileName || paths.length === 1) {
          return match;
        }
        console.info(
          `[编译信息] 在文件 ${file} 中匹配和替换的 require 路径: `,
          `${match} => ./${fileName}`
        );
        // 平铺后直接引入同级目录下的文件
        return `./${fileName}`;
      });

      // TODO: 如果需要生成 sourcemap，则 sourcemap 的路径也需要处理

      // 删除当前目录下的目标文件
      fs.rmSync(file);

      // 将 dist/A/a.js 转化为 a.js
      const fileName = file.substring(file.lastIndexOf("/") + 1);
      // 生成平级文件的写入路径
      const fileOutputPath = path.join(this.distPath, fileName);
      // 写入更改后的目标代码
      fs.writeFileSync(fileOutputPath, code);
    });

    // 平铺完成后，匹配文件夹并删除空的文件夹
    // 匹配文件夹：to match only directories, simply put a / at the end of the pattern.
    // 反转以后可以从内到外进行文件夹删除（先删除内部的子文件夹）
    const dirs = glob.sync(`${this.distPath}/**/`).reverse();

    dirs.forEach((dir) => {
      const subdirs = fs.readdirSync(dir);
      // 如果文件夹为空，则删除文件夹（注意由于从内到外进行删除，因为 A/B 的情况下先删除 B，然后再删除 A）
      if (!subdirs?.length) {
        fs_extra.rmdirSync(dir);
      }
    });
  },

  prepublish() {
    // 拷贝 package.json 到 opts.outdir 目录下
    fs.copyFileSync(
      path.join(this.rootPath, "package.json"),
      path.join(this.distPath, "package.json")
    );

    // 拷贝 README.md 到 opts.outdir 目录下
    fs.copyFileSync(
      path.join(this.rootPath, "README.md"),
      path.join(this.distPath, "README.md")
    );
  },
};

// 运行构建
build.run();
