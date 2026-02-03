// Global State
let loadedFiles = []; // Array of { id, name, arrayBuffer, pdfDoc }
let processedPdfBytes = null;
let currentFileName = '';
let currentPdfUrl = null;
let sourcePages = []; // State for source pages: { id, type: 'original'|'blank', pageIndex, selected }
let deferredPrompt;

// PDF Lib variables
let PDFDocument, PageSizes;

// DOM Elements (initialized in DOMContentLoaded)
let dropZone, fileInput, statusArea, fileNameDisplay, progressFill, statusText;
let resultActions, downloadBtn, printBtn, reprocessUi, backBtn, reprocessBtn, resetBtn;
let processingUi, previewArea, previewList, selectAllBtn, deselectAllBtn;
let optionsPanel, layoutModeRadios, paperSizeSelect, readingDirRadios;
let origOrientRadios, outOrientRadios, bindingRadios, dynamicTips;
let installBtn, iosInstallModal, closeIosModalBtn;
let sourcePreviewList, sourcePageCountDisplay, sourceSelectAllBtn, sourceDeselectAllBtn;
let startProcessBtn, toggleSettingsBtn, detailedSettings, clearFileBtn, addFileBtn, addFileInput;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize PDFLib
    if (typeof PDFLib !== 'undefined') {
        ({ PDFDocument, PageSizes } = PDFLib);
    } else {
        console.error('PDFLib is not loaded.');
        alert('PDFライブラリの読み込みに失敗しました。ページを再読み込みしてください。');
        return;
    }

    // Initialize DOM Elements
    dropZone = document.getElementById('drop-zone');
    fileInput = document.getElementById('file-input');
    statusArea = document.getElementById('status-area');
    fileNameDisplay = document.getElementById('file-name');
    progressFill = document.getElementById('progress-fill');
    statusText = document.getElementById('status-text');
    resultActions = document.getElementById('result-actions');
    downloadBtn = document.getElementById('download-btn');
    printBtn = document.getElementById('print-btn');
    reprocessUi = document.getElementById('reprocess-ui');
    backBtn = document.getElementById('back-btn');
    reprocessBtn = document.getElementById('reprocess-btn');
    resetBtn = document.getElementById('reset-btn');
    processingUi = document.getElementById('processing-ui');
    previewArea = document.getElementById('preview-area');
    previewList = document.getElementById('preview-list');
    selectAllBtn = document.getElementById('select-all-btn');
    deselectAllBtn = document.getElementById('deselect-all-btn');
    optionsPanel = document.getElementById('options-panel');
    paperSizeSelect = document.getElementById('paper-size-select');
    dynamicTips = document.getElementById('dynamic-tips');
    installBtn = document.getElementById('install-btn');
    iosInstallModal = document.getElementById('ios-install-modal');
    closeIosModalBtn = document.getElementById('close-ios-modal');

    // Radios (NodeLists)
    layoutModeRadios = document.getElementsByName('layout-mode');
    readingDirRadios = document.getElementsByName('reading-dir');
    origOrientRadios = document.getElementsByName('orig-orient');
    outOrientRadios = document.getElementsByName('out-orient');
    bindingRadios = document.getElementsByName('binding');

    // Source Selection Elements
    sourcePreviewList = document.getElementById('source-preview-list');
    sourcePageCountDisplay = document.getElementById('source-page-count-display');
    sourceSelectAllBtn = document.getElementById('source-select-all');
    sourceDeselectAllBtn = document.getElementById('source-deselect-all');
    startProcessBtn = document.getElementById('start-process-btn');
    toggleSettingsBtn = document.getElementById('toggle-settings-btn');
    detailedSettings = document.getElementById('detailed-settings');
    clearFileBtn = document.getElementById('clear-file-btn');
    addFileBtn = document.getElementById('add-file-btn');
    addFileInput = document.getElementById('add-file-input');

    // Attach Event Listeners
    if (dropZone) {
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
    }

    if (statusArea) {
        statusArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            statusArea.classList.add('drag-over');
        });
        statusArea.addEventListener('dragleave', () => {
            statusArea.classList.remove('drag-over');
        });
        statusArea.addEventListener('drop', (e) => {
            e.preventDefault();
            statusArea.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'application/pdf') {
                handleFile(file, true); // true = append mode
            } else {
                alert('PDFファイルを選択してください。');
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleFile(file);
            }
        });
    }

    if (addFileBtn) {
        addFileBtn.addEventListener('click', () => {
            if (addFileInput) addFileInput.click();
        });
    }

    if (addFileInput) {
        addFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleFile(file, true); // true = append mode
            }
            addFileInput.value = '';
        });
    }

    // Button Listeners
    if (downloadBtn) downloadBtn.addEventListener('click', onDownload);
    if (printBtn) printBtn.addEventListener('click', onPrint);
    if (selectAllBtn) selectAllBtn.addEventListener('click', onSelectAll);
    if (deselectAllBtn) deselectAllBtn.addEventListener('click', onDeselectAll);
    if (sourceSelectAllBtn) sourceSelectAllBtn.addEventListener('click', onSourceSelectAll);
    if (sourceDeselectAllBtn) sourceDeselectAllBtn.addEventListener('click', onSourceDeselectAll);
    if (toggleSettingsBtn) toggleSettingsBtn.addEventListener('click', onToggleSettings);
    if (clearFileBtn) clearFileBtn.addEventListener('click', onClearFile);
    if (startProcessBtn) startProcessBtn.addEventListener('click', onStartProcess);
    if (backBtn) backBtn.addEventListener('click', onBack);
    if (reprocessBtn) reprocessBtn.addEventListener('click', onReprocess);
    if (resetBtn) resetBtn.addEventListener('click', () => reset());

    // Install PWA Listeners
    if (installBtn) installBtn.addEventListener('click', onInstallClick);
    if (closeIosModalBtn) closeIosModalBtn.addEventListener('click', () => iosInstallModal.style.display = 'none');
    if (iosInstallModal) iosInstallModal.addEventListener('click', (e) => {
        if (e.target === iosInstallModal) iosInstallModal.style.display = 'none';
    });

    // Initial Render Check (PWA)
    if (window.navigator.standalone === true && installBtn) {
        installBtn.style.display = 'none';
    }

    // Lucide Icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});


