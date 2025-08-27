將書架重新設計，帮我用类似苹果发布会PPT的Bento Grid风格的视觉设计重新設計書架，引用背景图片，背景图片在Assets底下有個shelf.jpg

网页具体要求为：

使用Bento Grid风格的视觉设计，尽量在一页展示所有内容，文字颜色为白色，高亮文字色为苹果标志性的渐变，讓PDF封面圖片變成带有玻璃质感的卡片，卡片不需要深色背景
以封面為大元素，與標題小元素的比例形成反差
网页需要以响应式兼容更大的显示器宽度比如1920px及以上
中英文混用，中文大字体粗体，英文小字作为点缀
运用高亮色自身透明度渐变制造科技感，但是不同高亮色不要互相渐变
使用HTML5、TailwindCSS 3.0+（通过CDN引入）和必要的JavaScript
字体引用 Google Font 的字体
卡片样式参考如下实现方式：
菜单项
CSS样式：/* 容器 */.liquidGlass-wrapper { position: relative;
display: flex;
overflow: hidden; padding: 0.6rem; border-radius: 2rem; cursor: pointer; box-shadow: 0 6px 6px rgba(0, 0, 0, 0.2), 0 0 20px rgba(0, 0, 0, 0.1); transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 2.2);}/* Hover效果 /.liquidGlass-wrapper:hover { padding: 0.8rem; border-radius: 2.5rem;}/ 扭曲层 */.liquidGlass-effect {
position: absolute; z-index: 0; inset: 0; backdrop-filter: blur(3px); filter: url(#glass-distortion);
}/* 色调层 */.liquidGlass-tint {
position: absolute; z-index: 1; inset: 0; background: rgba(255, 255, 255, 0.25);}/* 光泽层 */.liquidGlass-shine {
position: absolute; z-index: 2; inset: 0; box-shadow: inset 2px 2px 1px 0 rgba(255, 255, 255, 0.5), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.5);}/* 内容层 */.liquidGlass-text {
position: relative; z-index: 3; transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 2.2);}
.liquidGlass-wrapper:hover .liquidGlass-text { transform: scale(0.95);}/* 子项样式 */.menu-item { padding: 0.4rem 0.6rem; border-radius: 0.8rem; transition: all 0.1s ease-in;}
.menu-item:hover { background-color: rgba(255, 255, 255, 0.5); box-shadow: inset -2px -2px 2px rgba(0, 0, 0, 0.1); backdrop-filter: blur(2px);}