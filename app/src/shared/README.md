# `shared/` — hàm thuần dùng chung

## Owns
Helper thuần, không ngữ nghĩa Craf: `clamp`, `lerp`, `fmt`, `pad`, `uid`, `esc`.
`emitter.js` — `createEmitter()`: factory `on/off/emit/clear`, không channel mặc định, không trạng thái toàn cục (instance do `shell` tạo và tiêm).

## May use
Không import section nào.

## Must not
- DOM, I/O, `Date.now()` trần, `Math.random()` trần (phải truyền vào).
- Từ vựng domain: `layer`, `mask`, `doc`.
- Được import bởi `platform`.

## Điều kiện được vào `shared`
Pure + không import section nào + không từ vựng domain. "Hai section cùng dùng" **không đủ** — nếu vậy đặt ở section cha chung gần nhất.

## Nhận từ `app/app.js`
`clamp` (8), `fmt` (12), `pad` (11), `uid` (9), `esc` (10).

## Cổng công khai
`shared/index.js`
