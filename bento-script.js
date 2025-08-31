// PDF.js配置
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// 全域變數
let currentPdf = null;
let currentPageNum = 1;
let totalPages = 0;
let pdfFiles = [];
let isListView = false;
let currentView = 'categories'; // 'categories' or 'pdfs'
let currentCategory = null;

// 縮圖載入優化
let thumbnailCache = new Map(); // 縮圖快取
let loadingQueue = []; // 載入佇列
let isLoadingThumbnails = false; // 載入狀態
let observerMap = new Map(); // Intersection Observer 映射
let thumbnailLoadingCount = 0; // 當前載入數量

// 定義分類結構
const categories = [
    {
        id: 'architectural',
        name: '建築風格',
        englishName: 'Architectural',
        folder: 'Architectural',
        description: '建築設計相關作品集'
    },
    {
        id: 'design', 
        name: '設計作品',
        englishName: 'Design',
        folder: 'Design',
        description: '文具與產品設計作品'
    },
    {
        id: 'interior',
        name: '室內設計', 
        englishName: 'Interior',
        folder: 'Interior',
        description: '室內空間設計作品'
    },
    {
        id: 'misc',
        name: '雜項收藏',
        englishName: 'Miscellaneous', 
        folder: 'Misc',
        description: '其他類型作品收藏'
    },
    {
        id: 'photo',
        name: '攝影作品',
        englishName: 'Photography',
        folder: 'Photo', 
        description: '攝影與寫真作品集'
    }
];

// 蘋果風格漸變色陣列
const appleGradients = [
    'apple-gradient-blue',
    'apple-gradient-purple', 
    'apple-gradient-green',
    'apple-gradient-orange'
];

document.addEventListener('DOMContentLoaded', function() {
    initializeThumbnailLoader();
    setupProgressTracking();
    displayCategories();
});

// 設置進度追蹤
function setupProgressTracking() {
    const progressContainer = document.getElementById('thumbnailProgress');
    const progressText = document.getElementById('progressText');
    const progressBar = document.getElementById('progressBar');
    
    // 監聽縮圖載入進度
    window.addEventListener('thumbnailProgress', (event) => {
        const { total, remaining, percent } = event.detail;
        
        if (total > 0 && remaining > 0) {
            // 顯示進度
            progressContainer.classList.remove('hidden');
            progressText.textContent = `載入縮圖中... (${total - remaining}/${total})`;
            progressBar.style.width = `${percent}%`;
        } else {
            // 隱藏進度條
            setTimeout(() => {
                progressContainer.classList.add('hidden');
            }, 1000);
        }
    });
}

// 初始化縮圖載入器
function initializeThumbnailLoader() {
    // 設定 PDF.js worker 選項以提升效能
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    
    // 預熱 PDF.js
    warmupPdfJs();
}

// 預熱 PDF.js 以減少首次載入時間
async function warmupPdfJs() {
    try {
        // 創建一個很小的空白 PDF 來預熱 worker
        const dummyPdf = 'data:application/pdf;base64,JVBERi0xLjMKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwKL0xlbmd0aCA0NTIKL0ZpbHRlciAvRmxhdGVEZWNvZGUKPj4Kc3RyZWFtCnic4/PzU3BUcCxLzSsJyswtykvMBRGJSRmpOalFqQqJObmVCvFRCsXl+YXFqZXJALZyDQDW/Q0eIaHMcxfz8Tl5WUfRZZiTlY=' 
        const pdf = await pdfjsLib.getDocument(dummyPdf).promise;
        pdf.destroy();
    } catch (error) {
        console.warn('PDF.js warmup failed:', error);
    }
}

// 獲取檔案統計資訊
async function getFileStats(filePath) {
    try {
        const response = await fetch(filePath, { method: 'HEAD' });
        if (response.ok) {
            return {
                size: response.headers.get('content-length') || '未知',
                modified: response.headers.get('last-modified') || '未知'
            };
        }
    } catch (error) {
        console.warn(`無法獲取檔案資訊: ${filePath}`, error);
    }
    
    // 嘗試獲取檔案的實際內容來估算大小
    try {
        const response = await fetch(filePath);
        if (response.ok) {
            const blob = await response.blob();
            return {
                size: blob.size.toString(),
                modified: response.headers.get('last-modified') || new Date().toISOString()
            };
        }
    } catch (error) {
        console.warn(`無法獲取檔案內容: ${filePath}`, error);
    }
    
    return {
        size: '未知',
        modified: '未知'
    };
}

// 載入指定分類的PDF檔案
async function loadPdfFiles(categoryFolder = null) {
    showLoading(true);
    pdfFiles = [];
    
    try {
        if (categoryFolder) {
            // 載入特定分類的PDF
            await loadCategoryPdfFiles(categoryFolder);
        } else {
            // 載入所有PDF（保留原有邏輯作為備用）
            await loadAllPdfFiles();
        }
        
        if (currentView === 'pdfs') {
            displayBooks();
            displayList();
        }
    } catch (error) {
        console.error('載入PDF檔案失敗:', error);
    }
    
    showLoading(false);
}

// 載入文件名映射JSON
async function loadFilenameMapping(categoryFolder) {
    try {
        const response = await fetch(`./PDF/${categoryFolder}/filenames.json`);
        if (response.ok) {
            const mapping = await response.json();
            console.log(`成功載入 ${categoryFolder} 的文件名映射:`, mapping);
            return mapping;
        }
    } catch (error) {
        console.log(`無法載入 ${categoryFolder} 的文件名映射，將使用原始文件名:`, error);
    }
    return null;
}

