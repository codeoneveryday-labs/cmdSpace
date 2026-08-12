//! GPU-rendered shell for the native Terax remote app.
//!
//! This crate intentionally renders only the mobile root screen. The shared
//! remote client handles lifecycle, while future platform adapters handle
//! WebSocket transport and secure token persistence.

use gpui::{
    div, px, rgb, size, App, Bounds, Context, IntoElement, Render, SharedString, Window,
    WindowBounds, WindowOptions,
};
use terax_remote_client::RemoteClient;

/// The first GPUI surface for the native remote application.
pub struct TeraxMobileApp {
    title: SharedString,
    client: RemoteClient,
}

impl TeraxMobileApp {
    pub fn new() -> Self {
        Self {
            title: "Terax Remote".into(),
            client: RemoteClient::new(""),
        }
    }
}

impl Render for TeraxMobileApp {
    fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        let status = match self.client.state() {
            terax_remote_client::ConnectionState::Disconnected => "Connect a desktop to begin",
            terax_remote_client::ConnectionState::AwaitingHello => "Waiting for desktop handshake",
            terax_remote_client::ConnectionState::Authenticating => "Authenticating secure session",
            terax_remote_client::ConnectionState::Authenticated => "Connected",
        };

        div()
            .size_full()
            .flex()
            .flex_col()
            .justify_center()
            .items_center()
            .gap_4()
            .bg(rgb(0x101116))
            .text_color(rgb(0xf4f4f5))
            .child(
                div()
                    .text_2xl()
                    .font_weight(gpui::FontWeight::BOLD)
                    .child(self.title.clone()),
            )
            .child(div().text_sm().text_color(rgb(0xa1a1aa)).child(status))
    }
}

/// Starts a macOS development preview of the same GPUI root shell used by mobile.
pub fn run_desktop_preview() {
    gpui_platform::application().run(|cx: &mut App| {
        let bounds = Bounds::centered(None, size(px(390.0), px(844.0)), cx);
        let _ = cx.open_window(
            WindowOptions {
                window_bounds: Some(WindowBounds::Windowed(bounds)),
                ..Default::default()
            },
            |_, _| cx.new(|_| TeraxMobileApp::new()),
        );
        cx.activate(true);
    });
}
