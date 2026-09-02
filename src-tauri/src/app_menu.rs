use tauri::menu::{AboutMetadata, Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tauri::{AppHandle, Emitter, Runtime};

use crate::app_exit;

pub(crate) fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let menu = Menu::default(app)?;
    let app_menu_name = app.package_info().name.clone();
    let app_menu = menu.items()?.into_iter().find_map(|item| {
        let submenu = item.as_submenu()?.clone();
        (submenu.text().ok()? == app_menu_name).then_some(submenu)
    });
    if let Some(app_menu) = app_menu {
        app_menu.remove_at(0)?;
        let about = PredefinedMenuItem::about(
            app,
            None,
            Some(AboutMetadata {
                name: Some(app.package_info().name.clone()),
                version: Some(app.package_info().version.to_string()),
                copyright: app.config().bundle.copyright.clone(),
                icon: Some(tauri::include_image!("icons/about.png")),
                ..Default::default()
            }),
        )?;
        app_menu.prepend(&about)?;
        let quit_indexes: Vec<usize> = app_menu
            .items()?
            .iter()
            .enumerate()
            .filter_map(|(index, item)| {
                item.as_predefined_menuitem()
                    .and_then(|predefined| predefined.text().ok())
                    .filter(|text| text.starts_with("Quit"))
                    .map(|_| index)
            })
            .collect();
        for index in quit_indexes.into_iter().rev() {
            app_menu.remove_at(index)?;
        }
        app_menu.append(&MenuItem::with_id(
            app,
            "cmdspace.quit",
            "Quit cmdSpace",
            true,
            Some("CmdOrCtrl+Q"),
        )?)?;
    }

    let new_tab = MenuItem::with_id(app, "cmdspace.new-tab", "New Tab", true, Some("CmdOrCtrl+T"))?;
    let maximize_pane = MenuItem::with_id(
        app,
        "cmdspace.maximize-pane",
        "Maximize Pane",
        true,
        Some("CmdOrCtrl+Shift+Period"),
    )?;
    let open_shortcuts = MenuItem::with_id(
        app,
        "cmdspace.open-shortcuts",
        "Keyboard Shortcuts",
        true,
        Some("CmdOrCtrl+K"),
    )?;

    if let Some(file_menu) = menu.get("File").and_then(|item| item.as_submenu().cloned()) {
        file_menu.prepend(&new_tab)?;
    }
    if let Some(view_menu) = menu.get("View").and_then(|item| item.as_submenu().cloned()) {
        view_menu.prepend(&maximize_pane)?;
        view_menu.prepend(&open_shortcuts)?;
    }

    Ok(menu)
}

pub(crate) fn handle<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    match event.id().as_ref() {
        "cmdspace.new-tab" => {
            let _ = app.emit("cmdspace:new-tab", ());
        }
        "cmdspace.maximize-pane" => {
            let _ = app.emit("cmdspace:maximize-pane", ());
        }
        "cmdspace.open-shortcuts" => {
            let _ = app.emit("cmdspace:open-shortcuts", ());
        }
        "cmdspace.quit" => app_exit::request(app),
        _ => {}
    }
}
