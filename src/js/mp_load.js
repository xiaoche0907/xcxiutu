window.MediaPipeModule = null; 
window.MediaPipeLoaded = false; 
function showLoadingStatus() { } 
function hideLoadingStatus() { }


function showTipDialog(text) {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #282828;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        padding: 20px;
        max-width: 400px;
        text-align: center;
        z-index: 10001;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        color: #b8b8c8;
    `;
    const tipText = document.createElement('p');
    tipText.textContent = text;
    tipText.style.cssText = `
        margin: 20px 30px;
        font-size: 0.95rem;
        line-height: 1.5;
    `;
    const btnWrap = document.createElement('div');
    btnWrap.style.cssText = `
        display: flex;
        justify-content: center;
        gap: 15px;
    `;
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '确定';
    confirmBtn.style.cssText = `
        background: #0187ff;
        color: white;
        border: none;
        border-radius: 5px;
        padding: 8px 20px;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.3s ease;
    `;
    confirmBtn.onmouseover = () => {
        confirmBtn.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
    };
    confirmBtn.onmouseout = () => {
        confirmBtn.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.3)';
    };
    confirmBtn.addEventListener('click', () => {
        document.body.removeChild(dialog);
    });
    btnWrap.appendChild(confirmBtn);
    dialog.appendChild(tipText);
    dialog.appendChild(btnWrap);
    document.body.appendChild(dialog);
}

async function loadMediaPipeModule() { 
    try {
        showLoadingStatus(); 
        const vision = await import("http://iceai.cc/iceaiapp/MD_iceai_0.1.2@xingxing/iceai_icecream_md@xingxing2026/vision_bundle.mjs"); 
        window.MediaPipeModule = vision; 
        window.MediaPipeLoaded = true; 
    } catch (error) {
        showTipDialog('MP模块加载失败，请检查网络或重启');
    } finally {
        hideLoadingStatus(); 
    } 
}
document.addEventListener('DOMContentLoaded', loadMediaPipeModule);