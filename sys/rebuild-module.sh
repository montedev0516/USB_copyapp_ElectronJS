#../../sys/node_modules/.bin/node-gyp rebuild --target=1.8.2 --arch=x64 --dist-url=https://atom.io/download/electron
mv binding.gyp.old binding.gyp
../.bin/node-gyp rebuild --target=3.0.13 --arch=ia32 --dist-url=https://www.electronjs.org/headers --build-from-source
mv binding.gyp binding.gyp.old

# also could be useful:
# export VCTargetsPath='C:\Program Files\Microsoft Visual Studio\2017\Community\Common7\IDE\VC\VCTargets'
#./node_modules/.bin/electron-rebuild ./node_modules/diskusage/
