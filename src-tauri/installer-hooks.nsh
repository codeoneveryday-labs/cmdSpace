; "Open in cmdSpace" shell verbs for folders, folder backgrounds, and drives.
; HKCU matches installer currentUser scope. %V = clicked path.
; NoWorkingDirectory keeps Explorer from overriding %V (System32 on Drive).

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInCmdSpace" "" "Open in cmdSpace"
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInCmdSpace" "Icon" '"$INSTDIR\cmdspace.exe",0'
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInCmdSpace" "NoWorkingDirectory" ""
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInCmdSpace\command" "" '"$INSTDIR\cmdspace.exe" "%V"'

  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInCmdSpace" "" "Open in cmdSpace"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInCmdSpace" "Icon" '"$INSTDIR\cmdspace.exe",0'
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInCmdSpace" "NoWorkingDirectory" ""
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInCmdSpace\command" "" '"$INSTDIR\cmdspace.exe" "%V"'

  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInCmdSpace" "" "Open in cmdSpace"
  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInCmdSpace" "Icon" '"$INSTDIR\cmdspace.exe",0'
  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInCmdSpace" "NoWorkingDirectory" ""
  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInCmdSpace\command" "" '"$INSTDIR\cmdspace.exe" "%V"'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey HKCU "Software\Classes\Directory\shell\OpenInCmdSpace"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\OpenInCmdSpace"
  DeleteRegKey HKCU "Software\Classes\Drive\shell\OpenInCmdSpace"
!macroend
