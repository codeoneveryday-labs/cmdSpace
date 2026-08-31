#[cfg(target_os = "macos")]
#[tauri::command]
pub fn fs_clipboard_paths() -> Result<Vec<String>, String> {
    use objc2::{rc::autoreleasepool, ClassType};
    use objc2_app_kit::{NSPasteboard, NSPasteboardURLReadingFileURLsOnlyKey};
    use objc2_foundation::{NSArray, NSDictionary, NSNumber, NSURL};

    autoreleasepool(|_| {
        let classes = NSArray::from_slice(&[NSURL::class()]);
        let options = NSDictionary::from_slices(
            &[unsafe { NSPasteboardURLReadingFileURLsOnlyKey }],
            &[NSNumber::new_bool(true).as_ref()],
        );
        let objects = unsafe {
            NSPasteboard::generalPasteboard()
                .readObjectsForClasses_options(&classes, Some(&options))
        };
        Ok(objects
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| {
                        item.downcast::<NSURL>().ok().and_then(|url| {
                            url.path().map(|path| path.to_string().replace('\\', "/"))
                        })
                    })
                    .collect()
            })
            .unwrap_or_default())
    })
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn fs_clipboard_paths() -> Result<Vec<String>, String> {
    Ok(Vec::new())
}
