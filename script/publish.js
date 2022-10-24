const { Command } = require("commander");
const shell = require("shelljs");
const fs = require("fs");
const path = require("path");
const { simpleGit } = require("simple-git");
const git = simpleGit();
const { version } = require("../package.json");

const program = new Command();

// 这里其实和 build.js 可以形成复用，为了方便查看，暂时不做复用处理
// 使用方式：node script/publish.js --outdir=dist --flat
program
  .version(version)
  // 使用 --no-flat 用于默认平铺，不传任何参数的情况下 opt.flat = true
  .option("--no-flat", "不对构建目录进行平铺")
  .option("--outdir <outdir>", "构建目录");
program.parse(process.argv);
const opts = program.opts();
console.log('opts: ', opts)
// 默认的构建目录为 dist
opts.outdir = opts.outdir || "dist";

const publish = {

  // 项目构建目录的绝对路径
  outdir: path.join(__dirname, '../', opts.outdir),

  async run() {
    // 发布分支检测
    await this.checkBranch();
    // 发布构建内容检测
    await this.checkBuild();
    // 执行发布操作
    await this.publish();
  },

  // 发布策略： 
  // 1、发布只能基于 master 分支进行（在 checkBranch 函数中进行卡口设置）
  // 2、所有的开发不能将本地 master 分支的变更 push 到远程的 master 分支（在 Github 上进行分支保护设置）
  // 3、所有的开发不能对本地 master 分支进行变更后再发布操作，防止本地偷偷发布没有 Code Review 的代码（在 checkBranch 函数中进行卡口设置）
  async checkBranch() {
    const branch = await git.branchLocal();
    if (!/^master$/.test(branch?.current)) {
      // 这里以 github 为例，进行打印说明
      console.error(
        `[发布错误]: 发布分支只能为 master 分支，请提交 Pull Request 和 Code Review 流程进行发布！`
      );
      process.exit(0);
    }
    // 确保当前的 master 分支的文件没有变更
    const status = await git.status();
    if(status?.files?.length) {
      console.error(
        "[发布错误]: 不允许更改本地 master 代码！"
      );
      process.exit(0);
    }
    // 确保当前 master 分支的代码和远程代码一致（防止本地偷偷发布没有 Code Review 的代码）
    // 有没有其他方式可以比较本地 master 和远程 master 分支是一致的？
    const { stdout } = shell.exec('git diff origin/master master', { silent: true });
    // 如果有打印信息，则说明存在差异
    if(stdout) {
      console.error(
        `[发布错误]: 发布之前确保本地 master 分支和远程 master 分支内容一致！`
      );
      process.exit(0);
    }
  },


  async checkBuild() {
    // 检测是否存在 package.json 文件
    const packagePath = path.join(this.outdir, 'package.json');
    if(!fs.existsSync(packagePath)) {
      console.error(
        `[发布错误]: ${opts.outdir} 目录下没有 package.json，请检查构建是否正确！`
      );
      process.exit(0);
    }
    // 检测是否存在 README.md 文件
    const readmePath = path.join(this.outdir, 'README.md');
    if(!fs.existsSync(readmePath)) {
      console.error(
        `[发布错误]: ${opts.outdir} 目录下没有 README.md，请检查构建是否正确！`
      );
      process.exit(0);
    }
    // TODO: 通过 flat 参数来检测 opts.outdir 目录是否已经平铺（可以通过检测是否存在文件夹进行判断）
  },


  publish() {
    // 进入 opts.outdir 目录（自动化以后可以防止在根目录进行发布的误操作）
    shell.cd(this.outdir)
    // 执行发布操作
    // 在平常使用的时候，是否可以设计一个函数，可以获取当前环境的 cnpm、npm 以及 yarn 的使用优先级，例如 shell.exec(`${getCurrentNpm()} publish`)
    if(shell.exec('npm publish').code !== 0) {
      // TODO: 可以生成发布的错误日志
    }
    // TODO: 可以生成发布的成功日志，如果是非 CI/CD 发布
  }
};

publish.run();