// Core Functions

async function handleFile(file, isAppend = false) {
    if (!isAppend) {
        // Initial load or drag-drop replace
        currentFileName = file.name;
        fileNameDisplay.textContent = file.name;
        reset(true);
    } else {
        // Append mode
        fileNameDisplay.textContent = `${loadedFiles.length + 1} 個のファイル`;
    }

    // Get options - using getters to ensure current DOM values
    const layoutMode = getRadioValue(layoutModeRadios);
    const readingDir = getRadioValue(readingDirRadios);
    const origOrient = getRadioValue(origOrientRadios);
    const paperSize = paperSizeSelect.value;
    const outOrient = getRadioValue(outOrientRadios);
    const bindingDir = getRadioValue(bindingRadios);

    updateTips(paperSize, outOrient, bindingDir);

    dropZone.style.display = 'none';
    optionsPanel.style.display = 'none';
    reprocessUi.style.display = 'none';
    statusArea.style.display = 'block';

    processingUi.style.display = 'block';
    if (!isAppend) {
        resultActions.style.display = 'none';
        progressFill.style.width = '0%';
        statusText.textContent = 'PDFを読み込み中...';
    } else {
        statusText.textContent = '追加ファイルを読み込み中...';
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);

        const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        loadedFiles.push({
            id: fileId,
            name: file.name,
            arrayBuffer: arrayBuffer,
            pdfDoc: pdfDoc
        });

        const pageCount = pdfDoc.getPageCount();
        for (let i = 0; i < pageCount; i++) {
            sourcePages.push({
                id: `orig-${fileId}-${i}`,
                type: 'original',
                fileId: fileId,
                pageIndex: i,
                selected: true
            });
        }

        await renderSourcePreview();

        optionsPanel.style.display = 'grid';
        dropZone.style.display = 'none';
        processingUi.style.display = 'none';

    } catch (error) {
        console.error(error);
        alert('PDFの処理中にエラーが発生しました。: ' + error.message);
    }
}

