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
const previewList = document.getElementById('preview-list');
const selectAllBtn = document.getElementById('select-all-btn');
const deselectAllBtn = document.getElementById('deselect-all-btn');
const optionsPanel = document.getElementById('options-panel');
const layoutModeRadios = document.getElementsByName('layout-mode');
const paperSizeSelect = document.getElementById('paper-size-select');
const readingDirRadios = document.getElementsByName('reading-dir');
const origOrientRadios = document.getElementsByName('orig-orient');
const outOrientRadios = document.getElementsByName('out-orient');
const bindingRadios = document.getElementsByName('binding');
const dynamicTips = document.getElementById('dynamic-tips');
const installBtn = document.getElementById('install-btn');
const iosInstallModal = document.getElementById('ios-install-modal');
const closeIosModalBtn = document.getElementById('close-ios-modal');

// Source Selection Elements
const sourcePreviewList = document.getElementById('source-preview-list');
const sourcePageCountDisplay = document.getElementById('source-page-count-display');
const sourceSelectAllBtn = document.getElementById('source-select-all');
const sourceDeselectAllBtn = document.getElementById('source-deselect-all');
const startProcessBtn = document.getElementById('start-process-btn');
const toggleSettingsBtn = document.getElementById('toggle-settings-btn');
const detailedSettings = document.getElementById('detailed-settings');
const clearFileBtn = document.getElementById('clear-file-btn');

let deferredPrompt;

let currentFileArrayBuffer = null;
let processedPdfBytes = null;
let currentFileName = '';
let currentPdfUrl = null;
let sourcePages = []; // State for source pages: { id, type: 'original'|'blank', pageIndex, selected }

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
    const paperSize = paperSizeSelect.value;
    const outOrient = Array.from(outOrientRadios).find(r => r.checked).value;
    const bindingDir = Array.from(bindingRadios).find(r => r.checked).value;

    updateTips(paperSize, outOrient, bindingDir);

    dropZone.style.display = 'none';
    optionsPanel.style.display = 'none';
    reprocessUi.style.display = 'none';
    statusArea.style.display = 'block';
    processingUi.style.display = 'block';
    resultActions.style.display = 'none';
    progressFill.style.width = '0%';
    statusText.textContent = 'PDFを読み込み中...';

    // Generate source preview
    try {
        currentFileArrayBuffer = await file.arrayBuffer();

        // Initialize source pages state
        const inputPdf = await PDFDocument.load(currentFileArrayBuffer);
        const pageCount = inputPdf.getPageCount();
        sourcePages = [];
        for (let i = 0; i < pageCount; i++) {
            sourcePages.push({
                id: `orig-${i}`,
                type: 'original',
                pageIndex: i,
                selected: true
            });
        }

        // Initial rendering of source preview
        await renderSourcePreview(currentFileArrayBuffer.slice(0));

        // Manual Flow: Wait for user to click "Start"
        // Ensure options are visible
        optionsPanel.style.display = 'grid';
        dropZone.style.display = 'none';

        // await processPdf(currentFileArrayBuffer.slice(0), { layoutMode, readingDir, origOrient, paperSize, outOrient, bindingDir });
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

    // Select base dimension
    const baseSize = sizes[options.paperSize] || sizes['a4'];

    // User selected output orientation
    const isOutLandscape = options.outOrient === 'landscape';
    // Set width/height based on orientation
    const sheetSize = isOutLandscape ? [Math.max(...baseSize), Math.min(...baseSize)] : [Math.min(...baseSize), Math.max(...baseSize)];

    // Grid determination
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
                    const [embeddedPage] = await outPdf.embedPages([srcPdf.getPage(pageData.pageIndex)]);
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
                // If blank, do nothing (empty slot)
            }
        }
    }

    statusText.textContent = '完了！';
    progressFill.style.width = '100%';

    processedPdfBytes = await outPdf.save();

    // Render preview using PDF.js
    await renderPreview(processedPdfBytes);

    setTimeout(() => {
        processingUi.style.display = 'none';
        resultActions.style.display = 'flex';
        previewArea.style.display = 'block';
    }, 500);
}

// Render Source Preview with Sortable/Selectable Grid
async function renderSourcePreview(arrayBuffer) {
    sourcePreviewList.innerHTML = '';
    const pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;

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
            const page = await pdfDoc.getPage(pageData.pageIndex + 1);
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
    lucide.createIcons();
    updateSourceCountDisplay();
}

function insertBlankPage(index) {
    sourcePages.splice(index + 1, 0, {
        id: `blank-${Date.now()}`,
        type: 'blank',
        pageIndex: null,
        selected: true
    });
    if (currentFileArrayBuffer) {
        renderSourcePreview(currentFileArrayBuffer.slice(0));
    }
}

