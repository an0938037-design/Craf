# `ui/` — panel và chrome

## Owns
- `start.js` — `renderPresets`, `openCustomPreset`, `projectCard`, `timeAgo`, `renderRecent`, `renderTemplates`, `paintTemplatePreviews`.
- `nott.js` — `renderNott`, `openDrawer`, `closeDrawer`.
- `layers.js` — `renderLayers`, `selectLayer`, `startRename`, `syncLayerProps`.
- `inspector.js` — `renderPalette`, `markSwatches`, `setColor`, `swapColors`, `resetColors`, `setFill`, `hslFromUI`.
- `adjust-panel.js` — `syncAdjustUI`, `readAdjustUI`, `resetAdjustUI`.
- `menus.js` — `bindMenubar`, `openMenu`, `closeMenus`, `openPane`.
- `modals.js` — export, size, transform, stroke, doc background, help.
- `feedback.js` — `toast`.

## May use
`model` (chỉ đọc), `core`, `shared`, `platform`, `bus`

## Must not
- **Import `tools` — cấm tuyệt đối.** Muốn đổi size cọ thì `bus.dispatch('tool:size', n)`.
- Toán điểm ảnh.
- Mutate doc trực tiếp; mọi thay đổi đi qua command.

## Nhận từ `app/app.js`
`toast` (70), `renderPresets` (128), `openCustomPreset` (148), `projectCard` (171), `timeAgo` (184), `renderRecent` (196), `renderTemplates` (221), `paintTemplatePreviews` (231), `renderNott` (264), `renderLayers` (946), `selectLayer` (1008), `startRename` (1015), `syncLayerProps` (1042), `renderPalette` (1444), `markSwatches` (1451), `setBgColor` (1456), `swapColors` (1463), `resetColors` (1470), `setColor` (1475), `setFill` (1503), `hslFromUI` (1508), `syncAdjustUI` (1147), `readAdjustUI` (1270), `resetAdjustUI` (1319), `bindMenubar` (3093), `openMenu` (3085), `closeMenus` (3077), `openPane` (3118), `openDrawer` (3063), `openHelp` (3073), `openExport` (1706), `openSizeModal` (2721), `openTransformModal` (2751), `openStrokeModal` (1881), `openDocBgPicker` (1927).

Đã chuyển:
- `feedback.js` — `toast` (P5-1).
- `start.js` — `renderPresets`, `openCustomPreset`, `projectCard`, `timeAgo`, `renderRecent`, `renderTemplates`, `paintTemplatePreviews`, `renderNott` (P5-2). Hành động được **tiêm** qua `configure({ createProject, openProject, createTemplate, importNottImage, setColor, previewDoc, getState })`; dữ liệu `PRESETS`/`TEMPLATES` nằm ở `model/presets.js`.


## Cổng công khai
`ui/index.js` — export `toast` và `configureStart` + các hàm render của màn hình bắt đầu. Không export hàm nội bộ.
