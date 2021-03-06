// @flow
/* eslint-env node */
const {join, dirname} = require('path');
const {
  download,
  runNpmInstall,
  createLambda,
  runPackageJsonScript,
  FileBlob,
} = require('@now/build-utils');
const fs = require('fs');
const readdir = require('fs-readdir-recursive');

// build({
//   files: Files,
//   entrypoint: String,
//   workPath: String,
//   config: Object,
//   meta?: {
//     isDev?: Boolean,
//     requestPath?: String,
//     filesChanged?: Array<String>,
//     filesRemoved?: Array<String>
//   }
// }) : {
//   watch: Array<String>,
//   output: Files output,
//   routes: Object
// }
exports.build = async ({files, entrypoint, workPath, config, meta = {}}) => {
  const downloadedFiles = await download(files, workPath, meta);
  const entrypointFsDirname = join(workPath, dirname(entrypoint));
  await runNpmInstall(entrypointFsDirname, ['--frozen-lockfile']);
  await runPackageJsonScript(entrypointFsDirname, 'now-build');
  const entrypointPath = downloadedFiles[entrypoint].fsPath;
  const fusionFiles = readdir(join(entrypointFsDirname, '.fusion')).reduce(
    (obj, file) => {
      const filePath = join(entrypointFsDirname, '.fusion', file);
      obj[filePath] = new FileBlob({
        data: fs.readFileSync(filePath).toString(),
      });
      return obj;
    },
    {}
  );
  const lambda = await createLambda({
    runtime: 'nodejs8.10',
    handler: 'index.main',
    files: {
      'index.js': new FileBlob({
        data: `
        const fs = require('fs');
        exports.main = (req, res) => {
          try {
            console.log('dirname', fs.readdirSync(__dirname));
            console.log('cwd', fs.readdirSync(process.cwd()));
            console.log('.fusion', fs.readdirSync('.fusion/'));
          } catch(e) {}
          res.end('OK'); 
        };
        `,
      }),
      ...fusionFiles,
    },
  });

  return {
    output: {
      [entrypoint]: lambda,
    },
    watch: [],
    routes: {},
  };
};

// prepareCache({
//   files: Files,
//   entrypoint: String,
//   workPath: String,
//   cachePath: String,
//   config: Object
// }) : Files cacheOutput

// shouldServe({
//   entrypoint: String,
//   files: Files,
//   config: Object,
//   requestPath: String,
//   workPath: String
// }) : Boolean

exports.version = 2;
