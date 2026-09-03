# Báo Cáo Phân Tích Sự Cố: Browser Sidebar Đè Lên Terminal Sau Khi Thu Nhỏ

> **Mã lỗi / Vấn đề**: Right Sidebar Browser Overlay on Terminal Grid after Collapse  
> **Môi trường**: macOS (Apple Silicon & Intel) / Tauri v2 Native Webview Runtime  
> **Tài liệu tham khảo kỹ thuật**: `src/app/App.tsx`, `src/app/AppChrome.tsx`, `src/modules/preview/SidebarBrowserPane.tsx`

---

## 1. Tóm Tắt Hiện Tượng (Bug Summary)

Khi người dùng mở tab **Browser** ở thanh sidebar bên phải (ví dụ truy cập trang `https://openrouter.ai`):
1. Người dùng thực hiện thu nhỏ (collapse / đóng) thanh sidebar bên phải để mở rộng diện tích làm việc của Terminal.
2. **Giao diện HTML/CSS của Sidebar biến mất đúng như dự kiến**: Thanh tiêu đề `[Browser] [<> Editor]`, thanh nhập URL (`PreviewAddressBar`) và đường phân cách thu hẹp về 0. Lưới Terminal tự động giãn ra chiếm trọn 100% chiều rộng cửa sổ.
3. **Tuy nhiên, nội dung trang web (OpenRouter) vẫn tiếp tục hiển thị đè lên trên các ô Terminal** ở góc phải màn hình.
4. **Người dùng vẫn có thể click chuột, cuộn trang (scroll), và nhập liệu bình thường vào trang web đó**, che khuất hoàn toàn các thao tác và hiển thị của Terminal nằm bên dưới.

---

## 2. Hình Ảnh Tái Hiện Thực Tế (Visual Reproduction)

### Trạng thái 1: Khi Sidebar đang mở bình thường
- Sidebar bên phải chiếm ~25-30% chiều rộng.
- Header sidebar hiển thị: `[Browser] [<> Editor]` kèm thanh URL `https://openrouter.ai`.
- Grid terminal chiếm phần còn lại bên trái.

### Trạng thái 2: Sau khi thu nhỏ / đóng Sidebar
- Header `[Browser] [<> Editor]` và thanh URL biến mất.
- Terminal phía dưới mở rộng ra tận mép phải cửa sổ (quan sát thấy bảng `TOOL USAGE` kéo dài hết biên phải).
- **Trang web OpenRouter vẫn nằm nguyên vị trí cũ, đè lên trên giao diện Terminal**.

---

## 3. Phân Tích Nguyên Nhân Gốc Rễ (Root Cause Analysis)

Sự cố này xuất phát từ **sự xung đột giữa tầng DOM (HTML/CSS) của React và tầng Native OS View của Tauri/macOS**. Cụ thể gồm 4 nguyên nhân liên hoàn sau:

---

### Nguyên nhân 1: Prop `visible` trong `App.tsx` không kiểm tra `sidebarOpen`

Trong file `src/app/App.tsx` (dòng 1301–1306):
```tsx
const sidebar = (
  <AppSidebar
    sidebarView={sidebarView}
    editorSidebarView={editorSidebarView}
    ...
    browser={{
      url: sidebarBrowserUrl,
      visible: sidebarView === "browser", // ❌ LỖI NGHIÊM TRỌNG TẠI ĐÂY!
      resizing: sidebarResizing,
      onUrlChange: persistSidebarBrowserUrl,
    }}
  />
);
```

- Khi người dùng thu nhỏ sidebar, state `sidebarOpen` chuyển thành `false`.
- Tuy nhiên, biến `sidebarView` **vẫn giữ nguyên giá trị `"browser"`** (để khi người dùng mở lại sidebar thì vẫn quay lại đúng tab Browser).
- Do `visible` chỉ so sánh `sidebarView === "browser"` mà **không hề kiểm tra `sidebarOpen`**, nên component `SidebarBrowserPane` nhận prop `visible = true` ngay cả khi sidebar đã bị đóng hoàn toàn!

---

### Nguyên nhân 2: Bản chất của Tauri v2 Native Child Webview trên macOS