function removePage(index) {
    sourcePages.splice(index, 1);
    if (currentFileArrayBuffer) {
        renderSourcePreview(currentFileArrayBuffer.slice(0));
    }
}

function updateSourceCountDisplay(selected = null, total = null) {
    const selectedCount = sourcePages.filter(p => p.selected).length;
    const totalCount = sourcePages.length;
    sourcePageCountDisplay.textContent = `${selectedCount} / ${totalCount} ページ選択中`;
}

function getSelectedSourceIndices() {
    return []; // Deprecated
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

        // Create container
        const item = document.createElement('div');
        item.className = 'page-preview-item selected';
        item.onclick = (e) => {
            if (e.target.tagName !== 'INPUT') {
                const checkbox = item.querySelector('input');
                checkbox.checked = !checkbox.checked;
                updateSelectionState(item, checkbox);
            }
        };

        // Canvas
        const canvas = document.createElement('canvas');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        const renderContext = {
            canvasContext: canvas.getContext('2d'),
            viewport: viewport
        };
        await page.render(renderContext).promise;

        // Label & Checkbox
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
    if (!processedPdfBytes) return null;

    // Get selected indices (0-indexed)
    const checkboxes = previewList.querySelectorAll('.page-checkbox');
    const selectedIndices = [];
    checkboxes.forEach((cb, idx) => {
        if (cb.checked) selectedIndices.push(idx);
    });

    // Render Source Preview with Sortable/Selectable Grid
    // Updated to use sourcePages state and support insertion
    async function renderSourcePreview(arrayBuffer) {
        sourcePreviewList.innerHTML = '';
        const pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;

        for (let i = 0; i < sourcePages.length; i++) {
            const pageData = sourcePages[i];

            const card = document.createElement('div');
            card.className = `source-page-item ${pageData.selected ? 'selected' : 'deselected'}`;
            if (pageData.type === 'blank') {
                card.classList.add('page-type-blank');
            }
            card.dataset.index = i;

            // Selection Toggle Handler (skip if clicking buttons)
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

            // Content
            if (pageData.type === 'original') {
                const page = await pdfDoc.getPage(pageData.pageIndex + 1);
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
            } else {
                // Blank Page
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

            // Actions
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
        lucide.createIcons();
        updateSourceCountDisplay();
    }

    function insertBlankPage(index) {
        sourcePages.splice(index + 1, 0, {
            id: `blank-${Date.now()}`,
            type: 'blank',
            pageIndex: null,
            selected: true
        });
        if (currentFileArrayBuffer) {
            renderSourcePreview(currentFileArrayBuffer.slice(0));
        }
    }

    function removePage(index) {
        sourcePages.splice(index, 1);
        if (currentFileArrayBuffer) {
            renderSourcePreview(currentFileArrayBuffer.slice(0));
        }
    }

    function updateSourceCountDisplay() {
        const selectedCount = sourcePages.filter(p => p.selected).length;
        const totalCount = sourcePages.length;
        sourcePageCountDisplay.textContent = `${selectedCount} / ${totalCount} ページ選択中`;
    }

    function getSelectedSourceIndices() {
        return []; // Deprecated
    }

    // If all pages selected, return original
    if (selectedIndices.length === checkboxes.length) {
        return processedPdfBytes;
    }

    // Create new PDF with subset
    const pdfDoc = await PDFDocument.load(processedPdfBytes);
    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(pdfDoc, selectedIndices);
    copiedPages.forEach(page => newPdf.addPage(page));

    return await newPdf.save();
}

// Render Source Preview with Sortable/Selectable Grid
async function renderSourcePreview(arrayBuffer) {
    sourcePreviewList.innerHTML = '';
    const pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;

    for (let i = 0; i < sourcePages.length; i++) {
        const pageData = sourcePages[i];

        const card = document.createElement('div');
        card.className = `source-page-item ${pageData.selected ? 'selected' : 'deselected'}`;
        if (pageData.type === 'blank') {
            card.classList.add('page-type-blank');
        }
        card.dataset.index = i;

        // Selection Toggle Handler
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
            const page = await pdfDoc.getPage(pageData.pageIndex + 1);
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
    lucide.createIcons();
    updateSourceCountDisplay();
}

function insertBlankPage(index) {
    sourcePages.splice(index + 1, 0, {
        id: `blank-${Date.now()}`,
        type: 'blank',
        pageIndex: null,
        selected: true
    });
    if (currentFileArrayBuffer) {
        renderSourcePreview(currentFileArrayBuffer.slice(0));
    }
}

function removePage(index) {
    sourcePages.splice(index, 1);
    if (currentFileArrayBuffer) {
        renderSourcePreview(currentFileArrayBuffer.slice(0));
    }
}

function updateSourceCountDisplay() {
    const selectedCount = sourcePages.filter(p => p.selected).length;
    const totalCount = sourcePages.length;
    sourcePageCountDisplay.textContent = `${selectedCount} / ${totalCount} ページ選択中`;
}

function getSelectedSourceIndices() {
    return []; // Deprecated
}

downloadBtn.addEventListener('click', async () => {
    const bytes = await getSelectedPdfBytes();
    if (!bytes) return;

    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `[2面割付]_${currentFileName}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

printBtn.addEventListener('click', async () => {
    const bytes = await getSelectedPdfBytes();
    if (!bytes) return;

    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
});

selectAllBtn.addEventListener('click', () => {
    const items = previewList.querySelectorAll('.page-preview-item');
    items.forEach(item => {
        const cb = item.querySelector('input');
        cb.checked = true;
        updateSelectionState(item, cb);
    });
});

deselectAllBtn.addEventListener('click', () => {
    const items = previewList.querySelectorAll('.page-preview-item');
    items.forEach(item => {
        const cb = item.querySelector('input');
        cb.checked = false;
        updateSelectionState(item, cb);
    });
});

sourceSelectAllBtn.addEventListener('click', () => {
    sourcePages.forEach(p => p.selected = true);
    if (currentFileArrayBuffer) renderSourcePreview(currentFileArrayBuffer.slice(0));
});

sourceDeselectAllBtn.addEventListener('click', () => {
    sourcePages.forEach(p => p.selected = false);
    if (currentFileArrayBuffer) renderSourcePreview(currentFileArrayBuffer.slice(0));
});

toggleSettingsBtn.addEventListener('click', () => {
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
    lucide.createIcons();
});

clearFileBtn.addEventListener('click', () => {
    if (confirm('ファイルを削除して最初に戻りますか？')) {
        reset();
    }
});

startProcessBtn.addEventListener('click', async () => {
    if (!currentFileArrayBuffer) return;

    // Get latest options
    const layoutMode = parseInt(Array.from(layoutModeRadios).find(r => r.checked).value);
    const readingDir = Array.from(readingDirRadios).find(r => r.checked).value;
    const origOrient = Array.from(origOrientRadios).find(r => r.checked).value;
    const paperSize = paperSizeSelect.value;
    const outOrient = Array.from(outOrientRadios).find(r => r.checked).value;
    const bindingDir = Array.from(bindingRadios).find(r => r.checked).value;

    updateTips(paperSize, outOrient, bindingDir);

    // Show processing UI
    optionsPanel.style.display = 'none';
    reprocessUi.style.display = 'none';
    statusArea.style.display = 'block';
    processingUi.style.display = 'block';
    resultActions.style.display = 'none';
    previewArea.style.display = 'none';
    progressFill.style.width = '0%';

    try {
        await processPdf(currentFileArrayBuffer.slice(0), { layoutMode, readingDir, origOrient, paperSize, outOrient, bindingDir });
    } catch (error) {
        console.error(error);
        alert('変換中にエラーが発生しました。');
        optionsPanel.style.display = 'grid';
        processingUi.style.display = 'none';
    }
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
    const paperSize = paperSizeSelect.value;
    const outOrient = Array.from(outOrientRadios).find(r => r.checked).value;
    const bindingDir = Array.from(bindingRadios).find(r => r.checked).value;

    updateTips(paperSize, outOrient, bindingDir);

    // Show UI state for processing
    optionsPanel.style.display = 'none';
    reprocessUi.style.display = 'none';
    statusArea.style.display = 'block';
    processingUi.style.display = 'block';
    resultActions.style.display = 'none';
    previewArea.style.display = 'none';
    progressFill.style.width = '0%';

    try {
        await processPdf(currentFileArrayBuffer.slice(0), { layoutMode, readingDir, origOrient, paperSize, outOrient, bindingDir });
    } catch (error) {
        console.error(error);
        alert('再変換中にエラーが発生しました。');
        reset();
    }
});

resetBtn.addEventListener('click', reset);

function updateTips(paperSize, outOrient, binding) {
    const orientName = outOrient === 'landscape' ? '横' : '縦';
    const bindName = binding === 'short' ? '短辺とじ' : '長辺とじ';

    dynamicTips.innerHTML = `
        <li>用紙サイズ：プリンター設定で<strong>${paperSize.toUpperCase()} ${orientName}</strong>を選択してください。</li>
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
    previewList.innerHTML = ''; // Clear items
    sourcePreviewList.innerHTML = ''; // Clear source items

    // Clear canvas
    const ctx = pdfPreviewCanvas.getContext('2d');
    ctx.clearRect(0, 0, pdfPreviewCanvas.width, pdfPreviewCanvas.height);

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
