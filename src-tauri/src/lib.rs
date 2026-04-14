// ============================================================
// OpenCat Tauri 桌面端 — 核心库
// ============================================================
// 这个文件定义了桌面端的 Rust 后端逻辑
// 当前只需要启动 WebView 加载 Next.js 前端
// 后续可以在这里添加：
// - 自定义 Tauri Command（Rust ↔ JS 双向通信）
// - 系统托盘
// - 文件系统操作
// - 本地数据库（SQLite）

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
