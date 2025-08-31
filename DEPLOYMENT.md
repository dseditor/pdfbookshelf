# PDF Bookshelf 部署指南

本项目支持两种部署方式：GitHub Pages 和 HuggingFace Repository。

## 🚀 快速切换部署平台

在 `bento-script.js` 文件中修改配置：

```javascript
const DEPLOYMENT_CONFIG = {
    platform: 'huggingface', // 改为 'huggingface' 启用HF模式
    huggingface: {
        repoId: 'your-username/your-repo-name', // 替换为你的HF仓库ID
        apiBase: 'https://huggingface.co/api'
    }
};
```

## 📋 两种部署方式对比

| 特性 | GitHub Pages | HuggingFace Repository |
|------|--------------|------------------------|
| 中文文件名支持 | ❌ 需要英文重命名 | ✅ 完全支持 |
| 自动文件发现 | ⚠️ 有限模式匹配 | ✅ 完整API支持 |
| JSON映射需求 | ✅ 必需 | ❌ 可选 |
| 部署复杂度 | 🟢 简单 | 🟡 中等 |
| 访问速度 | 🟢 快 | 🟡 中等 |

## 🔧 GitHub Pages 部署

### 1. 文件要求
- PDF文件名必须为英文（如：`kirby-world-architecture.pdf`）
- 每个分类需要 `filenames.json` 映射中文标题

### 2. 文件结构
```
PDF/
├── Architectural/
│   ├── filenames.json
│   ├── kirby-world-architecture.pdf
│   └── kuma-world-rilakkuma-architecture.pdf
├── Design/
│   ├── filenames.json
│   ├── hoob-cute-style.pdf
│   └── rilakkuma-photo-collection.pdf
└── ...
```

### 3. JSON映射示例
```json
{
  "kirby-world-architecture.pdf": "KirbyWorld卡比建築風格",
  "kuma-world-rilakkuma-architecture.pdf": "KumaWorld拉拉熊建築風格"
}
```

## 🤗 HuggingFace Repository 部署

### 1. 创建HF仓库
1. 访问 [HuggingFace](https://huggingface.co/)
2. 创建新的 Dataset 或 Space 仓库
3. 记录仓库ID（格式：`username/repo-name`）

### 2. 上传文件
可以直接使用中文文件名！
```
PDF/
├── Architectural/
│   ├── KirbyWorld卡比建築風格.pdf
│   ├── KumaWorld拉拉熊建築風格.pdf
│   └── 熊熊世界甜點.pdf
├── Design/
│   ├── Hoob文具可愛風格.pdf
│   ├── 拉拉熊文具攝影特集.pdf
│   └── 拉拉熊文具台灣街景.pdf
└── ...
```

### 3. 配置代码
```javascript
const DEPLOYMENT_CONFIG = {
    platform: 'huggingface',
    huggingface: {
        repoId: 'your-username/pdf-bookshelf', // 替换为实际仓库ID
        apiBase: 'https://huggingface.co/api'
    }
};
```

### 4. 部署到HF Spaces（可选）
- 创建 HuggingFace Space
- 上传所有文件到Space
- 自动获得在线URL

## ⚡ 优势总结

### HuggingFace 模式优势：
1. **✅ 完全支持中文文件名** - 无需重命名或编码
2. **✅ 自动文件发现** - 上传新PDF自动显示
3. **✅ 简化管理** - 无需维护JSON映射文件
4. **✅ API支持** - 可以通过API获取完整文件列表

### GitHub Pages 模式优势：
1. **✅ 访问速度快** - GitHub CDN加速
2. **✅ 无需额外账号** - 使用现有GitHub账号
3. **✅ 版本控制** - Git管理文件历史

## 🔄 迁移指南

### 从 GitHub Pages 迁移到 HuggingFace：

1. 将英文PDF文件重命名回中文原名
2. 创建HF仓库并上传文件
3. 修改 `DEPLOYMENT_CONFIG.platform = 'huggingface'`
4. 配置正确的 `repoId`

### 从 HuggingFace 迁移到 GitHub Pages：

1. 将中文PDF文件重命名为英文
2. 创建各分类的 `filenames.json` 映射文件
3. 修改 `DEPLOYMENT_CONFIG.platform = 'github-pages'`

## 🐛 调试功能

打开浏览器F12控制台，可以看到详细的调试信息：

- `[DEBUG] 当前部署平台: xxx`
- `[DEBUG] HF发现文件: xxx.pdf` （HF模式）
- `[DEBUG] 使用JSON映射标题: xxx` （GitHub模式）

手动重新扫描文件：
```javascript
rescanAllFiles()
```

清除所有缓存：
```javascript
clearAllCaches()
```