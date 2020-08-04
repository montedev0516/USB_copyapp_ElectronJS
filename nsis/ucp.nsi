
!include "MUI2.nsh"

Name "USB Copy Pro"
Outfile "usbcopypro.exe"
Unicode true

InstallDir $PROGRAMFILES\usbcopypro 
InstallDirRegKey HKCU "Software\$(^Name)" ""


;--------------------------------
; Interface Settings
!define MUI_ABORTWARNING


;--------------------------------
; Pages

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "License.txt"
!insertmacro MUI_PAGE_DIRECTORY
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

SetOutPath $INSTDIR
File ..\drive\locator.json

SetOutPath $INSTDIR\app
File ..\app\gittag-sys.txt
File ..\app\sys\resources\app.asar
File /r ..\drive

SetOutPath $INSTDIR\encryption
File /r ..\sys\encrypt\out\usbcopypro-encrypt-win32-x64

SectionEnd

;--------------------------------
; Descriptions

;Language strings
LangString DESC_inst1 ${LANG_ENGLISH} "Installer section"

;Assign language strings to sections
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
!insertmacro MUI_DESCRIPTION_TEXT ${Secinst1} $(DESC_Secinst1)
!insertmacro MUI_FUNCTION_DESCRIPTION_END