async function processPdf(unusedBufferIsGone, options) {
    statusText.textContent = '割付処理を開始します...';
    const outPdf = await PDFDocument.create();

    const activePages = sourcePages.filter(p => p.selected);

    if (activePages.length === 0) {
        alert('処理対象のページがありません。');
        reset();
        return;
    }

    const activePageCount = activePages.length;

    const sizes = {
        'a4': [595.28, 841.89],
        'a3': [841.89, 1190.55],
        'b4': [728.50, 1031.80],
        'b5': [515.91, 728.50]
    };

    const baseSize = sizes[options.paperSize] || sizes['a4'];
    const isOutLandscape = options.outOrient === 'landscape';
    const sheetSize = isOutLandscape ? [Math.max(...baseSize), Math.min(...baseSize)] : [Math.min(...baseSize), Math.max(...baseSize)];

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
    const sheetCount = Math.ceil(activePageCount / pagesPerSheet);

    for (let i = 0; i < sheetCount; i++) {
        const sheet = outPdf.addPage(sheetSize);
        const { width, height } = sheet.getSize();

        for (let p = 0; p < pagesPerSheet; p++) {
            const targetIndex = i * pagesPerSheet + p;

            if (targetIndex < activePageCount) {
                statusText.textContent = `ページ ${targetIndex + 1} / ${activePageCount} を処理中...`;
                progressFill.style.width = `${((targetIndex + 1) / activePageCount) * 100}%`;

                const pageData = activePages[targetIndex];

                if (pageData.type === 'original') {
                    const fileObj = loadedFiles.find(f => f.id === pageData.fileId);
                    if (fileObj) {
                        const [embeddedPage] = await outPdf.embedPages([fileObj.pdfDoc.getPage(pageData.pageIndex)]);
                        const { width: origW, height: origH } = embeddedPage.size();

                        const targetW = width / cols;
                        const targetH = height / rows;

                        const scale = Math.min(targetW / origW, targetH / origH);
                        const scaledW = origW * scale;
                        const scaledH = origH * scale;

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
        }
    }

    statusText.textContent = '完了！';
    progressFill.style.width = '100%';

    processedPdfBytes = await outPdf.save();
    // Pass a copy to avoid detachment by PDF.js worker
    await renderPreview(processedPdfBytes.slice(0));

    setTimeout(() => {
        processingUi.style.display = 'none';
        resultActions.style.display = 'flex';
        previewArea.style.display = 'block';
    }, 500);
}

async function renderSourcePreview() {
    sourcePreviewList.innerHTML = '';

    for (let i = 0; i < sourcePages.length; i++) {
        const pageData = sourcePages[i];

        const card = document.createElement('div');
        card.className = `source-page-item ${pageData.selected ? 'selected' : 'deselected'}`;
        if (pageData.type === 'blank') {
            card.classList.add('page-type-blank');
        }
        card.dataset.index = i;

        card.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            pageData.selected = !pageData.selected;
            if (pageData.selected) {
                card.classList.add('selected');
                card.classList.remove('deselected');
            } else {
                card.classList.remove('selected');
                card.classList.add('deselected');
            }
            updateSourceCountDisplay();
        });

        if (pageData.type === 'original') {
            const fileObj = loadedFiles.find(f => f.id === pageData.fileId);
            if (fileObj) {
                if (!fileObj.pdfjsDoc) {
                    fileObj.pdfjsDoc = await pdfjsLib.getDocument(fileObj.arrayBuffer.slice(0)).promise;
                }
                const page = await fileObj.pdfjsDoc.getPage(pageData.pageIndex + 1);

                const viewport = page.getViewport({ scale: 0.3 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({ canvasContext: context, viewport: viewport }).promise;
                card.appendChild(canvas);

                const label = document.createElement('div');
                label.textContent = `P${pageData.pageIndex + 1}`;
                label.style.marginTop = '0.5rem';
                label.style.fontSize = '0.8rem';
                card.appendChild(label);
            }
        } else {
            const blankDiv = document.createElement('div');
            blankDiv.style.width = '100px';
            blankDiv.style.height = '141px';
            blankDiv.style.background = 'white';
            blankDiv.style.border = '1px dashed #ccc';
            blankDiv.style.display = 'flex';
            blankDiv.style.alignItems = 'center';
            blankDiv.style.justifyContent = 'center';
            blankDiv.textContent = '白紙';
            blankDiv.style.color = '#ccc';
            card.appendChild(blankDiv);

            const label = document.createElement('div');
            label.textContent = `(白紙)`;
            label.style.marginTop = '0.5rem';
            label.style.fontSize = '0.8rem';
            card.appendChild(label);
        }

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'card-actions';
        actionsDiv.style.display = 'flex';
        actionsDiv.style.gap = '8px';
        actionsDiv.style.marginTop = '8px';

        const addBtn = document.createElement('button');
        addBtn.className = 'btn-icon-sm';
        addBtn.title = '後ろに白紙を挿入';
        addBtn.innerHTML = '<i data-lucide="plus"></i>';
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            insertBlankPage(i);
        });
        actionsDiv.appendChild(addBtn);

        if (pageData.type === 'blank') {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-icon-sm btn-danger';
            removeBtn.title = '削除';
            removeBtn.innerHTML = '<i data-lucide="trash-2"></i>';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removePage(i);
            });
            actionsDiv.appendChild(removeBtn);
        }

        card.appendChild(actionsDiv);
        sourcePreviewList.appendChild(card);
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
    updateSourceCountDisplay();
}