// 載入特定分類的PDF檔案
async function loadCategoryPdfFiles(categoryFolder) {
    try {
        // 載入文件名映射
        const filenameMapping = await loadFilenameMapping(categoryFolder);
        
        // 首先嘗試動態掃描資料夾內容
        const scannedFiles = await scanCategoryFolder(categoryFolder);
        
        if (scannedFiles.length > 0) {
            // 成功掃描到檔案，使用掃描結果
            for (const fileName of scannedFiles) {
                try {
                    // 跳過filenames.json文件
                    if (fileName === 'filenames.json') continue;
                    
                    const encodedFileName = encodeURIComponent(fileName);
                    const filePath = `./PDF/${categoryFolder}/${encodedFileName}`;
                    const fileStats = await getFileStats(filePath);
                    
                    // 使用JSON映射的標題，如果沒有則使用原文件名
                    let displayName;
                    if (filenameMapping && filenameMapping[fileName]) {
                        displayName = filenameMapping[fileName];
                    } else {
                        displayName = fileName.replace('.pdf', '').replace('.PDF', '');
                    }
                    
                    pdfFiles.push({
                        name: displayName,
                        path: filePath,
                        size: fileStats.size,
                        modified: fileStats.modified,
                        category: categoryFolder,
                        originalFileName: fileName
                    });
                } catch (error) {
                    console.warn(`無法載入檔案: ${fileName}`, error);
                }
            }
        } else {
            // 無法掃描資料夾，回退到硬編碼清單
            console.warn(`無法掃描分類 ${categoryFolder}，使用備用檔案清單`);
            await loadCategoryPdfFilesFromMap(categoryFolder);
        }
    } catch (error) {
        console.warn(`載入分類 ${categoryFolder} 失敗:`, error);
        // 錯誤時回退到硬編碼清單
        await loadCategoryPdfFilesFromMap(categoryFolder);
    }
}

// 動態掃描分類資料夾
async function scanCategoryFolder(categoryFolder) {
    const foundFiles = [];
    
    try {
        // 嘗試獲取資料夾內容（這在某些環境中可能不工作）
        const response = await fetch(`./PDF/${categoryFolder}/`);
        if (response.ok) {
            const text = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const links = doc.querySelectorAll('a[href$=".pdf"], a[href$=".PDF"]');
            
            for (const link of links) {
                const fileName = link.getAttribute('href');
                if (fileName && !fileName.includes('/') && !fileName.startsWith('..')) {
                    foundFiles.push(decodeURIComponent(fileName));
                }
            }
        }
    } catch (error) {
        console.warn(`無法掃描資料夾 ${categoryFolder}:`, error);
    }
    
    // 如果目錄掃描失敗，嘗試常見的檔案名稱模式
    if (foundFiles.length === 0) {
        const commonPatterns = [
            // 根據分類嘗試一些常見的檔案名稱
            ...(categoryFolder === 'Architectural' ? ['卡比建築風格', '拉拉熊建築風格', '熊熊世界甜點', 'KirbyWorld', 'KumaWorld'] : []),
            ...(categoryFolder === 'Design' ? ['文具文青風格', '文具可愛風格', '拉拉熊文具', 'Hoob文具'] : []),
            ...(categoryFolder === 'Photo' ? ['京都雨花', '雨花彩花', '魔法雨花', '攝影特集'] : []),
            ...(categoryFolder === 'Misc' ? ['等距圖', '公共設施', 'Isomatic', 'KirbyWorld'] : []),
            // 通用模式
            'document', 'book', 'manual', 'guide', 'collection'
        ];
        
        // 嘗試各種可能的檔案名稱
        for (const pattern of commonPatterns) {
            const possibleNames = [
                `${pattern}.pdf`,
                `${pattern}.PDF`
            ];
            
            for (const fileName of possibleNames) {
                try {
                    const encodedFileName = encodeURIComponent(fileName);
                    const testResponse = await fetch(`./PDF/${categoryFolder}/${encodedFileName}`, { method: 'HEAD' });
                    if (testResponse.ok && !foundFiles.includes(fileName)) {
                        foundFiles.push(fileName);
                    }
                } catch (error) {
                    // 靜默跳過不存在的檔案
                }
            }
        }
    }
    
    return foundFiles;
}

// 從硬編碼清單載入PDF檔案（備用方案）
async function loadCategoryPdfFilesFromMap(categoryFolder) {
    // 載入文件名映射
    const filenameMapping = await loadFilenameMapping(categoryFolder);
    
    const categoryPdfMap = {
        'Architectural': [
            'kirby-world-architecture.pdf',
            'kuma-world-rilakkuma-architecture.pdf', 
            'bear-world-desserts.pdf'
        ],
        'Design': [
            'hoob-literary-style.pdf',
            'hoob-cute-style.pdf',
            'rilakkuma-cute-style.pdf',
            'rilakkuma-taiwan-street.pdf',
            'rilakkuma-photo-collection.pdf'
        ],
        'Interior': [],
        'Misc': [
            'isomatic-taiwan-street.pdf',
            'kirby-world-rilakkuma-facilities.pdf'
        ],
        'Photo': [
            'kyoto-rain-flower.pdf',
            'rain-flower-colorful-2nd.pdf',
            'magic-rain-flower.pdf',
            'magic-rain-flower-2nd.pdf',
            'collect.pdf'
        ]
    };
    
    const expectedFiles = categoryPdfMap[categoryFolder] || [];
    
    for (const fileName of expectedFiles) {
        try {
            const encodedFileName = encodeURIComponent(fileName);
            const filePath = `./PDF/${categoryFolder}/${encodedFileName}`;
            const testResponse = await fetch(filePath, { method: 'HEAD' });
            
            if (testResponse.ok) {
                const fileStats = await getFileStats(filePath);
                
                // 使用JSON映射的標題，如果沒有則使用原文件名
                let displayName;
                if (filenameMapping && filenameMapping[fileName]) {
                    displayName = filenameMapping[fileName];
                } else {
                    displayName = fileName.replace('.pdf', '').replace('.PDF', '');
                }
                
                pdfFiles.push({
                    name: displayName,
                    path: filePath,
                    size: fileStats.size,
                    modified: fileStats.modified,
                    category: categoryFolder
                });
            }
        } catch (error) {
            console.warn(`無法載入檔案: ${fileName}`, error);
        }
    }
}

