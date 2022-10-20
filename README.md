# ziyi-sdk-demo

## 1、注册 NPM 账号

发布 NPM 包，首先需要注册 NPM 账号：

https://www.npmjs.com/signup


## 2、本地登录 NPM 账号

``` bash
# 执行登录
npm login
npm WARN adduser `adduser` will be split into `login` and `register` in a future version. `adduser` will become an alias of `register`. `login` (currently an alias) will become its own command.
npm notice Log in on https://registry.npmjs.org/
# 输入账号
Username: ziyi22
# 输入密码
Password: 
# 输入邮箱
Email: (this IS public) 18768107826@163.com
npm notice Please check your email for a one-time password (OTP)
# 通过邮箱输入 OTP code（以前好像没有这个）
Enter one-time password: 73326070
Logged in as ziyi22 on https://registry.npmjs.org/.
# 查看账号名
npm whoami
ziyi22
```

>温馨提示：登录的时候不要使用 NPM 淘宝镜像地址，需要使用 NPM 官方地址，可以通过 npm config set registry https://registry.npmjs.org/ 命令设置成 NPM 官方的包发布地址。


## 3、发布 NPM 包

执行构建命令，生成构建的目标文件

``` bash
npm run build
```

构建完成后，进入 `dist` 目录进行发布：

``` bash
# 进入 dist 目录
cd dist
# 发布 NPM 包
npm publish
```
