# 点筹司

一个在浏览器中运行的课程抽签投点优化器。它根据课程名额、竞争人数、竞争者投点分布和个人偏好，计算各门课程的中签概率曲线，再用整数动态规划分配总点数。

## 本地运行

需要 Node.js 22.13 或更高版本。

```bash
npm ci
npm run local:dev
```

构建可直接部署的本地静态版本：

```bash
npm run local:build
```

## GitHub Pages

构建 GitHub Pages 版本：

```bash
npm run pages:build
```

产物位于 `dist-pages/`。推送到 `main` 分支后，GitHub Actions 会自动构建并发布：

<https://flowwalker.github.io/dianchousi/>

## 计算方法

- 平均投点假设使用闭式概率公式。
- 均匀、正态和离散混合分布使用指数竞赛蒙特卡洛。
- 可把任一竞争者分布质数化：保留 0 与 99，其余投点映射到最近质数，等距时各以一半概率选择。
- 支持概率和、加权概率和、概率积及加权概率积四种目标。
- 最终的整数投点分配由动态规划求得全局最优解。

所有输入与计算均留在浏览器本地，不上传课程数据。