// 載入所有PDF檔案（原有邏輯）
async function loadAllPdfFiles() {
    try {
        const response = await fetch('./PDF/');
        const text = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const links = doc.querySelectorAll('a[href$=".pdf"], a[href$=".PDF"]');
        
        for (const link of links) {
            const fileName = link.getAttribute('href');
            const displayName = decodeURIComponent(link.textContent.trim()).replace('.pdf', '').replace('.PDF', '');
            const filePath = './PDF/' + fileName;
            
            const fileStats = await getFileStats(filePath);
            pdfFiles.push({
                name: displayName,
                path: filePath,
                size: fileStats.size,
                modified: fileStats.modified
            });
        }
        
        if (pdfFiles.length === 0) {
            await loadLocalPdfFiles();
        }
    } catch (error) {
        console.warn('無法從伺服器目錄讀取PDF清單:', error);
        await loadLocalPdfFiles();
    }
}

// 載入本地PDF檔案（備用方案）
async function loadLocalPdfFiles() {
    // 嘗試一些常見的PDF檔案名稱
    const possiblePdfs = [
        '拉拉熊文具攝影特集.pdf',
        // 可以在這裡添加其他可能的檔案名稱
    ];
    
    // 也可以嘗試一些通用的檔案名稱模式
    const commonPatterns = ['book', 'manual', 'guide', 'document', 'report'];
    const extensions = ['.pdf', '.PDF'];
    
    // 組合可能的檔案名稱
    const allPossibleNames = [...possiblePdfs];
    for (let pattern of commonPatterns) {
        for (let i = 1; i <= 10; i++) {
            for (let ext of extensions) {
                allPossibleNames.push(`${pattern}${i}${ext}`);
                allPossibleNames.push(`${pattern}-${i}${ext}`);
                allPossibleNames.push(`${pattern}_${i}${ext}`);
            }
        }
    }
    
    for (const filename of allPossibleNames) {
        try {
            const encodedFilename = encodeURIComponent(filename);
            const testResponse = await fetch(`./PDF/${encodedFilename}`, { method: 'HEAD' });
            if (testResponse.ok) {
                const fileStats = await getFileStats(`./PDF/${encodedFilename}`);
                pdfFiles.push({
                    name: filename.replace('.pdf', '').replace('.PDF', ''),
                    path: `./PDF/${encodedFilename}`,
                    size: fileStats.size,
                    modified: fileStats.modified
                });
            }
        } catch (error) {
            // 靜默跳過不存在的檔案
        }
    }
    
    // 如果還是沒找到任何檔案，至少保留原有的檔案
    if (pdfFiles.length === 0) {
        const defaultFileStats = await getFileStats('./PDF/Design/rilakkuma-photo-collection.pdf');
        pdfFiles.push({
            name: '拉拉熊文具攝影特集',
            path: './PDF/Design/rilakkuma-photo-collection.pdf',
            size: defaultFileStats.size,
            modified: defaultFileStats.modified
        });
    }
}

// 顯示載入狀態
function showLoading(show) {
    const loadingMessage = document.getElementById('loadingMessage');
    if (show) {
        loadingMessage.classList.remove('hidden');
        loadingMessage.classList.add('loading-pulse');
    } else {
        loadingMessage.classList.add('hidden');
        loadingMessage.classList.remove('loading-pulse');
    }
}

// 顯示分類列表（第一階層）
async function displayCategories() {
    // 重置狀態，但保留當前的檢視模式偏好
    currentView = 'categories';
    currentCategory = null;
    pdfFiles = [];
    
    // 切換檢視顯示
    showCategoriesView();
    
    // 更新按鈕狀態
    updateControlButtonsState();
    
    // 根據檢視模式載入內容
    if (isListView) {
        await loadCategoryList();
    } else {
        await loadCategoryCards();
    }
}

// 顯示分類檢視，隱藏其他檢視
function showCategoriesView() {
    const categoryGrid = document.getElementById('categoryGrid');
    const pdfGrid = document.getElementById('pdfGrid');
    const breadcrumb = document.getElementById('breadcrumb');
    const listView = document.getElementById('listView');
    const bookshelfView = document.getElementById('bookshelfView');
    
    // 確保主網格容器在主選單檢視時可見
    if (bookshelfView) {
        bookshelfView.classList.remove('hidden');
    }

    pdfGrid.classList.add('hidden');
    breadcrumb.classList.add('hidden');
    
    if (isListView) {
        // ListView 模式：顯示清單檢視，隱藏網格檢視
        categoryGrid.classList.add('hidden');
        listView.classList.remove('hidden');
    } else {
        // 網格模式：顯示網格檢視，隱藏清單檢視
        listView.classList.add('hidden');
        categoryGrid.classList.remove('hidden');
    }
}

