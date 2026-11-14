const versionInfo = {
    currentVersion: "4.1.0",
    latestVersion: "4.5.2",
    updateUrl: "http://iceai.cc", 
    downloadUrls: {
        
        
    },
    releaseNotes: [
        "升级中性灰平整",
        "新增中性灰立体、质感磨皮",
        "新增祛碎发、祛影棚背景瑕疵",
        "支持输入编辑滑块参数",
        "修复批量导入内存爆满崩溃bug",
        "mac版新增支持常见的佳能索尼和尼康联机拍摄"
    ]
};
if (typeof module !== 'undefined' && module.exports) {
    module.exports = versionInfo;
} else if (typeof window !== 'undefined') {
    window.versionInfo = versionInfo;
}
