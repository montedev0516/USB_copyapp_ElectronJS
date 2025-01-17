
!include "MUI2.nsh"

Name "USB Copy Pro"
Outfile "usbcopypro.exe"
Unicode true

InstallDir $PROGRAMFILES\usbcopypro 
InstallDirRegKey HKCU "Software\$(^Name)" ""

;--------------------------------
;Variables

Var StartMenuFolder

;--------------------------------
; Interface Settings
!define MUI_ABORTWARNING


;--------------------------------
; Pages

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "License.txt"
!insertmacro MUI_PAGE_DIRECTORY

!define MUI_STARTMENUPAGE_REGISTRY_ROOT "HKCU" 
!define MUI_STARTMENUPAGE_REGISTRY_KEY "Software\USB Copy Pro" 
!define MUI_STARTMENUPAGE_REGISTRY_VALUENAME "Start Menu Folder"

!insertmacro MUI_PAGE_STARTMENU Application $StartMenuFolder
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!define MUI_FINISHPAGE_LINK "www.everyusb.com/"
!define MUI_FINISHPAGE_LINK_LOCATION "https://www.everyusb.com/"

;--------------------------------
; Languages
!insertmacro MUI_LANGUAGE "English"

;--------------------------------
; Sections

Section "Install" inst1

SetOutPath "$INSTDIR\app"
File ..\app\gittag-sys.txt
File /r ..\drive
SetOutPath "$INSTDIR\app\drive"
;File /r ..\repo\osx\sys\usbcopypro-darwin-x64\usbcopypro.app
SetOutPath "$INSTDIR\app\sys\resources"
File ..\app\sys\resources\app.asar
SetOutPath "$INSTDIR\app\doc"
File ..\app\doc\usbdoc-win-v3.pdf

SetOutPath "$INSTDIR\encryption"
File /r ..\sys\encrypt\out\usbcopypro-encrypt-win32-x64

;Store installation folder
WriteRegStr HKCU "Software\USB Copy Pro" "" $INSTDIR

;Create uninstaller
WriteUninstaller "$INSTDIR\Uninstall.exe"

!insertmacro MUI_STARTMENU_WRITE_BEGIN Application

;Create shortcuts
CreateDirectory "$SMPROGRAMS\$StartMenuFolder"
CreateShortcut "$SMPROGRAMS\$StartMenuFolder\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
SetOutPath "$INSTDIR\encryption\usbcopypro-encrypt-win32-x64"
CreateShortcut "$SMPROGRAMS\$StartMenuFolder\USB Copy Pro.lnk" "$INSTDIR\encryption\usbcopypro-encrypt-win32-x64\usbcopypro-encrypt.exe"

!insertmacro MUI_STARTMENU_WRITE_END

SectionEnd

;--------------------------------
; Descriptions

;Language strings
LangString DESC_inst1 ${LANG_ENGLISH} "Installer section"

;Assign language strings to sections
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
!insertmacro MUI_DESCRIPTION_TEXT ${Secinst1} $(DESC_Secinst1)
!insertmacro MUI_FUNCTION_DESCRIPTION_END

;--------------------------------
;Uninstaller Section

Section "Uninstall"

  RMDir /r "$INSTDIR\app"
  RMDir /r "$INSTDIR\encryption"
  Delete "$INSTDIR\locator.json"

  Delete "$INSTDIR\Uninstall.exe"

  RMDir "$INSTDIR"
  
  !insertmacro MUI_STARTMENU_GETFOLDER Application $StartMenuFolder
    
  Delete "$SMPROGRAMS\$StartMenuFolder\Uninstall.lnk"
  RMDir "$SMPROGRAMS\$StartMenuFolder"
  
  DeleteRegKey /ifempty HKCU "Software\USB Copy Pro"

SectionEnd