// 載入分類卡片
async function loadCategoryCards() {
    const categoryGrid = document.getElementById('categoryGrid');
    categoryGrid.innerHTML = '';
    
    // 清理之前的 lazy load observer
    if (window.currentLazyLoadObserver) {
        window.currentLazyLoadObserver.disconnect();
    }
    
    // 創建分類延遲載入 Observer
    const categoryLazyLoadObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const cardElement = entry.target;
                const category = cardElement.dataset.category ? JSON.parse(cardElement.dataset.category) : null;
                
                if (category && !cardElement.dataset.thumbnailLoaded) {
                    cardElement.dataset.thumbnailLoaded = 'loading';
                    
                    // 添加載入動畫
                    const coverDiv = cardElement.querySelector('.pdf-cover');
                    if (coverDiv && !coverDiv.querySelector('img')) {
                        coverDiv.innerHTML = `
                            <div class="loading-placeholder">
                                <div class="loading-spinner"></div>
                                <div class="text-white/60 text-sm mt-2">載入封面...</div>
                            </div>
                        `;
                    }
                    
                    generateCategoryThumbnail(category, cardElement)
                        .then(() => {
                            cardElement.dataset.thumbnailLoaded = 'completed';
                        })
                        .catch(error => {
                            console.warn(`無法為分類 ${category.name} 生成縮圖:`, error);
                            cardElement.dataset.thumbnailLoaded = 'failed';
                        });
                    
                    // 停止觀察這個元素
                    categoryLazyLoadObserver.unobserve(cardElement);
                }
            }
        });
    }, {
        root: null,
        rootMargin: '50px',
        threshold: 0.1
    });
    
    // 批量創建分類卡片
    const fragment = document.createDocumentFragment();
    
    for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        const cardElement = createCategoryCard(category, i);
        
        // 儲存分類資料
        cardElement.dataset.category = JSON.stringify(category);
        
        fragment.appendChild(cardElement);
        
        // 開始觀察這個卡片
        categoryLazyLoadObserver.observe(cardElement);
    }
    
    categoryGrid.appendChild(fragment);
    window.currentLazyLoadObserver = categoryLazyLoadObserver;
}

