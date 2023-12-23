const path = require('path')
const fs = require('node:fs/promises');

module.exports = {
  packagerConfig: {
    asar: false,
  },
  rebuildConfig: {},
  makers: [ ],
  plugins: [ ],
  hooks: {
		packageAfterPrune: async (_config, buildPath) => {
       const gypPath = path.join(
         buildPath,
         'node_modules',
         'usb-detection',
         'build',
         'node_gyp_bins'
       );
       await fs.rm(gypPath, {recursive: true, force: true});
    }
  }
};
