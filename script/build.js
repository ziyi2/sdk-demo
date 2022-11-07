const shell = require("shelljs");
const glob = require("glob");
const fs_extra = require("fs-extra");
const fs = require("fs");
const path = require("path");


// package.json 中的 config 参数：https://docs.npmjs.com/cli/v8/configuring-npm/package-json#config
// 思考一下，如果要和 puiblish.js 中的参数获取形成复用能力
const env = process.env;
const outdir = env.npm_package_config_outdir;
const flat = env.npm_package_config_flat;

const build = {
  // 项目根目录路径
  rootPath: path.join(__dirname, "../"),
  // 构建目录路径
  distPath: path.join(__dirname, "../", outdir),

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
    fs_extra.emptyDirSync(this.distPath);
  },

  gulp() {
    // 构建参数
    // --color: 构建时打印带颜色的日志
    shell.exec(`gulp --color`, {
      // 构建同步执行
      async: false,
      // 构建失败则退出进程
      fatal: true,
    });
  },

  flat() {
    // 如果没有平铺参数，则不进行平铺处理
    if (!flat) {
      return;
    }

    // 同步获取构建目录下的所有文件
    // 例如：files:  [
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

    // 平铺目录需要确保不能产生同名文件，例如 dist/A/a.js 和 dist/B/a.js，会因为文件名冲突导致无法生成 dist/a.js
    files.forEach((file) => {
      // 将 dist/A/a.js 转化为 a.js
      const fileName = file.substring(file.lastIndexOf("/") + 1);
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
      // 例如在 src/index.ts 中需要引入 A/a.ts，使用 gulp 构建后是 require("./A/a");
      // 但是目录平铺之后 index.js 和 a.js 同级，因此希望将目标代码更改为 require("./a"); 需要去掉中间的目录路径 A

      //   ├── src
      //   │   ├── add.ts
      //   │   ├── A/
      //   │   │   ├── B/
      //   │   │   │   └── b.ts
      //   │   │   └── a.ts
      //   │   └── C/
      //   │   		└── c.ts
      //   ├── dist
      //   │   ├── package.json     # 新增包描述文件
      //   │   ├── add.js
      //   │   ├── a.js
      //   │   ├── b.js
      //   │   ├── c.js
      //   │   ├── d.js
      //   │   ├── index.js

      // 例如: require('./A/a') => require('./a')
      code = code.replace(/(?<=require\(")(.*?)(?="\))/g, (match) => {
        if (!match) {
          return match;
        }
        // 例如： match = './A/a'
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

      // 删除当前目录下的目标文件，例如 dist/A/a.js
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
      // 如果文件夹为空，则删除文件夹（注意从内到外进行删除，A/B 的情况下先删除 B 文件夹，再删除 A 文件夹）
      if (!subdirs?.length) {
        fs.rmdirSync(dir);
      }
    });
  },

  // 在项目根目录下使用 package.json 进行 NPM 发布，项目的引入路径为 import xxx from 'ziyi-sdk-demo/${outdir}/xxx'
  // 如果将 package.json 拷贝到 outdir 目录下并进入 outdir 目录进行发布，则引入路径为 import xxx from 'ziyi-sdk-demo/xxx'
  // 除此之外，天然解决了需要在 package.json 中配置 files 字段或者在项目目录中配置 .npmignore 的问题
  prepublish() {
    // 拷贝 package.json 到 outdir 目录下
    // TIPS: 可以去除一些开发者不需要感知的开发态信息，例如 scripts、devDependencies
    fs.copyFileSync(
      path.join(this.rootPath, "package.json"),
      path.join(this.distPath, "package.json")
    );

    // 拷贝 README.md 到 outdir 目录下
    fs.copyFileSync(
      path.join(this.rootPath, "README.md"),
      path.join(this.distPath, "README.md")
    );
  },
};

// 运行构建
build.run();