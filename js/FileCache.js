//read the contents of a file (initially don't) every time it changes
var util = require("./util").initUtil(global);
var fs = require("fs");
function FileCache(path){
 this.path = path;
}
var Fc = FileCache;

//combinators
function updaterReadbackCombinator(fnPlz, thrower, nop, that, callback, errback, error, data){
 if(error) return fnPlz(errback, thrower)(error);
 that.contents = data;
 return fnPlz(callback, nop)(data);
}
function updaterCombinator(partialEval, fnPlz, thrower, nop, readbackCombinator, reader, that, callback, errback){
 return reader(
  that.path,
  partialEval(
   readbackCombinator,
   [fnPlz, thrower, nop, that, callback, errback]
  )
 );
}
//closures
var partialEval = homoiconicPartialEval;
var updaterClosure = partialEval(updaterCombinator, [partialEval, fnPlz, thrower, nop, updaterReadbackCombinator]);


function updater(reader){
 return partialEval(
  function(closure, callback, errback){
   return closure(this, callback, errback);
  },
  [
   partialEval(updaterClosure, [reader])
  ]
 );
}


//great, so now we can update a file or directory
//next step, begin watching the path in question
function startWatch(callback, errorback){
 function watchback(curr, prev){
  if(curr.mtime <= prev.mtime) return;
  if(curr.isFile()) return this.updateFile(callback, errorback);
  if(curr.isDirectory()) return this.updateDirectory(callback, errorback);
  return errorback("I don't know what to do with that type of file.");
 }
 var me = this;
 function boundCallback(){
  watchback.apply(me, arguments);
 }
 boundCallback = bindThis(this, watchback);
 fs.watchFile(this.path, boundCallback);
}
function stopWatch(){
 fs.unwatchFile(this.path);//does that work like I want it to?
}

patchOb(
 Fc.prototype,
 {
  updateFile: updater(bindFrom(fs, "readFile")),
  updateDirectory: updater(bindFrom(fs, "readdir")),
  startWatch: startWatch,
  stopWatch: stopWatch
 }
);


this.FileCache = FileCache;