Trong file `src/modules/preview/SidebarBrowserPane.tsx`:
```tsx
const useNativeWebview = hasTauriWebviewRuntime() && (!embedded || !isLocalPreviewUrl(normalizedUrl));
```
- Đối với các trang web bên ngoài như `https://openrouter.ai`, trang web chặn nhúng `<iframe>` thông qua CSP (`frame-ancestors 'none'`) hoặc `X-Frame-Options: DENY`.
- Do đó, cmdSpace buộc phải khởi tạo một **Tauri Native Webview** độc lập:
```tsx
const webview = new Webview(getCurrentWindow(), webviewLabelRef.current, {
  url: normalizedUrl,
  x: visibleBounds.left,
  y: visibleBounds.top,
  width: visibleBounds.width,
  height: visibleBounds.height,
  focus: false,
  dragDropEnabled: false,
});
```

#### ⚠️ Điểm cốt lõi về mặt hệ điều hành:
- Trên macOS, Tauri tạo một `WKWebView` (thuộc lớp `NSView` của Cocoa) và gắn trực tiếp vào cây phân cấp view của cửa sổ hệ điều hành (`NSWindow.contentView`).
- **Native WKWebView KHÔNG PHẢI là phần tử DOM!**
- Nó nằm ở một tầng đồ họa (native layer) cao hơn hẳn WebView chính chứa React UI.
- Tất cả các thuộc tính CSS như:
  - `overflow: hidden`
  - `width: 0`
  - `pointer-events: none`
  - `opacity: 0`
  - `z-index`
  **hoàn toàn vô hiệu đối với Native Webview của hệ điều hành**.
- Cách duy nhất để ẩn một Native Webview là phải gọi hàm native:
  ```ts
  await webview.hide();
  ```
  Nhưng vì `visible` vẫn bằng `true` (do Nguyên nhân 1), hàm `hide()` này **không bao giờ được gọi**!

---

### Nguyên nhân 3: Kiến trúc giữ nguyên Sidebar Mounted (`Keep-Alive`)

Trong `src/app/App.test.ts` có một kiểm thử kiến trúc bắt buộc:
```ts
it("keeps the right sidebar content mounted across toggle cycles", () => {
  ...
  expect(sidebarAside).not.toContain("{sidebarOpen ? (");
  expect(sidebarAside).toContain("aria-hidden={!sidebarOpen}");
  expect(sidebarAside).toContain('!sidebarOpen && "pointer-events-none"');
  expect(sidebarAside).toContain("style={{ width: sidebarWidth }}");
});
```

Trong `src/app/AppChrome.tsx` (dòng 126–143):
```tsx
<aside
  className={cn(
    "min-h-0 shrink-0 overflow-hidden",
    !sidebarOpen && "pointer-events-none",
    sidebarResizing
      ? "transition-none"
      : "transition-[width] duration-150 ease-out",
  )}
  style={{ width: sidebarOpen ? sidebarWidth : 0 }}
  aria-hidden={!sidebarOpen}
>
  <div
    className="flex h-full min-h-0 shrink-0 flex-col bg-card"
    style={{ width: sidebarWidth }} // 👈 Độ rộng bên trong giữ cố định!
  >
    {sidebar}
  </div>
</aside>
```

- Mục đích thiết kế: Giữ cho DOM của Sidebar không bị unmount khi người dùng đóng/mở sidebar, nhằm bảo toàn vị trí scroll, trạng thái soạn thảo hoặc cấu trúc cây thư mục.
- **Hệ quả không mong muốn**: Component `SidebarBrowserPane` không bao giờ bị unmount khi thu nhỏ sidebar. `useEffect cleanup` (nơi gọi `closeNativeWebview`) không kích hoạt.
- Thẻ con bên trong `<div>` vẫn giữ độ rộng cố định `width: sidebarWidth` (ví dụ 400px), chỉ có thẻ `<aside>` bên ngoài co về `width: 0`.

---

### Nguyên nhân 4: Hàm tính toán toạ độ `getVisibleNativeBounds()` thiếu kiểm tra khung chứa

Trong `src/modules/preview/SidebarBrowserPane.tsx` (dòng 124–135):
```tsx
const getVisibleNativeBounds = useCallback(() => {
  const host = hostRef.current;
  if (!host) return null;

  const rect = host.getBoundingClientRect();
  const viewport = host.closest<HTMLElement>(
    '[data-canvas-surface-viewport="true"]',
  );
  if (!viewport) return rect; // ❌ Chỉ clip khi ở Canvas, không clip với Sidebar!

  return intersectBrowserBounds(rect, viewport.getBoundingClientRect());
}, []);
```