// Helpers
function insertBlankPage(index) {
    sourcePages.splice(index + 1, 0, {
        id: `blank-${Date.now()}`,
        type: 'blank',
        pageIndex: null,
        selected: true
    });
    renderSourcePreview();
}

function removePage(index) {
    sourcePages.splice(index, 1);
    renderSourcePreview();
}

function updateSourceCountDisplay() {
    const selectedCount = sourcePages.filter(p => p.selected).length;
    const totalCount = sourcePages.length;
    sourcePageCountDisplay.textContent = `${selectedCount} / ${totalCount} ページ選択中`;
}

async function renderPreview(pdfBytes) {
    previewList.innerHTML = '';
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const scale = 0.5; // Smaller scale for thumbnail
        const viewport = page.getViewport({ scale: scale });

        const item = document.createElement('div');
        item.className = 'page-preview-item selected';
        item.onclick = (e) => {
            if (e.target.tagName !== 'INPUT') {
                const checkbox = item.querySelector('input');
                checkbox.checked = !checkbox.checked;
                updateSelectionState(item, checkbox);
            }
        };

        const canvas = document.createElement('canvas');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        const renderContext = {
            canvasContext: canvas.getContext('2d'),
            viewport: viewport
        };
        await page.render(renderContext).promise;

        const labelDiv = document.createElement('div');
        labelDiv.className = 'page-label';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'page-checkbox';
        checkbox.checked = true;
        checkbox.onchange = () => updateSelectionState(item, checkbox);
        const labelText = document.createElement('span');
        labelText.textContent = `ページ ${i}`;
        labelDiv.appendChild(checkbox);
        labelDiv.appendChild(labelText);

        item.appendChild(canvas);
        item.appendChild(labelDiv);
        previewList.appendChild(item);
    }
}

