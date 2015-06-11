var chalk = require('chalk'),
  fs = require('fs'),
  path = require('path'),
  Jexl = require('./../Jexl');

exports.run = function () {
  var inst, source;
  if (process.argv.length > 2) {
    source = process.argv[2];
  } else {
    console.log(chalk.red('No jexl file provided.'));
    process.exit(1);
  }
  if (source.length) {
    inst = new Jexl.Jexl();
    fs.readFile(path.resolve(source), 'utf8', function (err, data) {
      if (err && err.code === 'ENOENT') {
        console.log(chalk.red('No jexl file found.'));
        process.exit(1);
      }
      inst.eval(data).then(function (res) {
        console.log(res);
      });
    });
  }
};