// 載入分類清單（ListView 模式）
async function loadCategoryList() {
    const tableBody = document.getElementById('pdfTableBody');
    tableBody.innerHTML = '';
    
    // 清理之前的 observer
    if (window.currentLazyLoadObserver) {
        window.currentLazyLoadObserver.disconnect();
    }
    
    categories.forEach((category, index) => {
        const gradientClass = appleGradients[index % appleGradients.length];
        const row = document.createElement('tr');
        row.className = 'hover:bg-white/5 transition-colors duration-200';
        row.innerHTML = `
            <td class="py-4 px-2">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                        📁
                    </div>
                    <div>
                        <div class="font-semibold ${gradientClass}">${category.name}</div>
                        <div class="text-sm text-white/60">${category.englishName}</div>
                    </div>
                </div>
            </td>
            <td class="py-4 px-2 text-white/70">${category.description}</td>
            <td class="py-4 px-2 text-white/70">資料夾</td>
            <td class="py-4 px-2">
                <button class="menu-item ${gradientClass}" onclick="openCategory(${JSON.stringify(category).replace(/"/g, '&quot;')})">
                    開啟 <span class="text-xs opacity-70">Open</span>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// 創建分類卡片
function createCategoryCard(category, index) {
    const card = document.createElement('div');
    const gradientClass = appleGradients[index % appleGradients.length];
    
    card.className = 'pdf-card group cursor-pointer';
    card.onclick = () => openCategory(category);
    
    card.innerHTML = `
        <div class="pdf-cover">
            <div class="pdf-icon">📁</div>
        </div>
        <div class="flex-1 flex flex-col justify-center">
            <h3 class="pdf-title group-hover:${gradientClass} transition-all duration-500">
                ${category.name}
            </h3>
            <p class="text-sm text-white/60 mt-1">${category.englishName}</p>
            <p class="text-xs text-white/50 mt-1">${category.description}</p>
        </div>
    `;
    
    return card;
}

// 生成分類縮圖（使用該分類第一本書的封面）
async function generateCategoryThumbnail(category, cardElement) {
    const categoryPdfMap = {
        'Architectural': 'KirbyWorld卡比建築風格.pdf',
        'Design': 'Hoob文具文青風格.pdf',
        'Interior': null, // 沒有檔案
        'Misc': 'Isomatic等距圖台灣街景.pdf',
        'Photo': '京都雨花.pdf'
    };
    
    const firstPdfFile = categoryPdfMap[category.folder];
    if (!firstPdfFile) {
        // 如果沒有檔案，保持預設的資料夾圖示
        return;
    }
    
    try {
        const encodedPdfFile = encodeURIComponent(firstPdfFile);
        const pdfPath = `./PDF/${category.folder}/${encodedPdfFile}`;
        await thumbnailManager.queueThumbnailLoad(pdfPath, cardElement, 300, 400);
    } catch (error) {
        console.warn(`為分類 ${category.name} 生成縮圖失敗:`, error);
    }
}

// 打開分類（第二階層）
async function openCategory(category) {
    currentView = 'pdfs';
    currentCategory = category;
    
    const categoryGrid = document.getElementById('categoryGrid');
    const pdfGrid = document.getElementById('pdfGrid');
    const listView = document.getElementById('listView');
    const breadcrumb = document.getElementById('breadcrumb');
    const breadcrumbSeparator = document.getElementById('breadcrumbSeparator');
    const currentCategorySpan = document.getElementById('currentCategory');
    
    // 預設以網格檢視模式開始
    isListView = false;
    
    // 顯示導航和PDF網格，隱藏分類和清單檢視
    categoryGrid.classList.add('hidden');
    listView.classList.add('hidden');
    pdfGrid.classList.remove('hidden');
    breadcrumb.classList.remove('hidden');
    breadcrumbSeparator.classList.remove('hidden');
    currentCategorySpan.textContent = `${category.name} ${category.englishName}`;
    
    // 更新按鈕狀態
    updateControlButtonsState();
    
    // 載入該分類的PDF檔案
    await loadPdfFiles(category.folder);
}

// 返回主分類頁面
function goToMainMenu() {
    displayCategories();
}

// 更新控制按鈕狀態
function updateControlButtonsState() {
    const homeBtn = document.getElementById('homeBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const listViewBtn = document.getElementById('listViewBtn');
    
    if (currentView === 'categories') {
        // 在主分類檢視時
        homeBtn.style.opacity = '0.5';
        homeBtn.style.pointerEvents = 'none';
        
        refreshBtn.querySelector('.liquidGlass-text').innerHTML = `
            <span class="text-white font-medium">重整分類</span>
            <span class="text-blue-300 text-sm">Refresh</span>
        `;
        
        // 在分類檢視時也允許切換檢視模式
        listViewBtn.style.opacity = '1';
        listViewBtn.style.pointerEvents = 'auto';
        
        if (isListView) {
            listViewBtn.querySelector('.liquidGlass-text').innerHTML = `
                <span class="text-white font-medium">網格檢視</span>
                <span class="text-blue-300 text-sm">Grid View</span>
            `;
        } else {
            listViewBtn.querySelector('.liquidGlass-text').innerHTML = `
                <span class="text-white font-medium">清單檢視</span>
                <span class="text-purple-300 text-sm">List View</span>
            `;
        }
    } else if (currentView === 'pdfs') {
        // 在PDF檢視時
        homeBtn.style.opacity = '1';
        homeBtn.style.pointerEvents = 'auto';
        
        refreshBtn.querySelector('.liquidGlass-text').innerHTML = `
            <span class="text-white font-medium">重整書架</span>
            <span class="text-blue-300 text-sm">Refresh</span>
        `;
        
        listViewBtn.style.opacity = '1';
        listViewBtn.style.pointerEvents = 'auto';
        
        if (isListView) {
            listViewBtn.querySelector('.liquidGlass-text').innerHTML = `
                <span class="text-white font-medium">書架檢視</span>
                <span class="text-blue-300 text-sm">Grid View</span>
            `;
        } else {
            listViewBtn.querySelector('.liquidGlass-text').innerHTML = `
                <span class="text-white font-medium">清單檢視</span>
                <span class="text-purple-300 text-sm">List View</span>
            `;
        }
    }
}

// 顯示書籍卡片（使用延遲載入）
async function displayBooks() {
    const pdfGrid = document.getElementById('pdfGrid');
    pdfGrid.innerHTML = '';
    
    // 創建 Intersection Observer 用於延遲載入
    const lazyLoadObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const cardElement = entry.target;
                const file = cardElement.dataset.file ? JSON.parse(cardElement.dataset.file) : null;
                
                if (file && !cardElement.dataset.thumbnailLoaded) {
                    cardElement.dataset.thumbnailLoaded = 'loading';
                    
                    // 添加載入動畫
                    const coverDiv = cardElement.querySelector('.pdf-cover');
                    if (coverDiv) {
                        coverDiv.innerHTML = `
                            <div class="loading-placeholder">
                                <div class="loading-spinner"></div>
                                <div class="text-white/60 text-sm mt-2">載入中...</div>
                            </div>
                        `;
                    }
                    
                    generateThumbnail(file, cardElement)
                        .then(() => {
                            cardElement.dataset.thumbnailLoaded = 'completed';
                        })
                        .catch(error => {
                            console.warn(`無法為 ${file.name} 生成縮圖:`, error);
                            cardElement.dataset.thumbnailLoaded = 'failed';
                        });
                    
                    // 停止觀察這個元素
                    lazyLoadObserver.unobserve(cardElement);
                }
            }
        });
    }, {
        root: null,
        rootMargin: '100px', // 提前 100px 開始載入
        threshold: 0.1
    });
    
    // 批量創建卡片
    const fragment = document.createDocumentFragment();
    
    for (let i = 0; i < pdfFiles.length; i++) {
        const file = pdfFiles[i];
        const cardElement = createBookCard(file, i);
        
        // 儲存檔案資料以供延遲載入使用
        cardElement.dataset.file = JSON.stringify(file);
        
        fragment.appendChild(cardElement);
        
        // 開始觀察這個卡片
        lazyLoadObserver.observe(cardElement);
    }
    
    pdfGrid.appendChild(fragment);
    
    // 儲存 observer 以便清理
    if (window.currentLazyLoadObserver) {
        window.currentLazyLoadObserver.disconnect();
    }
    window.currentLazyLoadObserver = lazyLoadObserver;
}

// 創建書籍卡片
function createBookCard(file, index) {
    const card = document.createElement('div');
    const gradientClass = appleGradients[index % appleGradients.length];
    
    card.className = 'pdf-card group';
    card.onclick = () => openPdf(file.path, file.name);
    
    card.innerHTML = `
        <div class="pdf-cover">
            <div class="pdf-icon">📄</div>
        </div>
        <div class="flex-1 flex flex-col justify-center">
            <h3 class="pdf-title group-hover:${gradientClass} transition-all duration-500">
                ${file.name}
            </h3>
        </div>
    `;
    
    return card;
}

// 縮圖載入管理器
class ThumbnailManager {
    constructor() {
        this.cache = new Map();
        this.loadingPromises = new Map();
        this.maxConcurrent = 3; // 最大同時載入數量
        this.currentlyLoading = 0;
        this.queue = [];
    }

    // 獲取縮圖的快取鍵
    getCacheKey(filePath) {
        return `thumb_${filePath}`;
    }

    // 檢查快取
    getFromCache(filePath) {
        return this.cache.get(this.getCacheKey(filePath));
    }

    // 儲存到快取
    setCache(filePath, imageData) {
        const key = this.getCacheKey(filePath);
        this.cache.set(key, imageData);
        
        // 限制快取大小，避免記憶體過度使用
        if (this.cache.size > 50) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    }

    // 生成優化的縮圖
    async generateOptimizedThumbnail(filePath, targetWidth = 300, targetHeight = 400) {
        const cacheKey = this.getCacheKey(filePath);
        
        // 檢查快取
        const cached = this.getFromCache(filePath);
        if (cached) {
            return cached;
        }

        // 檢查是否已在載入中
        if (this.loadingPromises.has(cacheKey)) {
            return await this.loadingPromises.get(cacheKey);
        }

        // 創建載入 Promise
        const loadPromise = this._loadThumbnail(filePath, targetWidth, targetHeight);
        this.loadingPromises.set(cacheKey, loadPromise);

        try {
            const result = await loadPromise;
            this.setCache(filePath, result);
            return result;
        } finally {
            this.loadingPromises.delete(cacheKey);
        }
    }

    // 實際載入縮圖
    async _loadThumbnail(filePath, targetWidth, targetHeight) {
        let pdf = null;
        try {
            pdf = await pdfjsLib.getDocument({
                url: filePath,
                cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/cmaps/',
                cMapPacked: true,
                disableAutoFetch: true,
                disableStream: true
            }).promise;
            
            const page = await pdf.getPage(1);
            
            // 計算最佳縮放比例
            const originalViewport = page.getViewport({ scale: 1 });
            const scaleX = targetWidth / originalViewport.width;
            const scaleY = targetHeight / originalViewport.height;
            const scale = Math.min(scaleX, scaleY, 1); // 不超過原始大小
            
            const scaledViewport = page.getViewport({ scale });
            
            // 創建 OffscreenCanvas 以提升效能
            let canvas, context;
            if (typeof OffscreenCanvas !== 'undefined') {
                canvas = new OffscreenCanvas(scaledViewport.width, scaledViewport.height);
                context = canvas.getContext('2d');
            } else {
                canvas = document.createElement('canvas');
                canvas.width = scaledViewport.width;
                canvas.height = scaledViewport.height;
                context = canvas.getContext('2d');
            }

            await page.render({
                canvasContext: context,
                viewport: scaledViewport,
                enableWebGL: true // 啟用 WebGL 加速
            }).promise;
            
            // 轉換為 WebP 格式以減少檔案大小
            let imageData;
            if (canvas.convertToBlob) {
                const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 });
                imageData = URL.createObjectURL(blob);
            } else {
                imageData = canvas.toDataURL('image/webp', 0.8);
            }
            
            return imageData;
            
        } catch (error) {
            console.warn(`載入縮圖失敗: ${filePath}`, error);
            return null;
        } finally {
            if (pdf) {
                pdf.destroy();
            }
        }
    }

    // 佇列化載入
    async queueThumbnailLoad(filePath, cardElement, targetWidth, targetHeight) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                filePath,
                cardElement,
                targetWidth,
                targetHeight,
                resolve,
                reject
            });
            this.updateLoadingProgress();
            this.processQueue();
        });
    }

    // 更新載入進度
    updateLoadingProgress() {
        const totalItems = this.queue.length + this.currentlyLoading;
        const remainingItems = this.queue.length;
        const progressPercent = totalItems > 0 ? ((totalItems - remainingItems) / totalItems) * 100 : 100;
        
        // 發送自定義事件
        window.dispatchEvent(new CustomEvent('thumbnailProgress', {
            detail: {
                total: totalItems,
                remaining: remainingItems,
                percent: Math.round(progressPercent)
            }
        }));
    }

    // 處理載入佇列
    async processQueue() {
        if (this.currentlyLoading >= this.maxConcurrent || this.queue.length === 0) {
            return;
        }

        this.currentlyLoading++;
        const task = this.queue.shift();

        try {
            const imageData = await this.generateOptimizedThumbnail(
                task.filePath,
                task.targetWidth,
                task.targetHeight
            );

            if (imageData && task.cardElement) {
                const img = document.createElement('img');
                img.src = imageData;
                img.alt = 'PDF Thumbnail';
                img.loading = 'lazy';
                img.style.opacity = '0';
                img.style.transition = 'opacity 0.3s ease-in-out';

                const coverDiv = task.cardElement.querySelector('.pdf-cover');
                if (coverDiv) {
                    coverDiv.innerHTML = '';
                    coverDiv.appendChild(img);
                    
                    // 漸入效果
                    requestAnimationFrame(() => {
                        img.style.opacity = '1';
                    });
                }
            }
            
            task.resolve(imageData);
        } catch (error) {
            task.reject(error);
        } finally {
            this.currentlyLoading--;
            this.updateLoadingProgress();
            // 繼續處理佇列
            setTimeout(() => this.processQueue(), 50);
        }
    }
}

// 創建全域縮圖管理器實例
const thumbnailManager = new ThumbnailManager();

// 優化的縮圖生成函數
async function generateThumbnail(file, cardElement) {
    try {
        await thumbnailManager.queueThumbnailLoad(file.path, cardElement, 300, 400);
    } catch (error) {
        console.warn(`為 ${file.name} 生成縮圖失敗:`, error);
    }
}

// 顯示清單檢視
function displayList() {
    const tableBody = document.getElementById('pdfTableBody');
    tableBody.innerHTML = '';
    
    pdfFiles.forEach((file, index) => {
        const gradientClass = appleGradients[index % appleGradients.length];
        const row = document.createElement('tr');
        row.className = 'hover:bg-white/5 transition-colors duration-200';
        row.innerHTML = `
            <td class="py-4 px-2">
                <span class="font-semibold ${gradientClass}">${file.name}</span>
            </td>
            <td class="py-4 px-2 text-white/70">${formatFileSize(file.size)}</td>
            <td class="py-4 px-2 text-white/70">${formatDate(file.modified)}</td>
            <td class="py-4 px-2">
                <button class="menu-item ${gradientClass}" onclick="openPdf('${file.path}', '${file.name}')">
                    開啟 <span class="text-xs opacity-70">Open</span>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// 格式化檔案大小
function formatFileSize(size) {
    if (size === '未知' || !size) return '未知';
    const bytes = parseInt(size);
    if (isNaN(bytes)) return '未知';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let fileSize = bytes;
    
    while (fileSize >= 1024 && i < units.length - 1) {
        fileSize /= 1024;
        i++;
    }
    
    return Math.round(fileSize * 100) / 100 + ' ' + units[i];
}

// 格式化日期
function formatDate(dateString) {
    if (dateString === '未知' || !dateString) return '未知';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-TW');
    } catch {
        return '未知';
    }
}

// 打開PDF
async function openPdf(pdfPath, title) {
    try {
        currentPdf = await pdfjsLib.getDocument(pdfPath).promise;
        totalPages = currentPdf.numPages;
        currentPageNum = 1;
        
        document.getElementById('pdfModal').style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        await renderPage(currentPageNum);
        updatePageInfo();
        
    } catch (error) {
        console.error('開啟PDF失敗:', error);
    }
}

// 渲染PDF頁面
async function renderPage(pageNum) {
    if (!currentPdf) return;
    
    try {
        const containerWidth = window.innerWidth;
        const containerHeight = window.innerHeight;
        
        const leftCanvas = document.getElementById('pdfCanvasLeft');
        const rightCanvas = document.getElementById('pdfCanvasRight');
        const bookSpread = document.querySelector('.book-spread');
        
        // 始終使用雙頁模式，最後一頁如果是奇數頁則右側顯示空白
        rightCanvas.style.display = 'block';
        bookSpread.style.justifyContent = 'center';
        
        // 渲染左頁
        await renderSinglePage(pageNum, 'pdfCanvasLeft', containerWidth / 2, containerHeight);
        
        // 渲染右頁或空白頁
        if (pageNum < totalPages) {
            await renderSinglePage(pageNum + 1, 'pdfCanvasRight', containerWidth / 2, containerHeight);
        } else {
            // 最後一頁是奇數頁，右側顯示空白頁
            await renderBlankPage('pdfCanvasRight', containerWidth / 2, containerHeight);
        }
        
    } catch (error) {
        console.error('渲染頁面失敗:', error);
    }
}

// 渲染空白頁面
async function renderBlankPage(canvasId, maxWidth, maxHeight) {
    try {
        const canvas = document.getElementById(canvasId);
        const context = canvas.getContext('2d');
        
        canvas.style.display = 'block';
        
        // 使用標準A4比例 (210mm x 297mm ≈ 0.707 ratio)
        const aspectRatio = 0.707;
        const containerWidth = maxWidth * 0.9;
        const containerHeight = maxHeight * 0.9;
        
        let canvasWidth, canvasHeight;
        
        // 根據容器尺寸計算最適合的canvas尺寸
        if (containerWidth / containerHeight > aspectRatio) {
            canvasHeight = containerHeight;
            canvasWidth = canvasHeight * aspectRatio;
        } else {
            canvasWidth = containerWidth;
            canvasHeight = canvasWidth / aspectRatio;
        }
        
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // 繪製空白頁面背景
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvasWidth, canvasHeight);
        
        // 添加微妙的邊框和陰影效果
        context.strokeStyle = '#e0e0e0';
        context.lineWidth = 1;
        context.strokeRect(1, 1, canvasWidth - 2, canvasHeight - 2);
        
        // 添加微妙的紙張質感
        context.fillStyle = '#fafafa';
        context.fillRect(10, 10, canvasWidth - 20, canvasHeight - 20);
        
    } catch (error) {
        console.error('渲染空白頁面失敗:', error);
    }
}

// 渲染單一頁面
async function renderSinglePage(pageNum, canvasId, maxWidth, maxHeight) {
    if (pageNum > totalPages) return;
    
    try {
        const page = await currentPdf.getPage(pageNum);
        const canvas = document.getElementById(canvasId);
        const context = canvas.getContext('2d');
        
        canvas.style.display = 'block';
        
        const viewport = page.getViewport({ scale: 1 });
        
        const containerWidth = maxWidth * 0.9;
        const containerHeight = maxHeight * 0.9;
        
        const scale = Math.min(
            containerWidth / viewport.width,
            containerHeight / viewport.height
        );
        
        const scaledViewport = page.getViewport({ scale });
        
        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;
        
        await page.render({
            canvasContext: context,
            viewport: scaledViewport
        }).promise;
        
    } catch (error) {
        console.error(`渲染第 ${pageNum} 頁失敗:`, error);
    }
}

// 更新頁面資訊
function updatePageInfo() {
    let pageText;
    if (currentPageNum < totalPages) {
        pageText = `Page ${currentPageNum}-${currentPageNum + 1} / ${totalPages}`;
    } else {
        pageText = `Page ${currentPageNum} / ${totalPages}`;
    }
    document.getElementById('pageInfo').textContent = pageText;
}

// 上一頁
async function previousPage() {
    if (currentPageNum <= 1) return;
    
    const rightPage = document.querySelector('.right-page');
    rightPage.classList.add('flip-right');
    
    setTimeout(async () => {
        currentPageNum = Math.max(1, currentPageNum - 2);
        await renderPage(currentPageNum);
        updatePageInfo();
        
        setTimeout(() => {
            rightPage.classList.remove('flip-right');
        }, 100);
    }, 500);
}

// 下一頁
async function nextPage() {
    if (currentPageNum >= totalPages) return;
    
    const leftPage = document.querySelector('.left-page');
    leftPage.classList.add('flip-left');
    
    setTimeout(async () => {
        currentPageNum = Math.min(totalPages, currentPageNum + 2);
        await renderPage(currentPageNum);
        updatePageInfo();
        
        setTimeout(() => {
            leftPage.classList.remove('flip-left');
        }, 100);
    }, 500);
}

// 關閉PDF閱讀器
function closePdfModal() {
    document.getElementById('pdfModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    hidePageInput(); // 隱藏頁碼輸入框
    if (currentPdf) {
        currentPdf.destroy();
        currentPdf = null;
    }
}

// 切換檢視模式
async function toggleView() {
    isListView = !isListView;
    
    if (currentView === 'categories') {
        // 在分類檢視時切換檢視模式
        showCategoriesView();
        
        if (isListView) {
            await loadCategoryList();
        } else {
            await loadCategoryCards();
        }
    } else if (currentView === 'pdfs') {
        // 在PDF檢視時切換檢視模式
        if (pdfFiles.length === 0) {
            return;
        }
        
        const bookshelfView = document.getElementById('bookshelfView');
        const listView = document.getElementById('listView');
        
        if (isListView) {
            // 切換到清單檢視 - 保持相同的麵包屑，只切換內容顯示
            bookshelfView.classList.add('hidden');
            listView.classList.remove('hidden');
        } else {
            // 切換到網格檢視
            listView.classList.add('hidden');
            bookshelfView.classList.remove('hidden');
        }
    }
    
    // 更新按鈕狀態
    updateControlButtonsState();
}

// 重新整理書架
async function refreshBookshelf() {
    showLoading(true);
    
    // 清理快取以確保載入最新內容
    if (thumbnailManager && thumbnailManager.cache) {
        thumbnailManager.cache.clear();
    }
    
    if (currentView === 'categories') {
        // 重整分類檢視
        await displayCategories();
    } else if (currentView === 'pdfs' && currentCategory) {
        // 重整當前分類的PDF列表
        pdfFiles = [];
        
        // 清理之前的 lazy load observer
        if (window.currentLazyLoadObserver) {
            window.currentLazyLoadObserver.disconnect();
        }
        
        // 重新載入PDF檔案
        await loadPdfFiles(currentCategory.folder);
        
        // 根據當前檢視模式重新顯示內容
        if (isListView) {
            displayList();
        } else {
            displayBooks();
        }
    }
    
    showLoading(false);
}

// 切換頁碼輸入框顯示
function togglePageInput() {
    const container = document.getElementById('pageInputContainer');
    const input = document.getElementById('pageInput');
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        input.focus();
        input.value = '';
        input.setAttribute('max', totalPages);
    } else {
        container.classList.add('hidden');
    }
}

// 隱藏頁碼輸入框
function hidePageInput() {
    const container = document.getElementById('pageInputContainer');
    container.classList.add('hidden');
}

// 處理頁碼輸入框的按鍵事件
function handlePageInputKeyPress(event) {
    if (event.key === 'Enter') {
        jumpToPage();
    } else if (event.key === 'Escape') {
        hidePageInput();
    }
}

// 跳轉到指定頁面
async function jumpToPage() {
    const input = document.getElementById('pageInput');
    const pageNum = parseInt(input.value);
    
    if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
        // 簡單的視覺反饋
        input.style.borderColor = '#ef4444';
        setTimeout(() => {
            input.style.borderColor = '';
        }, 1000);
        return;
    }
    
    // 確保頁數為奇數（因為我們使用雙頁模式）
    const targetPage = pageNum % 2 === 0 ? pageNum - 1 : pageNum;
    
    hidePageInput();
    
    currentPageNum = Math.max(1, targetPage);
    await renderPage(currentPageNum);
    updatePageInfo();
}

