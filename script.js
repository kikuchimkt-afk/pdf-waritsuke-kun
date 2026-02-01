const { PDFDocument, PageSizes } = PDFLib;

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const statusArea = document.getElementById('status-area');
const fileNameDisplay = document.getElementById('file-name');
const progressFill = document.getElementById('progress-fill');
const statusText = document.getElementById('status-text');
const resultActions = document.getElementById('result-actions');
const downloadBtn = document.getElementById('download-btn');
const printBtn = document.getElementById('print-btn');
const reprocessUi = document.getElementById('reprocess-ui');
const backBtn = document.getElementById('back-btn');
const reprocessBtn = document.getElementById('reprocess-btn');
const resetBtn = document.getElementById('reset-btn');
const processingUi = document.getElementById('processing-ui');
const previewArea = document.getElementById('preview-area');
const pdfPreview = document.getElementById('pdf-preview');
const optionsPanel = document.getElementById('options-panel');
const layoutModeRadios = document.getElementsByName('layout-mode');
const readingDirRadios = document.getElementsByName('reading-dir');
const origOrientRadios = document.getElementsByName('orig-orient');
const outOrientRadios = document.getElementsByName('out-orient');
const bindingRadios = document.getElementsByName('binding');
const dynamicTips = document.getElementById('dynamic-tips');
const installBtn = document.getElementById('install-btn');
const iosInstallModal = document.getElementById('ios-install-modal');
const closeIosModalBtn = document.getElementById('close-ios-modal');

let deferredPrompt;

let currentFileArrayBuffer = null;
let processedPdfBytes = null;
let currentFileName = '';
let currentPdfUrl = null;

// Drag and drop handlers
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
        handleFile(file);
    } else {
        alert('PDFファイルを選択してください。');
    }
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
});

async function handleFile(file) {
    currentFileName = file.name;
    fileNameDisplay.textContent = file.name;

    // Get options
    const layoutMode = parseInt(Array.from(layoutModeRadios).find(r => r.checked).value);
    const readingDir = Array.from(readingDirRadios).find(r => r.checked).value;
    const origOrient = Array.from(origOrientRadios).find(r => r.checked).value;
    const outOrient = Array.from(outOrientRadios).find(r => r.checked).value;
    const bindingDir = Array.from(bindingRadios).find(r => r.checked).value;

    updateTips(outOrient, bindingDir);

    dropZone.style.display = 'none';
    optionsPanel.style.display = 'none';
    reprocessUi.style.display = 'none';
    statusArea.style.display = 'block';
    processingUi.style.display = 'block';
    resultActions.style.display = 'none';
    progressFill.style.width = '0%';
    statusText.textContent = 'PDFを読み込み中...';

    try {
        currentFileArrayBuffer = await file.arrayBuffer();
        await processPdf(currentFileArrayBuffer, { layoutMode, readingDir, origOrient, outOrient, bindingDir });
    } catch (error) {
        console.error(error);
        alert('PDFの処理中にエラーが発生しました。: ' + error.message);
        reset();
    }
}

async function processPdf(arrayBuffer, options) {
    statusText.textContent = '割付処理を開始します...';
    const srcPdf = await PDFDocument.load(arrayBuffer);
    const outPdf = await PDFDocument.create();

    const pageCount = srcPdf.getPageCount();
    const a4Landscape = [841.89, 595.28];
    const a4Portrait = [595.28, 841.89];

    // User selected output orientation
    const isOutLandscape = options.outOrient === 'landscape';
    const sheetSize = isOutLandscape ? a4Landscape : a4Portrait;

    // Grid determination
    // If output is Landscape: 2-up -> 2x1, 4-up -> 2x2
    // If output is Portrait: 2-up -> 1x2, 4-up -> 2x2
    const is4Up = options.layoutMode === 4;
    const isRTL = options.readingDir === 'rl';

    let cols, rows;
    if (is4Up) {
        cols = 2; rows = 2;
    } else {
        cols = isOutLandscape ? 2 : 1;
        rows = isOutLandscape ? 1 : 2;
    }

    const pagesPerSheet = options.layoutMode;
    const sheetCount = Math.ceil(pageCount / pagesPerSheet);

    for (let i = 0; i < sheetCount; i++) {
        const sheet = outPdf.addPage(sheetSize);
        const { width, height } = sheet.getSize();

        for (let p = 0; p < pagesPerSheet; p++) {
            const pageIdx = i * pagesPerSheet + p;
            if (pageIdx < pageCount) {
                statusText.textContent = `ページ ${pageIdx + 1} / ${pageCount} を処理中...`;
                progressFill.style.width = `${((pageIdx + 1) / pageCount) * 100}%`;

                const [embeddedPage] = await outPdf.embedPages([srcPdf.getPage(pageIdx)]);
                const { width: origW, height: origH } = embeddedPage.size();

                const targetW = width / cols;
                const targetH = height / rows;

                const scale = Math.min(targetW / origW, targetH / origH);
                const scaledW = origW * scale;
                const scaledH = origH * scale;

                // Calculate grid position (0-indexed)
                let colIdx, rowIdx;
                if (is4Up) {
                    colIdx = p % 2;
                    rowIdx = Math.floor(p / 2);
                } else {
                    if (isOutLandscape) {
                        colIdx = p;
                        rowIdx = 0;
                    } else {
                        colIdx = 0;
                        rowIdx = p;
                    }
                }

                // Handle RTL for columns
                if (isRTL && cols > 1) {
                    colIdx = (cols - 1) - colIdx;
                }

                const xOffset = colIdx * targetW + (targetW - scaledW) / 2;
                const yOffset = (rows - 1 - rowIdx) * targetH + (targetH - scaledH) / 2;

                sheet.drawPage(embeddedPage, {
                    x: xOffset,
                    y: yOffset,
                    width: scaledW,
                    height: scaledH,
                });
            }
        }
    }

    statusText.textContent = '完了！';
    progressFill.style.width = '100%';

    processedPdfBytes = await outPdf.save();

    // Create blob and set preview
    if (currentPdfUrl) URL.revokeObjectURL(currentPdfUrl);
    const blob = new Blob([processedPdfBytes], { type: 'application/pdf' });
    currentPdfUrl = URL.createObjectURL(blob);
    pdfPreview.src = currentPdfUrl;

    setTimeout(() => {
        processingUi.style.display = 'none';
        resultActions.style.display = 'flex';
        previewArea.style.display = 'block';
    }, 500);
}

