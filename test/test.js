var assert = require('assert');
var Tree = require('./utils/builder');
var watch = require('../lib/watch');

var tree = Tree();
var watcher;

beforeEach(function(done) {
  tree = Tree();
  if (watcher && !watcher.isClosed()) {
    watcher.on('close', done);
    watcher.close();
  } else {
    done();
  }
});

after(function() {
  if (tree) {
    tree.cleanup();
  }
});

describe('process events', function() {
  it('should emit `close` event', function(done) {
    var file = 'home/a/file1';
    var fpath = tree.getPath(file);
    watcher = watch(fpath, function() {});
    watcher.on('close', function() {
      done();
    });
    watcher.close();
  });

  it('should emit `ready` event when watching a file', function(done) {
    var file = 'home/a/file1';
    var fpath = tree.getPath(file);
    watcher = watch(fpath);
    watcher.on('ready', function() {
      done();
    });
  });

  it('should emit `ready` event when watching a directory recursively', function(done) {
    var dir = tree.getPath('home');
    watcher = watch(dir, { recursive: true });
    watcher.on('ready', function() {
      done();
    });
  });
});

describe('watch for files', function() {
  it('should watch a single file and keep watching', function(done) {
    var times = 1;
    var file = 'home/a/file1';
    var fpath = tree.getPath(file);
    watcher = watch(fpath, { delay: 0 }, function(evt, name) {
      assert.equal(fpath, name)
      if (times++ >= 3) {
        done();
      }
    });
    watcher.on('ready', function() {
      tree.modify(file);
      tree.modify(file, 100);
      tree.modify(file, 200);
    });
  });

  it('should watch files inside a directory', function(done) {
    var fpath = tree.getPath('home/a');
    var stack = [
      tree.getPath('home/a/file1'),
      tree.getPath('home/a/file2')
    ];
    watcher = watch(fpath, { delay: 0 }, function(evt, name) {
      stack.splice(stack.indexOf(name), 1);
      if (!stack.length) done();
    });

    watcher.on('ready', function() {
      tree.modify('home/a/file1');
      tree.modify('home/a/file2', 100);
    });
  });

  it('should ignore duplicate changes', function(done) {
    var file = 'home/a/file2';
    var fpath = tree.getPath(file);
    var times = 0;
    watcher = watch(fpath, { delay: 200 }, function(evt, name) {
      if (fpath === name) times++;
    });
    watcher.on('ready', function() {
      tree.modify(file);
      tree.modify(file, 100);
      tree.modify(file, 150);

      setTimeout(function() {
        assert.equal(times, 1)
        done();
      }, 250);
    });
  });
});

describe('watch for directories', function() {
  it('should watch directories inside a directory', function(done) {
    var home = tree.getPath('home');
    var dir = tree.getPath('home/c');

    watcher = watch(home, { delay: 0, recursive: true }, function(evt, name) {
      assert.equal(dir, name);
      done();
    });
    watcher.on('ready', function() {
      tree.remove('home/c');
    });
  });

  it('should watch new created directories', function(done) {
    var home = tree.getPath('home');
    watcher = watch(home, { delay: 0, recursive: true }, function(evt, name) {
      if (name === tree.getPath('home/new/file1')) {
        done();
      }
    });
    watcher.on('ready', function() {
      // newFile() will create the 'new/' directory and the 'new/file1' file,
      // but, only the creation of the directory is observed.
      // Because of that, there will only be one event for file1, when it
      // is modified, not when it is created.
      tree.newFile('home/new/file1');
      tree.modify('home/new/file1', 100);
    });
  });
});

describe('file events', function() {
  it('should identify `remove` event', function(done) {
    var file = 'home/a/file1';
    var fpath = tree.getPath(file);
    watcher = watch(fpath, function(evt, name) {
      if (evt === 'remove' && name === fpath) done();
    });
    watcher.on('ready', function() {
      tree.remove(file);
    });
  });

  it('should identify `update` event', function(done) {
    var file = 'home/a/file1';
    var fpath = tree.getPath(file);
    watcher = watch(fpath, function(evt, name) {
      if (evt === 'update' && name === fpath) done();
    });
    watcher.on('ready', function() {
      tree.modify(file);
    });
  });

  it('should report `update` on new files', function(done) {
    var dir = tree.getPath('home/a');
    var file = 'home/a/newfile' + Date.now();
    var fpath = tree.getPath(file);
    watcher = watch(dir, function(evt, name) {
      if (evt === 'update' && name === fpath) done();
    });
    watcher.on('ready', function() {
      tree.newFile(file);
    });
  });
});

