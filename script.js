pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let currentPdf = null;
let currentPageNum = 1;
let totalPages = 0;
let pdfFiles = [];
let isListView = false;

document.addEventListener('DOMContentLoaded', function() {
    loadPdfFiles();
});

async function loadPdfFiles() {
    showLoading(true);
    
    // 直接載入已知的PDF檔案
    await loadLocalPdfFiles();
    
    displayBooks();
    displayList();
    
    showLoading(false);
}

async function loadLocalPdfFiles() {
    const knownPdfs = ['拉拉熊文具攝影特集.pdf'];
    
    for (const filename of knownPdfs) {
        try {
            // 嘗試載入PDF檔案來驗證它存在
            const testResponse = await fetch(`./PDF/${filename}`);
            if (testResponse.ok) {
                pdfFiles.push({
                    name: filename.replace('.pdf', ''),
                    path: `./PDF/${filename}`,
                    size: testResponse.headers.get('content-length') || '未知',
                    modified: testResponse.headers.get('last-modified') || '未知'
                });
                console.log(`成功載入: ${filename}`);
            }
        } catch (error) {
            console.warn(`無法載入 ${filename}:`, error);
            // 即使無法驗證檔案存在，仍然添加到清單中
            pdfFiles.push({
                name: filename.replace('.pdf', ''),
                path: `./PDF/${filename}`,
                size: '未知',
                modified: '未知'
            });
        }
    }
}

function showLoading(show) {
    const loadingMessage = document.getElementById('loadingMessage');
    loadingMessage.style.display = show ? 'block' : 'none';
}

async function displayBooks() {
    const pdfGrid = document.getElementById('pdfGrid');
    pdfGrid.innerHTML = '';
    
    for (const file of pdfFiles) {
        const bookElement = createBookElement(file);
        pdfGrid.appendChild(bookElement);
        
        try {
            await generateThumbnail(file, bookElement);
        } catch (error) {
            console.warn(`無法為 ${file.name} 生成縮圖:`, error);
        }
    }
}

function createBookElement(file) {
    const book = document.createElement('div');
    book.className = 'book';
    book.onclick = () => openPdf(file.path, file.name);
    
    book.innerHTML = `
        <div class="book-cover">
            <div class="pdf-icon">📄</div>
        </div>
        <div class="book-title">${file.name}</div>
    `;
    
    return book;
}

