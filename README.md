# webgis111

本模板可帮助你基于 Vite 快速开始 Vue 3 项目开发。

## 推荐的 IDE 设置

建议使用 [VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)（并禁用 Vetur）。

## 个性化配置

详见 [Vite 配置文档](https://vite.dev/config/)。

## 项目安装

```sh
npm install
```

### 开发环境编译与热重载

```sh
npm run dev
```

### 生产环境编译与压缩

```sh
npm run build
```

---

## 如何将你的 GitHub 前端项目部署成网站

### 1. 确认你的项目已推送到 GitHub

你已经完成了这一步。

---

### 2. 使用 Netlify、Vercel 或 GitHub Pages 进行部署

#### 推荐方式一：Netlify（适合 Vue/Vite/React 等现代前端项目）

1. 访问 [https://www.netlify.com/](https://www.netlify.com/) 并注册/登录。
2. 点击 "Add new site" → "Import an existing project"。
3. 选择 GitHub 并授权，找到你的仓库（如 `webgis111`）。
4. 配置构建命令和发布目录：
   - 构建命令：`npm run build`
   - 发布目录：`dist`
5. 点击 "Deploy Site"，等待自动构建和发布。
6. 部署完成后，Netlify 会给你一个访问网址（可自定义域名）。

---

你的 Netlify 部署失败的原因如下：

**报错关键信息：**
```
[vite:css] Preprocessor dependency "sass-embedded" not found. Did you install it? Try `npm install -D sass-embedded`.
file: /opt/build/repo/src/views/layout/Header.vue?vue&type=style&index=0&scoped=a6053ce6&lang.scss
```

**原因分析：**
- 你的 `Header.vue` 使用了 `<style lang="scss" scoped>`，这需要 SASS 预处理器支持。
- Netlify 构建时没有自动安装 `sass-embedded`，导致 Vite 构建失败。

**解决方法：**
1. 在你的项目根目录下运行：
   ```sh
   npm install -D sass sass-embedded
   ```
   （`sass` 也可以自动代理到 `sass-embedded`，但建议都装上）

2. **提交 package.json 和 package-lock.json 到 GitHub**，确保依赖被同步到远程仓库。

3. **重新部署 Netlify**，Netlify 会自动安装依赖并成功构建。

---

**总结：**
- 只要你的项目用到 `<style lang="scss">` 或 `<style lang="sass">`，就必须安装 SASS 相关依赖。
- 本地开发没问题，是因为你本地已经装了 sass，云端构建需要 package.json 里有依赖才会自动安装。

---

**命令一键修复：**
```sh
npm install -D sass sass-embedded
git add package.json package-lock.json
git commit -m "fix: add sass dependencies for Netlify build"
git push
```
然后在 Netlify 后台重新部署即可。

---

#### 推荐方式二：Vercel

1. 访问 [https://vercel.com/](https://vercel.com/) 并注册/登录。
2. 新建项目，选择你的 GitHub 仓库。
3. 保持默认构建命令（如 `npm run build`）和输出目录（如 `dist`）。
4. 部署后即可获得访问网址。

#### 方式三：GitHub Pages（适合纯静态项目）

1. 本地执行 `npm run build`，生成 `dist` 目录。
2. 将 `dist` 目录下的内容推送到仓库的 `gh-pages` 分支。
3. 在 GitHub 仓库设置中启用 Pages，选择 `gh-pages` 分支作为发布源。
4. 稍等片刻即可通过 GitHub Pages 域名访问。

---

### 3. 注意事项

- 如果你的项目用到了前端路由（如 vue-router 的 history 模式），Netlify/Vercel 需配置重定向规则防止刷新 404。
- 如需绑定自定义域名，可在 Netlify/Vercel 后台设置。

---

### 4. 参考文档

- [Netlify 官方文档](https://docs.netlify.com/)
- [Vercel 官方文档](https://vercel.com/docs)
- [GitHub Pages 官方文档](https://docs.github.com/en/pages)

---

**总结：**  
只需将你的 GitHub 仓库导入 Netlify/Vercel，配置好构建命令和发布目录，即可几分钟内将你的前端项目发布成网站，无需自己搭建服务器。