function updateSelectionState(item, checkbox) {
    if (checkbox.checked) {
        item.classList.add('selected');
    } else {
        item.classList.remove('selected');
    }
}

async function getSelectedPdfBytes() {
    try {
        if (!processedPdfBytes) return null;
        const checkboxes = previewList.querySelectorAll('.page-checkbox');
        const selectedIndices = [];
        checkboxes.forEach((cb, idx) => {
            if (cb.checked) selectedIndices.push(idx);
        });

        if (selectedIndices.length === 0) {
            alert('印刷するページを選択してください。');
            return null;
        }

        let finalBytes;
        if (selectedIndices.length === checkboxes.length) {
            // Return a guaranteed deep copy of the bytes to avoid detachment
            finalBytes = new Uint8Array(processedPdfBytes);
        } else {
            const pdfDoc = await PDFDocument.load(processedPdfBytes);
            const newPdf = await PDFDocument.create();
            const copiedPages = await newPdf.copyPages(pdfDoc, selectedIndices);
            copiedPages.forEach(page => newPdf.addPage(page));
            finalBytes = await newPdf.save();
        }

        // Return as a fresh Uint8Array to ensure transparency
        return new Uint8Array(finalBytes);
    } catch (err) {
        console.error('PDF selection error:', err);
        throw new Error('PDFデータの抽出に失敗しました: ' + err.message);
    }
}

function updateTips(paperSize, outOrient, binding) {
    const orientName = outOrient === 'landscape' ? '横' : '縦';
    const bindName = binding === 'short' ? '短辺とじ' : '長辺とじ';

    dynamicTips.innerHTML = `
        <li>用紙サイズ：プリンター設定で<strong>${paperSize.toUpperCase()} ${orientName}</strong>を選択してください。</li>
        <li>両面印刷：プリンター設定で<strong>${bindName}</strong>を選択してください。</li>
        <li>倍率設定：<strong>「ページサイズに合わせる」</strong>または100%を推奨します。</li>
    `;
}

function reset(keepUI = false) {
    dropZone.style.display = 'block';
    optionsPanel.style.display = 'grid';
    reprocessUi.style.display = 'none';
    statusArea.style.display = 'none';
    previewArea.style.display = 'none';
    previewList.innerHTML = '';
    sourcePreviewList.innerHTML = '';
    sourcePages = [];
    loadedFiles = [];

    // reset variables 
    currentFileName = '';
    currentPdfUrl = null;

    if (fileInput) fileInput.value = '';
}

function getRadioValue(radios) {
    if (!radios) return null;
    return Array.from(radios).find(r => r.checked)?.value;
}

// Event Handlers for Buttons (to be attached in DOMContentLoaded)
async function onDownload() {
    try {
        const bytes = await getSelectedPdfBytes();
        if (!bytes) return;

        const isMobile = /iPad|iPhone|iPod|Android/.test(navigator.userAgent);
        const fileName = `[2面割付]_${currentFileName || 'download.pdf'}`;

        if (isMobile) {
            const blob = new Blob([bytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            showCompletionModal(url, fileName, false, bytes);
        } else {
            const blob = new Blob([bytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 10000);
            }, 1000);
        }
    } catch (err) {
        console.error('Download error:', err);
        alert('ダウンロード中にエラーが発生しました。: ' + err.message);
    }
}

async function onPrint() {
    try {
        const bytes = await getSelectedPdfBytes();
        if (!bytes) return;

        const isMobile = /iPad|iPhone|iPod|Android/.test(navigator.userAgent);
        const fileName = `[印刷用]_${currentFileName || 'document.pdf'}`;
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        if (isMobile) {
            showCompletionModal(url, fileName, true, bytes);
        } else {
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 60000);
            }, 1000);
        }
    } catch (err) {
        console.error('Print error:', err);
        alert('印刷の準備中にエラーが発生しました。\n詳細: ' + err.message);
    }
}