async function generateThumbnail(file, bookElement) {
    try {
        const pdf = await pdfjsLib.getDocument(file.path).promise;
        const page = await pdf.getPage(1);
        
        const viewport = page.getViewport({ scale: 0.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
        
        const img = document.createElement('img');
        img.src = canvas.toDataURL();
        img.alt = file.name;
        
        const coverDiv = bookElement.querySelector('.book-cover');
        coverDiv.innerHTML = '';
        coverDiv.appendChild(img);
        
        pdf.destroy();
        
    } catch (error) {
        console.warn(`為 ${file.name} 生成縮圖失敗:`, error);
    }
}

function displayList() {
    const tableBody = document.getElementById('pdfTableBody');
    tableBody.innerHTML = '';
    
    pdfFiles.forEach(file => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${file.name}</td>
            <td>${formatFileSize(file.size)}</td>
            <td>${formatDate(file.modified)}</td>
            <td><button onclick="openPdf('${file.path}', '${file.name}')">開啟</button></td>
        `;
        tableBody.appendChild(row);
    });
}

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

function formatDate(dateString) {
    if (dateString === '未知' || !dateString) return '未知';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-TW');
    } catch {
        return '未知';
    }
}

async function openPdf(pdfPath, title) {
    try {
        currentPdf = await pdfjsLib.getDocument(pdfPath).promise;
        totalPages = currentPdf.numPages;
        currentPageNum = 1;
        
        document.getElementById('pdfModal').style.display = 'block';
        
        await renderPage(currentPageNum);
        updatePageInfo();
        
    } catch (error) {
        console.error('開啟PDF失敗:', error);
        // 移除錯誤提示，靜默處理
    }
}

async function renderPage(pageNum) {
    if (!currentPdf) return;
    
    try {
        const containerWidth = window.innerWidth;
        const containerHeight = window.innerHeight;
        
        // 渲染左頁（奇數頁或單獨顯示）
        await renderSinglePage(pageNum, 'pdfCanvasLeft', containerWidth / 2, containerHeight);
        
        // 渲染右頁（偶數頁，如果存在）
        if (pageNum < totalPages) {
            await renderSinglePage(pageNum + 1, 'pdfCanvasRight', containerWidth / 2, containerHeight);
        } else {
            // 清空右頁
            const rightCanvas = document.getElementById('pdfCanvasRight');
            rightCanvas.style.display = 'none';
        }
        
        addPageFlipAnimation();
        
    } catch (error) {
        console.error('渲染頁面失敗:', error);
    }
}

async function renderSinglePage(pageNum, canvasId, maxWidth, maxHeight) {
    if (pageNum > totalPages) return;
    
    try {
        const page = await currentPdf.getPage(pageNum);
        const canvas = document.getElementById(canvasId);
        const context = canvas.getContext('2d');
        
        canvas.style.display = 'block';
        
        const viewport = page.getViewport({ scale: 1 });
        
        // 計算適合滿版顯示的縮放比例
        const containerWidth = maxWidth * 0.9; // 90% 的容器寬度
        const containerHeight = maxHeight * 0.9; // 90% 的容器高度
        
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

function addPageFlipAnimation() {
    const leftPage = document.querySelector('.left-page');
    const rightPage = document.querySelector('.right-page');
    
    leftPage.classList.add('flipping');
    rightPage.classList.add('flipping');
    
    setTimeout(() => {
        leftPage.classList.remove('flipping');
        rightPage.classList.remove('flipping');
    }, 800);
}

function updatePageInfo() {
    let pageText;
    if (currentPageNum < totalPages) {
        pageText = `頁面 ${currentPageNum}-${currentPageNum + 1} / ${totalPages}`;
    } else {
        pageText = `頁面 ${currentPageNum} / ${totalPages}`;
    }
    document.getElementById('pageInfo').textContent = pageText;
    
    document.getElementById('prevPage').disabled = currentPageNum <= 1;
    document.getElementById('nextPage').disabled = currentPageNum >= totalPages;
}

async function previousPage() {
    if (currentPageNum <= 1) return;
    
    // 添加翻頁動畫
    const rightPage = document.querySelector('.right-page');
    rightPage.classList.add('flip-right');
    
    setTimeout(async () => {
        currentPageNum = Math.max(1, currentPageNum - 2);
        await renderPage(currentPageNum);
        updatePageInfo();
        
        setTimeout(() => {
            rightPage.classList.remove('flip-right');
        }, 100);
    }, 600);
}

async function nextPage() {
    if (currentPageNum >= totalPages) return;
    
    // 添加翻頁動畫
    const leftPage = document.querySelector('.left-page');
    leftPage.classList.add('flip-left');
    
    setTimeout(async () => {
        currentPageNum = Math.min(totalPages, currentPageNum + 2);
        await renderPage(currentPageNum);
        updatePageInfo();
        
        setTimeout(() => {
            leftPage.classList.remove('flip-left');
        }, 100);
    }, 600);
}

function closePdfModal() {
    document.getElementById('pdfModal').style.display = 'none';
    if (currentPdf) {
        currentPdf.destroy();
        currentPdf = null;
    }
}

function toggleView() {
    isListView = !isListView;
    const bookshelfView = document.getElementById('bookshelfView');
    const listView = document.getElementById('listView');
    const button = document.getElementById('listViewBtn');
    
    if (isListView) {
        bookshelfView.classList.add('hidden');
        listView.classList.remove('hidden');
        button.textContent = '書架檢視';
    } else {
        bookshelfView.classList.remove('hidden');
        listView.classList.add('hidden');
        button.textContent = '清單檢視';
    }
}

async function refreshBookshelf() {
    showLoading(true);
    pdfFiles = [];
    await loadPdfFiles();
    showLoading(false);
}

document.addEventListener('keydown', function(event) {
    if (document.getElementById('pdfModal').style.display === 'block') {
        if (event.key === 'Escape') {
            closePdfModal();
        }
    }
});

window.onclick = function(event) {
    const modal = document.getElementById('pdfModal');
    if (event.target === modal) {
        closePdfModal();
    }
}

window.addEventListener('resize', function() {
    if (currentPdf && document.getElementById('pdfModal').style.display === 'block') {
        setTimeout(() => renderPage(currentPageNum), 200);
    }
});

window.addEventListener('beforeunload', function() {
    if (currentPdf) {
        currentPdf.destroy();
    }
});