// 鍵盤事件
document.addEventListener('keydown', function(event) {
    if (document.getElementById('pdfModal').style.display === 'block') {
        // PDF 閱讀器中的鍵盤操作
        switch(event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                previousPage();
                break;
            case 'ArrowRight':
                event.preventDefault();
                nextPage();
                break;
            case 'Escape':
                closePdfModal();
                break;
        }
    } else {
        // 主要介面的鍵盤導航
        switch(event.key) {
            case 'Escape':
                if (currentView === 'pdfs') {
                    // 從PDF檢視回到分類檢視
                    event.preventDefault();
                    goToMainMenu();
                }
                break;
            case 'Home':
                // Home 鍵直接回到主選單
                event.preventDefault();
                goToMainMenu();
                break;
        }
    }
});

// 點擊模態框外部關閉
window.onclick = function(event) {
    const modal = document.getElementById('pdfModal');
    if (event.target === modal) {
        closePdfModal();
    }
}

// 視窗大小調整事件
window.addEventListener('resize', function() {
    if (currentPdf && document.getElementById('pdfModal').style.display === 'block') {
        setTimeout(() => renderPage(currentPageNum), 200);
    }
});

// 清理資源
window.addEventListener('beforeunload', function() {
    if (currentPdf) {
        currentPdf.destroy();
    }
    
    // 清理縮圖快取中的 blob URLs
    if (thumbnailManager && thumbnailManager.cache) {
        for (const [key, value] of thumbnailManager.cache.entries()) {
            if (value && typeof value === 'string' && value.startsWith('blob:')) {
                URL.revokeObjectURL(value);
            }
        }
    }
    
    // 停用所有 observers
    if (window.currentLazyLoadObserver) {
        window.currentLazyLoadObserver.disconnect();
    }
});

// 頁面可見性變化時的優化
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // 頁面隱藏時暫停縮圖載入
        if (thumbnailManager) {
            thumbnailManager.maxConcurrent = 0;
        }
    } else {
        // 頁面重新可見時恢復載入
        if (thumbnailManager) {
            thumbnailManager.maxConcurrent = 3;
            thumbnailManager.processQueue();
        }
    }
});

// 網路狀態優化
window.addEventListener('online', function() {
    // 網路恢復時重新開始載入佇列
    if (thumbnailManager) {
        thumbnailManager.processQueue();
    }
});

window.addEventListener('offline', function() {
    // 網路斷線時暫停載入
    if (thumbnailManager) {
        thumbnailManager.maxConcurrent = 0;
    }
});

// TailwindCSS 客製化配置
tailwind.config = {
    theme: {
        extend: {
            screens: {
                '2xl': '1536px',
                '3xl': '1920px'
            },
            fontFamily: {
                'inter': ['Inter', 'sans-serif'],
                'noto': ['Noto Sans SC', 'sans-serif']
            }
        }
    }
}
