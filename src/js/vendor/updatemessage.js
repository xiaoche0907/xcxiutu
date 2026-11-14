document.addEventListener('DOMContentLoaded', function() {
if (!localStorage.getItem('hasSeenGuide')) {
createGuideModal();
} else if (!localStorage.getItem('hasSeenGuide3')) {
createGuideModal2();
}
});
function createGuideModal() {
const modal = document.createElement('div');
modal.className = 'guide-modal';
modal.style.cssText = `
position: fixed;
top: 0;
left: 0;
width: 100%;
height: 100%;
background: rgba(0, 0, 0, 0.8);
display: flex;
justify-content: center;
align-items: center;
z-index: 99999;
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
`;
const modalContent = document.createElement('div');
modalContent.style.cssText = `
background: #2d3748;
border-radius: 12px;
width: 800px;
height: 500px;
display: flex;
flex-direction: column;
overflow: hidden;
box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
`;
const modalHeader = document.createElement('div');
modalHeader.style.cssText = `
padding: 10px 20px;
background: #282828;
color: white;
font-size: 18px;
font-weight: bold;
display: flex;
justify-content: space-between;
align-items: center;
`;
modalHeader.innerHTML = `
<span>小彻工坊 v4.1.0/4.2.0 版本说明</span>
<button class="guide-close-btn" style="background: transparent; color: #ff6b6b; border: none; padding: 8px; border-radius: 50%; cursor: pointer; font-size: 24px; display: flex; align-items: center; justify-content: center; transition: color 0.2s ease;">×</button>
`;
setTimeout(() => {
const closeBtn = document.querySelector('.guide-close-btn');
if (closeBtn) {
closeBtn.addEventListener('mouseenter', () => {
closeBtn.style.color = '#ff8787';
});
closeBtn.addEventListener('mouseleave', () => {
closeBtn.style.color = '#ff6b6b';
});
}
}, 100);
const modalBody = document.createElement('div');
modalBody.style.cssText = `
flex: 1;
display: flex;
position: relative;
overflow: hidden;
`;
const pages = [
{
title: '✨本次更新｜性能升级',
content: '✅ 人像磨皮祛痘、去黑眼圈、祛皱、中性灰平整、高低频 / 水润 / 表面磨皮、衣服瑕疵等算法全面优化，处理速度提升 2–6 倍\n\n✅ 深度内存优化，告别越用越卡，长时间修图更流畅\n\n✅ 白平衡、色温色调矫正算法重构，调色采样逻辑升级，曝光与色彩调整更精准自然\n\n✅ 五官重塑底层重构，整组滑块渲染低至 从300ms提速到30ms，拖拽可达半实时（还差一点）\n\n✅ 4.2.0（win版本）修复win版本导入raw后偏色严重、白屏的问题'
}
];
pages.forEach((page, index) => {
const pageElement = document.createElement('div');
pageElement.className = 'guide-page';
pageElement.style.cssText = `
position: absolute;
top: 0;
left: ${index * 100}%;
width: 100%;
height: 100%;
display: flex;
transition: left 0.3s ease;
`;
const textContainer = document.createElement('div');
textContainer.style.cssText = `
flex: 1;
padding: 60px;
display: flex;
flex-direction: column;
justify-content: center;
color: white;
`;
if (page.image) {
const imageContainer = document.createElement('div');
imageContainer.style.cssText = `
flex: 1;
padding: 20px;
display: flex;
align-items: center;
justify-content: center;
`;
const image = document.createElement('img');
image.src = page.image;
image.style.cssText = `
max-width: 100%;
max-height: 100%;
border-radius: 8px;
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
`;
imageContainer.appendChild(image);
pageElement.appendChild(imageContainer);
}
const titleElement = document.createElement('div');
titleElement.style.cssText = `
font-size: 24px;
font-weight: bold;
margin-bottom: 20px;
color: #ffffffff;
`;
titleElement.textContent = page.title;
const contentElement = document.createElement('div');
contentElement.style.cssText = `
font-size: 14px;
line-height: 1.8;
color: #d1d5db;
white-space: pre-line;
`;
contentElement.textContent = page.content;
textContainer.appendChild(titleElement);
textContainer.appendChild(contentElement);
pageElement.appendChild(textContainer);
modalBody.appendChild(pageElement);
});
const modalFooter = document.createElement('div');
modalFooter.style.cssText = `
padding: 10px 20px;
background: #282828;
display: flex;
justify-content: space-between;
align-items: center;
`;
const pageIndicator = document.createElement('div');
pageIndicator.style.cssText = `
display: flex;
gap: 10px;
`;
pages.forEach((_, index) => {
const dot = document.createElement('div');
dot.className = 'guide-dot';
dot.style.cssText = `
width: 12px;
height: 12px;
border-radius: 50%;
background: ${index === 0 ? '#51cf66' : '#4a5568'};
transition: background 0.3s ease;
`;
pageIndicator.appendChild(dot);
});
const navButtons = document.createElement('div');
navButtons.style.cssText = `
display: flex;
gap: 10px;
`;
navButtons.innerHTML = `
<button class="guide-prev-btn header-buttons1" style="display: none; min-width: 100px;  border: none; border-radius: 3px; cursor: pointer; background: #4a5568; color: white; font-size: 12px; display: flex; align-items: center; justify-content: center;">上一步</button>
<button class="guide-next-btn header-buttons" style="min-width: 100px;  border: none; border-radius: 3px; cursor: pointer; background: #0187ff; color: white; font-size: 12px; display: flex; align-items: center; justify-content: center;">下一步</button>
`;
modalFooter.appendChild(pageIndicator);
modalFooter.appendChild(navButtons);
modalContent.appendChild(modalHeader);
modalContent.appendChild(modalBody);
modalContent.appendChild(modalFooter);
modal.appendChild(modalContent);
document.body.appendChild(modal);
let currentPage = 0;
const pageElements = document.querySelectorAll('.guide-page');
const dots = document.querySelectorAll('.guide-dot');
const prevBtn = document.querySelector('.guide-prev-btn');
const nextBtn = document.querySelector('.guide-next-btn');
const closeBtn = document.querySelector('.guide-close-btn');
function updatePage() {
pageElements.forEach((page, index) => {
page.style.left = `${(index - currentPage) * 100}%`;
});
dots.forEach((dot, index) => {
dot.style.background = index === currentPage ? '#51cf66' : '#4a5568';
});
prevBtn.style.display = currentPage === 0 ? 'none' : 'block';
nextBtn.textContent = currentPage === pages.length -1 ? '完成' : '下一步';
const buttonWidth = Math.max(prevBtn.offsetWidth, nextBtn.offsetWidth);
prevBtn.style.minWidth = `${buttonWidth}px`;
nextBtn.style.minWidth = `${buttonWidth}px`;
}
prevBtn.addEventListener('click', () => {
if (currentPage >0) {
currentPage--;
updatePage();
}
});
nextBtn.addEventListener('click', () => {
if (currentPage < pages.length -1) {
currentPage++;
updatePage();
} else {
modal.remove();
localStorage.setItem('hasSeenGuide', 'true');
createGuideModal2();
}
});
updatePage();
closeBtn.addEventListener('click', () => {
modal.remove();
localStorage.setItem('hasSeenGuide', 'true');
createGuideModal2();
});
}
function createGuideModal2(options) {
// membership modal removed (AI interface will be user-provided)
localStorage.setItem('hasSeenGuide3', 'true');
return;
}