describe('options', function() {
  describe('recursive', function() {
    it('should watch recursively with `recursive: true` option', function(done) {
      var dir = tree.getPath('home');
      var file = tree.getPath('home/bb/file1');
      watcher = watch(dir, { recursive: true }, function(evt, name) {
        assert.equal(file, name);
        done();
      });
      watcher.on('ready', function() {
        tree.modify('home/bb/file1');
      });
    });
  });

  describe('encoding', function() {
    it('should throw on invalid encoding', function(done) {
      var dir = tree.getPath('home/a');
      try {
        watcher = watch(dir, 'unknown');
      } catch (e) {
        done();
      }
    });

    it('should accept options as an encoding string', function(done) {
      var dir = tree.getPath('home/a');
      var file = 'home/a/file1';
      var fpath = tree.getPath(file);
      watcher = watch(dir, 'utf8', function(evt, name) {
        assert.equal(name.toString(), fpath);
        done();
      });
      watcher.on('ready', function() {
        tree.modify(file);
      });
    });

    it('should support buffer encoding', function(done) {
      var dir = tree.getPath('home/a');
      var file = 'home/a/file1';
      var fpath = tree.getPath(file);
      watcher = watch(dir, 'buffer', function(evt, name) {
        assert(Buffer.isBuffer(name), 'not a Buffer')
        assert.equal(name.toString(), fpath);
        done();
      });
      watcher.on('ready', function() {
        tree.modify(file);
      });
    });

    it('should support base64 encoding', function(done) {
      var dir = tree.getPath('home/a');
      var file = 'home/a/file1';
      var fpath = tree.getPath(file);
      watcher = watch(dir, 'base64', function(evt, name) {
        assert.equal(
          name,
          Buffer.from(fpath).toString('base64'),
          'wrong base64 encoding'
        );
        done();
      });
      watcher.on('ready', function() {
        tree.modify(file);
      });
    });

    it('should support hex encoding', function(done) {
      var dir = tree.getPath('home/a');
      var file = 'home/a/file1';
      var fpath = tree.getPath(file);
      watcher = watch(dir, 'hex', function(evt, name) {
        assert.equal(
          name,
          Buffer.from(fpath).toString('hex'),
          'wrong hex encoding'
        );
        done();
      });
      watcher.on('ready', function() {
        tree.modify(file);
      });
    });
  });

  describe('filter', function() {
    it('should only watch filtered directories', function(done) {
      var matchRegularDir = false;
      var matchIgnoredDir = false;

      var options = {
        delay: 0,
        recursive: true,
        filter: function(name) {
          return !/deep_node_modules/.test(name);
        }
      };

      watcher = watch(tree.getPath('home'), options, function(evt, name) {
        if (/deep_node_modules/.test(name)) {
          matchIgnoredDir = true;
        } else {
          matchRegularDir = true;
        }
      });
      watcher.on('ready', function() {
        tree.modify('home/b/file1');
        tree.modify('home/deep_node_modules/ma/file1');

        setTimeout(function() {
          assert(matchRegularDir, 'watch failed to detect regular file');
          assert(!matchIgnoredDir, 'fail to ignore path `deep_node_modules`');
          done();
        }, 100);
      });
    });

    it('should only report filtered files', function(done) {
      var dir = tree.getPath('home');
      var file1 = 'home/bb/file1';
      var file2 = 'home/bb/file2';

      var options = {
        delay: 0,
        recursive: true,
        filter: function(name) {
          return !/file1/.test(name);
        }
      }

      var times = 0;
      var matchIgnoredFile = false;
      watcher = watch(dir, options, function(evt, name) {
        times++;
        if (name === tree.getPath(file1)) {
          matchIgnoredFile = true;
        }
      });
      watcher.on('ready', function() {
        tree.modify(file1);
        tree.modify(file2);

        setTimeout(function() {
          assert(times, 1, 'report file2');
          assert(!matchIgnoredFile, 'home/bb/file1 should be ignored');
          done();
        }, 100);
      });
    });

    it('should be able to filter with regexp', function(done) {
      var dir = tree.getPath('home');
      var file1 = 'home/bb/file1';
      var file2 = 'home/bb/file2';

      var options = {
        delay: 0,
        recursive: true,
        filter:  /file2/
      }

      var times = 0;
      var matchIgnoredFile = false;
      watcher = watch(dir, options, function(evt, name) {
        times++;
        if (name === tree.getPath(file1)) {
          matchIgnoredFile = true;
        }
      });
      watcher.on('ready', function() {
        tree.modify(file1);
        tree.modify(file2);

        setTimeout(function() {
          assert(times, 1, 'report file2');
          assert(!matchIgnoredFile, 'home/bb/file1 should be ignored');
          done();
        }, 100);
      });
    });
  });

  describe('delay', function() {
    it('should have delayed response', function(done) {
      var dir = tree.getPath('home/a');
      var file = 'home/a/file1';
      var start;
      watcher = watch(dir, { delay: 300 }, function(evt, name) {
        assert(Date.now() - start > 300, 'delay not working');
        done();
      });
      watcher.on('ready', function() {
        tree.modify(file);
        start = Date.now();
      });
    });
  });
});