function showCompletionModal(url, fileName, isPrint, bytes) {
    let modal = document.getElementById('completion-modal');
    if (modal) document.body.removeChild(modal);

    modal = document.createElement('div');
    modal.id = 'completion-modal';
    Object.assign(modal.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        backgroundColor: 'rgba(15, 23, 42, 0.95)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: '9999',
        backdropFilter: 'blur(10px)', padding: '20px'
    });

    const content = document.createElement('div');
    content.className = 'glass-card';
    Object.assign(content.style, {
        padding: '2rem', textAlign: 'center', maxWidth: '400px', width: '100%',
        border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(30, 41, 59, 0.7)',
        borderRadius: '20px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
    });

    const titleStr = isPrint ? '印刷プレビュー' : 'PDFの保存';
    const descStr = isPrint
        ? '下のボタンからPDFを表示、または共有して印刷してください。'
        : '下のボタンからPDFを共有または保存してください。';

    content.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
            <i data-lucide="${isPrint ? 'printer' : 'download'}" style="width:48px;height:48px;color:#60a5fa"></i>
        </div>
        <h3 style="color:white;margin-bottom:1rem;font-size:1.25rem;">${titleStr}</h3>
        <p style="color:#94a3b8;margin-bottom:2rem;font-size:0.9rem;line-height:1.6;">${descStr}</p>
        <div id="modal-actions" style="display:flex;flex-direction:column;gap:1rem;"></div>
        <button id="modal-close" class="btn-text" style="margin-top:1.5rem;width:100%;color:#94a3b8">閉じる</button>
    `;

    const actionsContainer = content.querySelector('#modal-actions');

    // Share Button (Robust for Mobile)
    if (navigator.share && bytes) {
        const shareBtn = document.createElement('button');
        shareBtn.className = 'btn btn-primary';
        shareBtn.style.width = '100%';
        shareBtn.style.padding = '1rem';
        shareBtn.innerHTML = `<i data-lucide="share-2" style="width:18px;margin-right:8px;vertical-align:middle;"></i> ${isPrint ? '共有から印刷・保存' : '共有・保存'}`;
        shareBtn.onclick = async () => {
            try {
                const file = new File([new Uint8Array(bytes)], fileName, { type: 'application/pdf' });
                await navigator.share({
                    files: [file],
                    title: fileName
                });
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Share failed:', err);
                    window.open(url, '_blank');
                }
            }
        };
        actionsContainer.appendChild(shareBtn);
    }

    // Direct View Button (Fallback)
    const viewBtn = document.createElement('a');
    viewBtn.className = 'btn';
    viewBtn.style.width = '100%';
    viewBtn.style.padding = '1rem';
    viewBtn.style.background = 'rgba(255,255,255,0.05)';
    viewBtn.style.border = '1px solid rgba(255,255,255,0.1)';
    viewBtn.style.color = 'white';
    viewBtn.style.textDecoration = 'none';
    viewBtn.style.display = 'block';
    viewBtn.href = url;
    viewBtn.target = '_blank';
    viewBtn.innerHTML = `<i data-lucide="external-link" style="width:18px;margin-right:8px;vertical-align:middle;"></i> ブラウザでPDFを開く`;
    actionsContainer.appendChild(viewBtn);

    modal.appendChild(content);
    document.body.appendChild(modal);

    document.getElementById('modal-close').onclick = () => {
        document.body.removeChild(modal);
        // Delay revocation
        setTimeout(() => URL.revokeObjectURL(url), 300000);
    };

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function onSelectAll() {
    const items = previewList.querySelectorAll('.page-preview-item');
    items.forEach(item => {
        const cb = item.querySelector('input');
        cb.checked = true;
        updateSelectionState(item, cb);
    });
}

function onDeselectAll() {
    const items = previewList.querySelectorAll('.page-preview-item');
    items.forEach(item => {
        const cb = item.querySelector('input');
        cb.checked = false;
        updateSelectionState(item, cb);
    });
}

function onSourceSelectAll() {
    sourcePages.forEach(p => p.selected = true);
    renderSourcePreview();
}

function onSourceDeselectAll() {
    sourcePages.forEach(p => p.selected = false);
    renderSourcePreview();
}

function onToggleSettings() {
    const isHidden = detailedSettings.style.display === 'none';
    if (isHidden) {
        detailedSettings.style.display = 'block';
        toggleSettingsBtn.querySelector('span').textContent = '詳細設定を隠す';
        toggleSettingsBtn.querySelector('i').setAttribute('data-lucide', 'chevron-up');
    } else {
        detailedSettings.style.display = 'none';
        toggleSettingsBtn.querySelector('span').textContent = '詳細設定を調整する';
        toggleSettingsBtn.querySelector('i').setAttribute('data-lucide', 'chevron-down');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function onClearFile() {
    if (confirm('ファイルを削除して最初に戻りますか？')) {
        reset();
    }
}

async function onStartProcess() {
    if (loadedFiles.length === 0) return;
    const layoutMode = parseInt(getRadioValue(layoutModeRadios));
    const readingDir = getRadioValue(readingDirRadios);
    const origOrient = getRadioValue(origOrientRadios);
    const paperSize = paperSizeSelect.value;
    const outOrient = getRadioValue(outOrientRadios);
    const bindingDir = getRadioValue(bindingRadios);

    updateTips(paperSize, outOrient, bindingDir);

    optionsPanel.style.display = 'none';
    reprocessUi.style.display = 'none';
    statusArea.style.display = 'block';
    processingUi.style.display = 'block';
    resultActions.style.display = 'none';
    previewArea.style.display = 'none';
    progressFill.style.width = '0%';

    try {
        await processPdf(null, { layoutMode, readingDir, origOrient, paperSize, outOrient, bindingDir });
    } catch (error) {
        console.error(error);
        alert('変換中にエラーが発生しました。');
        optionsPanel.style.display = 'grid';
        processingUi.style.display = 'none';
    }
}

function onBack() {
    if (loadedFiles.length === 0) return;
    optionsPanel.style.display = 'grid';
    reprocessUi.style.display = 'flex';
    resultActions.style.display = 'none';
    previewArea.style.display = 'none';
    statusArea.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function onReprocess() {
    if (loadedFiles.length === 0) return;
    const layoutMode = parseInt(getRadioValue(layoutModeRadios));
    const readingDir = getRadioValue(readingDirRadios);
    const origOrient = getRadioValue(origOrientRadios);
    const paperSize = paperSizeSelect.value;
    const outOrient = getRadioValue(outOrientRadios);
    const bindingDir = getRadioValue(bindingRadios);

    updateTips(paperSize, outOrient, bindingDir);

    optionsPanel.style.display = 'none';
    reprocessUi.style.display = 'none';
    statusArea.style.display = 'block';
    processingUi.style.display = 'block';
    resultActions.style.display = 'none';
    previewArea.style.display = 'none';
    progressFill.style.width = '0%';

    try {
        await processPdf(null, { layoutMode, readingDir, origOrient, paperSize, outOrient, bindingDir });
    } catch (error) {
        console.error(error);
        alert('再変換中にエラーが発生しました。');
        processingUi.style.display = 'none';
        optionsPanel.style.display = 'grid';
    }
}

function onInstallClick() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (isIOS) {
        if (iosInstallModal) iosInstallModal.style.display = 'flex';
    } else if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
                if (installBtn) installBtn.style.display = 'none';
            } else {
                console.log('User dismissed the install prompt');
            }
            deferredPrompt = null;
        });
    } else {
        alert('インストールの準備ができていないか、このブラウザではサポートされていません。\n(HTTPS接続やシークレットモードでないことを確認してください)');
    }
}

// PWA Event
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.style.display = 'flex';
});

window.addEventListener('appinstalled', () => {
    if (installBtn) installBtn.style.display = 'none';
    deferredPrompt = null;
    console.log('PWA was installed');
});
