/**
 * Bảng command của menubar (P5-5).
 *
 * Section `shell` là composition root nên được phép gọi mọi section, nhưng để
 * `app.js` vẫn là nơi duy nhất giữ các hàm điều phối trong giai đoạn chuyển
 * tiếp, bảng này nhận **deps** đã tiêm và chỉ lo việc định tuyến tên → hành vi.
 */

/**
 * @param {{
 *   getState: () => object,
 *   toast: (msg:string, kind?:string, ms?:number) => void,
 *   openSizeModal: (mode:string) => void,
 *   openTransformModal: () => void,
 *   openStrokeModal: () => void,
 *   openDocBgPicker: () => void,
 *   openExport: () => void,
 *   openDrawer: () => void,
 *   openPaneUI: (name:string) => void,
 *   goStart: () => void,
 *   saveNow: () => void,
 *   undo: () => void,
 *   redo: () => void,
 *   copySelection: (cut:boolean) => void,
 *   pasteClipboard: () => void,
 *   fillSelected: () => void,
 *   clearSelectedContent: () => void,
 *   cropToSelection: () => void,
 *   flipDoc: (horizontal:boolean) => void,
 *   rotateDoc: (dir:number) => void,
 *   applyFilter: (kind:string, done?:string) => void,
 *   addLayer: () => void,
 *   duplicateLayer: () => void,
 *   deleteLayer: () => void,
 *   mergeDown: () => void,
 *   mergeAll: () => void,
 *   selectAll: () => void,
 *   clearSelection: () => void,
 *   invertSelection: () => void,
 *   selectLayerContent: () => void,
 *   setTool: (tool:string) => void,
 *   clearGuides: () => void,
 *   importImage: () => void,
 * }} d
 * @returns {(name:string) => void}
 */
export function createCommands(d) {
  const table = {
    new: () => d.openSizeModal('new'),
    open: () => d.goStart(),
    save: () => d.saveNow(),
    export: () => d.openExport(),
    import: () => d.importImage(),
    nott: () => d.openDrawer(),
    undo: () => d.undo(),
    redo: () => d.redo(),
    cut: () => d.copySelection(true),
    copy: () => d.copySelection(false),
    paste: () => d.pasteClipboard(),
    fill: () => d.fillSelected(),
    strokeSel: () => d.openStrokeModal(),
    clear: () => d.clearSelectedContent(),
    imageSize: () => d.openSizeModal('image'),
    canvasSize: () => d.openSizeModal('canvas'),
    crop: () => d.cropToSelection(),
    flipH: () => d.flipDoc(true),
    flipV: () => d.flipDoc(false),
    rotateL: () => d.rotateDoc(-1),
    rotateR: () => d.rotateDoc(1),
    invertColors: () => d.applyFilter('invert', 'Đã đảo màu lớp'),
    docBg: () => d.openDocBgPicker(),
    clearGuides: () => d.clearGuides(),
    layerAdd: () => d.addLayer(),
    layerDup: () => d.duplicateLayer(),
    layerDel: () => d.deleteLayer(),
    mergeDown: () => d.mergeDown(),
    mergeAll: () => d.mergeAll(),
    layerTransform: () => d.openTransformModal(),
    selectAll: () => d.selectAll(),
    deselect: () => d.clearSelection(),
    invertSel: () => d.invertSelection(),
    selectLayerContent: () => d.selectLayerContent(),
    wand: () => d.setTool('wand'),
    marquee: () => d.setTool('marquee'),
    lasso: () => d.setTool('lasso'),
    filterBlur: () => d.applyFilter('blur', 'Đã làm mờ lớp'),
    filterSharpen: () => d.applyFilter('sharpen', 'Đã làm nét lớp'),
    filterNoise: () => d.applyFilter('noise', 'Đã thêm nhiễu hạt'),
    filterPixel: () => d.applyFilter('pixel', 'Đã pixel hoá lớp'),
    filterEmboss: () => d.applyFilter('emboss', 'Đã dập nổi lớp'),
    filterVignette: () => d.applyFilter('vignette', 'Đã làm tối bốn góc'),
    filterGrain: () => d.applyFilter('grain', 'Đã phủ hạt phim'),
    filterGray: () => d.applyFilter('gray', 'Đã chuyển trắng đen'),
    filterSepia: () => d.applyFilter('sepia', 'Đã phủ nâu cổ'),
    adjustPane: () => d.openPaneUI('adjust'),
  };

  return function runCommand(name) {
    const needDoc = !['new', 'open', 'help'].includes(name);
    if (needDoc && !d.getState().doc) { d.toast('Mở một bản vẽ trước đã', 'warn'); return; }
    const fn = table[name];
    if (fn) fn();
  };
}
