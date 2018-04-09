// launcher.cpp : Defines the entry point for the console application.
//

#include "stdafx.h"
#include "json.hpp"
#include <Windows.h>
#include "shlwapi.h"
#include <fstream>
#include <iostream>

int main(int argc, const char *argv[])
{
    STARTUPINFOA si;
    PROCESS_INFORMATION pi;

    char prg[MAX_PATH];
    strncpy_s(prg, argv[0], strnlen(argv[0], MAX_PATH));
    int i;
    bool foundLocator = false;
    char locRoot[MAX_PATH] = {0};
    for (i = strnlen(prg, MAX_PATH); i > 0 ; i--) {
        if (prg[i] == '\\') {
            prg[i] = '\0';
            strncpy_s(locRoot, prg, MAX_PATH);
            strncat_s(prg, "\\locator.json", 14);
            if (PathFileExistsA(prg)) {
                // FOUND LOCATOR...
                foundLocator = true;
                break;
            }
        }
    }

    if (!foundLocator) {
        MessageBox(NULL,
            (LPCWSTR)L"Could not find locator.  Cannot start application.",
            (LPCWSTR)L"ERROR",
            MB_ICONERROR);
        exit(1);
    }

    std::ifstream jsonfile(prg);
    nlohmann::json locatorJson;

    jsonfile >> locatorJson;
    std::string locRootS(locRoot);
    locRootS.append("\\");
    locRootS.append(locatorJson["drive"].get<std::string>());

    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    ZeroMemory(&pi, sizeof(pi));

    if (!CreateProcessA(NULL, (LPSTR)locRootS.c_str(),
                        NULL, NULL, false, 0,
                        NULL, NULL, &si, &pi))
    {
        printf("ERROR: %d\n", GetLastError());
        MessageBoxA(0, locRootS.c_str(), "error starting program", MB_ICONERROR);
    }

    // Wait until child process exits.
    WaitForSingleObject(pi.hProcess, INFINITE);

    // Close process and thread handles.
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
}