describe('parameters', function() {
  it('should throw error on non-existed file', function(done) {
    var somedir = tree.getPath('home/somedir');
    try {
      watcher = watch(somedir);
    } catch(err) {
      done();
    }
  });

  it('should accept filename as Buffer', function(done) {
    var fpath = tree.getPath('home/a/file1');
    watcher = watch(Buffer.from(fpath), { delay: 0 }, function(evt, name) {
      assert.equal(name, fpath);
      done();
    });
    watcher.on('ready', function() {
      tree.modify('home/a/file1');
    });
  });

  it('should compose array of files or directories', function(done) {
    var file1 = 'home/a/file1';
    var file2 = 'home/a/file2';
    var fpaths = [
      tree.getPath(file1),
      tree.getPath(file2)
    ];

    var times = 0;
    watcher = watch(fpaths, { delay: 0 }, function(evt, name) {
      if (fpaths.indexOf(name) !== -1) times++;
      if (times === 2) done();  // calling done more than twice causes mocha test to fail
    });

    // FIXME: composeWatcher doesn't support "ready" event
    tree.modify(file1);
    tree.modify(file2);
  });

  it('should filter duplicate events for composed watcher', function(done) {
    var file1 = 'home';
    var file2 = 'home/a';
    var file3 = 'home/a/file2';
    var newFile = 'home/a/newfile' + Date.now();
    var fpaths = [
      tree.getPath(file1),
      tree.getPath(file2),
      tree.getPath(file3)
    ];

    var changed = [];

    watcher = watch(fpaths, { delay: 0, recursive: true }, function(evt, name) {
      changed.push(name);
    });

    tree.modify(file3);
    tree.newFile(newFile);

    setTimeout(function() {
      assert.strictEqual(changed.length, 2, 'should log exactly 2 events');
      assert(~changed.indexOf(tree.getPath(file3)), 'should include ' + file3);
      assert(~changed.indexOf(tree.getPath(newFile)), 'should include ' + newFile);
      done();
    }, 300);
  });

});


describe('watcher object', function() {
  it('should using watcher object to watch', function(done) {
    var dir = tree.getPath('home/a');
    var file = 'home/a/file1';
    var fpath = tree.getPath(file);

    watcher = watch(dir, { delay: 0 });
    watcher.on('ready', function() {
      watcher.on('change', function(evt, name) {
        assert.equal(evt, 'update');
        assert.equal(name, fpath);
        done();
      });
      tree.modify(file);
    });
  });

  it('should close a watcher using .close()', function(done) {
    var dir = tree.getPath('home/a');
    var file = 'home/a/file1';
    var times = 0;
    watcher = watch(dir, { delay: 0 });
    watcher.on('change', function(evt, name) {
      times++;
    });
    watcher.on('ready', function() {

      watcher.close();

      tree.modify(file);
      tree.modify(file, 100);

      setTimeout(function() {
        assert(watcher.isClosed(), 'watcher should be closed');
        assert.equal(times, 0, 'failed to close the watcher');
        done();
      }, 150);
    });
  });

  it('Do not emit after close', function(done) {
    var dir = tree.getPath('home/a');
    var file = 'home/a/file1';
    var times = 0;
    watcher = watch(dir, { delay: 0 });
    watcher.on('change', function(evt, name) {
      times++;
    });
    watcher.on('ready', function() {

      watcher.close();

      var timer = setInterval(function() {
        tree.modify(file);
      });

      setTimeout(function() {
        clearInterval(timer);
        assert(watcher.isClosed(), 'watcher should be closed');
        assert.equal(times, 0, 'failed to close the watcher');
        done();
      }, 100);
    });
  });

});
