import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Service Forge',
  description: 'Service Forge 微服务框架与脚手架工具文档',
  lang: 'zh-CN',
  base: '/',
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    logo: { text: 'SF' },
    siteTitle: 'Service Forge',
    nav: [
      { text: '指南', link: '/guide/getting-started' },
      { text: '架构', link: '/guide/architecture' },
      { text: '参考', link: '/reference/project-structure' }
    ],
    sidebar: [
      {
        text: '开始使用',
        items: [
          { text: '项目介绍', link: '/' },
          { text: '快速开始', link: '/guide/getting-started' },
          { text: '架构说明', link: '/guide/architecture' }
        ]
      },
      {
        text: '使用指南',
        items: [
          { text: 'CLI 命令', link: '/guide/cli' },
          { text: '开发业务接口', link: '/guide/develop-business-api' },
          { text: '运行时组件', link: '/guide/runtime-components' },
          { text: '配置系统', link: '/guide/configuration' },
          { text: 'Gateway 插件', link: '/guide/gateway-plugins' },
          { text: '扩展组件', link: '/guide/extension' }
        ]
      },
      {
        text: '参考',
        items: [
          { text: '项目结构', link: '/reference/project-structure' },
          { text: '基准测试', link: '/reference/benchmarks' },
          { text: '排查问题', link: '/reference/troubleshooting' }
        ]
      }
    ],
    search: {
      provider: 'local'
    },
    footer: {
      message: 'Built for the Service Forge project.',
      copyright: 'Released as project documentation.'
    },
    editLink: {
      pattern: '../docs/docs/:path',
      text: '编辑此页'
    },
    docFooter: {
      prev: '上一页',
      next: '下一页'
    },
    outline: {
      label: '本页内容',
      level: [2, 3]
    },
    lastUpdated: {
      text: '最后更新'
    }
  }
})