downloadBtn.addEventListener('click', () => {
    if (!processedPdfBytes) return;

    const blob = new Blob([processedPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `[2面割付]_${currentFileName}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

printBtn.addEventListener('click', () => {
    if (!processedPdfBytes) return;

    const blob = new Blob([processedPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    // Opening in a new tab is the most reliable way to trigger 
    // the browser's native PDF print and preview functionality.
    window.open(url, '_blank');
});

backBtn.addEventListener('click', () => {
    if (!currentFileArrayBuffer) return;

    // Show options panel and the re-process action button
    optionsPanel.style.display = 'grid';
    reprocessUi.style.display = 'flex'; // Use flex for centering

    // Hide current results
    resultActions.style.display = 'none';
    previewArea.style.display = 'none';
    statusArea.style.display = 'none';

    // Scroll to top to focus on settings
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

reprocessBtn.addEventListener('click', async () => {
    if (!currentFileArrayBuffer) return;

    // Get latest options from the panel
    const layoutMode = parseInt(Array.from(layoutModeRadios).find(r => r.checked).value);
    const readingDir = Array.from(readingDirRadios).find(r => r.checked).value;
    const origOrient = Array.from(origOrientRadios).find(r => r.checked).value;
    const outOrient = Array.from(outOrientRadios).find(r => r.checked).value;
    const bindingDir = Array.from(bindingRadios).find(r => r.checked).value;

    updateTips(outOrient, bindingDir);

    // Show UI state for processing
    optionsPanel.style.display = 'none';
    reprocessUi.style.display = 'none';
    statusArea.style.display = 'block';
    processingUi.style.display = 'block';
    resultActions.style.display = 'none';
    previewArea.style.display = 'none';
    progressFill.style.width = '0%';

    try {
        await processPdf(currentFileArrayBuffer, { layoutMode, readingDir, origOrient, outOrient, bindingDir });
    } catch (error) {
        console.error(error);
        alert('再変換中にエラーが発生しました。');
        reset();
    }
});

resetBtn.addEventListener('click', reset);

function updateTips(outOrient, binding) {
    const orientName = outOrient === 'landscape' ? '横' : '縦';
    const bindName = binding === 'short' ? '短辺とじ' : '長辺とじ';

    dynamicTips.innerHTML = `
        <li>用紙サイズ：プリンター設定で<strong>A4${orientName}</strong>を選択してください。</li>
        <li>両面印刷：プリンター設定で<strong>${bindName}</strong>を選択してください。</li>
        <li>倍率設定：<strong>「ページサイズに合わせる」</strong>または100%を推奨します。</li>
    `;
}

function reset() {
    dropZone.style.display = 'block';
    optionsPanel.style.display = 'grid';
    reprocessUi.style.display = 'none';
    statusArea.style.display = 'none';
    previewArea.style.display = 'none';
    pdfPreview.src = '';
    if (currentPdfUrl) {
        URL.revokeObjectURL(currentPdfUrl);
        currentPdfUrl = null;
    }
    fileInput.value = '';
    currentFileArrayBuffer = null;
}

// PWA Install Logic
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI notify the user they can install the PWA
    installBtn.style.display = 'flex';
});

installBtn.addEventListener('click', () => {
    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (isIOS) {
        iosInstallModal.style.display = 'flex';
    } else if (deferredPrompt) {
        // Show the install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
                installBtn.style.display = 'none';
            } else {
                console.log('User dismissed the install prompt');
            }
            deferredPrompt = null;
        });
    }
});

closeIosModalBtn.addEventListener('click', () => {
    iosInstallModal.style.display = 'none';
});

// Close modal when clicking outside
iosInstallModal.addEventListener('click', (e) => {
    if (e.target === iosInstallModal) {
        iosInstallModal.style.display = 'none';
    }
});

// Check if already installed (standalone mode)
window.addEventListener('appinstalled', () => {
    installBtn.style.display = 'none';
    deferredPrompt = null;
    console.log('PWA was installed');
});

// For iOS standalone check
if (window.navigator.standalone === true) {
    installBtn.style.display = 'none';
}