- Khi ở chế độ Sidebar, `viewport` là `null`. Hàm trả về thẳng `rect` của phần tử `host`.
- Do phần tử `host` nằm trong thẻ `<div>` có `style={{ width: sidebarWidth }}`, `rect.width` vẫn trả về giá trị dương lớn hơn 0 (ví dụ 400px) và toạ độ `left` vẫn nằm ở vị trí cũ trên màn hình.
- `syncNativeBounds()` thấy `visibleBounds` hợp lệ nên không gọi `webview.hide()`, mà tiếp tục duy trì kích thước và vị trí của Native Webview.

---

## 4. Tại Sao Người Dùng Vẫn Click Và Scroll Được?

Nhiều lập trình viên nghĩ rằng khi thêm class CSS `pointer-events-none` vào `<aside>` thì chuột sẽ không thể tương tác được nữa. **Điều này hoàn toàn sai với Native Webview:**

```
[Người dùng click / cuộn chuột]
              │
              ▼
[macOS Window Server (Quartz Display Services)]
              │
              ▼
[Tìm NSView cao nhất tại toạ độ con trỏ (Hit-Testing)]
              │
              ├─► Gặp Native WKWebView (OpenRouter) ──► Nhận NSEvent (Click, Scroll) trực tiếp!
              │
              └─► (Không bao giờ tới được WebView chính của Tauri hay CSS pointer-events-none)
```

Vì `WKWebView` là một view con độc lập của macOS, hệ điều hành gửi sự kiện chuột trực tiếp cho nó. Các quy tắc CSS của trang web cha hoàn toàn không có quyền can thiệp vào tầng cửa sổ của hệ điều hành.

---

## 5. Giải Pháp Khắc Phục Triệt Để (Proposed Fixes)

Để giải quyết tận gốc vấn đề mà vẫn giữ nguyên được yêu cầu kiến trúc (giữ sidebar mounted để không mất trạng thái), cần thực hiện 2 thay đổi chính:

### Bước 1: Sửa prop `visible` trong `src/app/App.tsx`
Kết hợp trạng thái `sidebarOpen` và độ rộng sidebar vào điều kiện hiển thị của browser:

```diff
--- a/src/app/App.tsx
+++ b/src/app/App.tsx
@@ -1300,7 +1300,7 @@ export function App() {
       editorRail={{ onSelectView: setEditorSidebarView }}
       browser={{
         url: sidebarBrowserUrl,
-        visible: sidebarView === "browser",
+        visible: sidebarOpen && sidebarWidth > 0 && sidebarView === "browser",
         resizing: sidebarResizing,
         onUrlChange: persistSidebarBrowserUrl,
       }}
```

### Bước 2: Tăng cường bảo vệ trong `SidebarBrowserPane.tsx`
1. Khi `visible` chuyển sang `false`: Ngay lập tức gọi `webviewRef.current?.hide()` (đã có sẵn trong logic `useEffect` của `SidebarBrowserPane`).
2. Trong hàm `getVisibleNativeBounds()`: Kiểm tra nếu phần tử nằm trong `<aside>` hoặc container bị ẩn/thu nhỏ (`rect.width === 0` hoặc container có `width === 0`), lập tức trả về `null` để kích hoạt ẩn native webview.

```diff
--- a/src/modules/preview/SidebarBrowserPane.tsx
+++ b/src/modules/preview/SidebarBrowserPane.tsx
@@ -126,6 +126,16 @@ export function SidebarBrowserPane({
     const host = hostRef.current;
     if (!host) return null;
 
+    // Nếu phần tử cha hoặc container bị ẩn / width co về 0
+    const container = host.closest("aside");
+    if (container) {
+      const containerRect = container.getBoundingClientRect();
+      if (containerRect.width <= 0 || container.getAttribute("aria-hidden") === "true") {
+        return null;
+      }
+    }
+
     const rect = host.getBoundingClientRect();
     const viewport = host.closest<HTMLElement>(
       '[data-canvas-surface-viewport="true"]',
```

---

## 6. Kết Luận

| Đặc tính | Hiện trạng lỗi | Sau khi sửa |
| :--- | :--- | :--- |
| **Trạng thái prop `visible`** | Luôn `true` dù sidebar đóng | `false` ngay khi `sidebarOpen === false` |
| **Native WKWebView** | Nổi trên màn hình, chặn tương tác Terminal | Lập tức gọi `.hide()`, giải phóng hoàn toàn sự kiện chuột |
| **Tương tác Terminal** | Bị che khuất và chặn thao tác ở góc phải | Nhận đầy đủ 100% click/scroll trên toàn bộ chiều rộng |
| **Kiến trúc App** | Vi phạm trải nghiệm đa nhiệm | Giữ nguyên trạng thái webview (URL, scroll), hiện lại mượt mà khi mở lại sidebar |
