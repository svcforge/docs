# Service Forge Docs

这是 `service-forge` 的独立文档站项目，使用 VitePress 构建。

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

构建产物会输出到：

```text
docs/.vitepress/dist
```

## 内容结构

```text
docs/
├── index.md
├── guide/
│   ├── getting-started.md
│   ├── architecture.md
│   ├── cli.md
│   ├── runtime-components.md
│   ├── configuration.md
│   └── extension.md
└── reference/
    ├── project-structure.md
    └── troubleshooting.md
```
