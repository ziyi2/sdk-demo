const { Command } = require("commander");
const shell = require("shelljs");
const glob = require("glob");
const fs_extra = require("fs-extra");
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
// 默认的构建目录为 dist
opts.outdir = opts.outdir || "dist";

const publish = {
  async run() {
    await this.checkBranch();
  },

  async checkBranch() {
    try {
      // 在 github 上可以设置 master 分支为受保护分支: 1、任何开发者不能通过 master 分支进行远程 push 代码  2、必须通过远程的 PR 和 CR 才能进行 master 代码合并
      // 确保没有发布 NPM 权限的开发者只能通过 PR 和 CR 的方式告知发布者在 master 分支进行 merge 发布，从而可以做到发布卡口
      // 除此之外，对于具有发布权限的开发者，必须走正规的发布流程，而不要使用非 master 分支进行发布处理
      const branch = await git.branchLocal();
      if (!/^master$/.test(branch?.current)) {
        // 这里以 github 为例，进行打印说明
        console.error(
          `[发布错误]: 发布分支只能为 master 分支，请提交 Pull Request 和 Code Review 流程进行发布！`
        );
        process.exit(0);
      }

      // 拉取远程最新的分支代码
      // 确保 master 分支需要发布的代码为最新的内容，例如可能遗漏了其他开发者提交的 PR 和  CR 后的已经 merge 的远程 master 分支代码
      const remote = await git.pull("origin", branch?.current);
      console.log("remote: ", remote);
      if(remote?.files?.length) {
        console.error('[发布错误]: 已经拉取最新的 master 分支代码，请重新尝试发布！');
        process.exit(0);
      }
    } catch (err) {
      console.error(err);
      process.exit(0);
    }
  },
};

publish.run();
