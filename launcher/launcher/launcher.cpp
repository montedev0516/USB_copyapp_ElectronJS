// launcher.cpp : Defines the entry point for the console application.
//

#include "stdafx.h"
#include <Windows.h>

int main(int argc, const char *argv[])
{
	STARTUPINFOA si;
	PROCESS_INFORMATION pi;

	char prg[MAX_PATH];
	char path[MAX_PATH];
	strncpy_s(prg, argv[0], strnlen(argv[0], MAX_PATH));
	int i;
	for (i = strnlen(prg, MAX_PATH); i > 0 ; i--) {
		if (prg[i] == '\\') {
			prg[i] = '\0';
			break;
		}
	}
	strncpy_s(path, prg, strnlen(prg, MAX_PATH));

	strncat_s(prg, "\\sys\\usbcopypro-win32-ia32\\usbcopypro.exe .\\sys\\resources\\app\\src\\index.js", MAX_PATH);

	ZeroMemory(&si, sizeof(si));
	si.cb = sizeof(si);
	ZeroMemory(&pi, sizeof(pi));

	//printf("prg %s\n", prg);
	if (!CreateProcessA(NULL, prg, NULL, NULL, false, 0, NULL, path, &si, &pi)) {
		printf("ERROR: %d\n", GetLastError());
		MessageBoxA(0, prg, "error starting program", MB_ICONERROR);
	}

	// Wait until child process exits.
	WaitForSingleObject(pi.hProcess, INFINITE);

	// Close process and thread handles.
	CloseHandle(pi.hProcess);
	CloseHandle(pi.hThread);
}

