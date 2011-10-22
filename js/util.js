//(C) 2011 Montana Rowe
//All Rights Reserved

//this file sucks
//most things in here have stupid names
//the object returned by importing this file is not self-documenting
//and nothing is commented
//even if I do document it, the documentation's sure to be out-of-date soon

function keys(ob){//captures for-in loop
 var result = [];
 for(var k in ob) result.push(k);
 return result;
}
function map(fn, arr){//captures for;; loop
 var result = [];
 for(var i = 0; i < arr.length; i++)
  result[i] = fn(arr[i]);
 return result;
}
var dumbMap = map;
function thrower(error){throw error;};//captures throw construct
function nop(){};//non-operation, the null function; does nothing
function please(predicate, prefer, fallback){//wants second parameter
 //assume predicate(fallback)
 if(predicate(prefer))
  return prefer;
 return fallback
}
function isFunction(fn){
 return "function" == typeof fn;
}
function fnPlz(prefer, fallback){
 if(!fallback) fallback = nop;
 return please(isFunction, prefer, fallback);
}
function searchArray(predicate, arr){
 for(var i = 0; i < arr.length; i++)
  if(predicate(arr, i))
   return i;
 return -1;
}
function arrayIndexOf(arr, elem){
 return searchArray(
  function(a, i){
   return elem == a[i];
  },
  arr
 );
}
function filterArrayAsSet(predicate, arr){
 var result = [];
 map(
  function(x){
   if(predicate(x))
    result.push(x);
  },
  arr
 )
 return result;
}

function dictionaryCell(ob, key){
 function get(){
  return ob[key];
 }
 function set(value){
  var result = get();
  ob[key] = value;
  return result;
 }
 return {get: get, set: set};
}
function cellAccess(value){
 return dictionaryCell([value], 0);
}

function secretBind(that, fn){
 return function(){return fn.apply(that, arguments);};
}
function secretBindName(ob, methodName){
 return secretBind(ob, ob[methodName]);
}
function secretGive(target, source, method){
 target[method] = secretBindName(source, method);
}



function dumbGetCopyField(target, source){
 //can't use patchOb because it depends upon this very function
 var result = function curriedCopyField(key){
  var me = arguments.callee;
  var old = me.target[key];
  me.target[key] = me.source[key];
  return old;
 }
 result.target = target;
 result.source = source;
 return result;
}
function patchOb(target, source){//useful for anonymous functions with properties
 //this is stupid
 //destructive
 map(
  dumbGetCopyField(target, source),
  keys(source)
 );
 return target;
}

function bindThis(that, fn){
 return patchOb(
  function boundCall(){
   var args = arguments;
   var me = args.callee;
   return me.fn.apply(me.that, args);
  },
  {that: that, fn: fn}
 );
}
function bindFrom(that, methodName){
 return bindThis(that, that[methodName]);
}

function fancyMap(fn){
 return patchOb(
  function(arr){
   var f = arguments.callee.callback;
   var result = [];
   for(var i = 0; i < arr.length; i++)
    result[i] = f(arr[i], i, arr);
   return result;
  },
  {
   callback: fnPlz(fn, I)
  }
 );
}

function unpackRecord(fn, argNames){
 return patchOb(
  function activate(actRec){
   var me = arguments.callee;
   return me.f.apply(
    this,
     map(
     function(x){
      return actRec[x]
     },
     me.argOrder
    )
   );
  },
  {f: fn, argOrder: argNames}
 );
}

var curry = (
 function(){
  function uglyCount(ac){
   var n = 0;
   while("object" == typeof ac && "ar" in ac){
    ac = ac.ar;
    n++;
   }
   return n;
  }
  function uglyFlatten(ac){
   var count = uglyCount(ac);
   var result = new Array(count);
   for(var i = count - 1; i >= 0; --i){
   result[i] = ac.dr;
    ac = ac.ar;
   }
   return result;
  }
  return patchOb(
   function curry(fn, n, accum){
    var curry = arguments.callee;
    switch(arguments.length){
     case 0: return;
     case 1: n = fn.length;
     case 2: accum = {};
    }
    if(n <= 0)
     return fn.apply(
      this,
      curry.uglyFlatten(accum)
     );
    return patchOb(
     function take(arg){
      var me = arguments.callee;
      return curry.call(
       this,
       me.f,
       me.n - 1,
       {
        ar: me.a,
        dr: arg
       }
      );
     },
     {
      a: accum,
      f: fn,
      n: n
     }
    );
   },
   {
    uglyCount: uglyCount,
    uglyFlatten: uglyFlatten
   }
  );
 }
)()

function buildDict(names, accum, idx){
 switch(arguments.length){
  case 0: names = [];
  case 1: accum = {};
  case 2: idx = 0;
 }
 if(idx >= names.length) return accum;
 return patchOb(
  function take(){
   var me = arguments.callee;
   var idx = me.index;
   var n = Math.min(arguments.length, me.ns.length - idx);
   for(var i = 0; i < n; i++)
    me.ac[me.ns[i+idx]] = arguments[i];
   idx += i;
   return buildDict(me.ns, me.ac, idx);
  },
  {
   ns: names,
   ac: accum,
   index: idx
  }
 );
}

function writeToKey(target, key, value){
 var result = target[key];
 target[key] = value;
 return result;
}


function takeProxy(target, source, key){
 var result = target[key];
 target[key] = bindFrom(source, key);
 return result;
}

function lookupOrDefault(key, dict, fallback){
 if(key in dict)
  return dict[key];
 return fallback;

 return please(
  function(d){return key in d;},
  dict,
  (
   function(k,v){
    var result = {};
    result[k] = v;
    return result;
   }
  )(key, fallback)
 )[key];
}

function strReplace(source, destination, input){
 return (""+input).split(source).join(destination);
}
function indent(str, indentation, ending){
 if(arguments.length < 3) ending = "\n";
 if(arguments.length < 2) indentation = " ";//why not tabs?
 return indentation + strReplace(ending, ending + indentation, str);
}

function homoiconicPartialEval(fn, firstFew){
 //warning! This won't work for everything
 return patchOb(
  function(){
   var me = arguments.callee;
   var params = [];
   map(
    function(xs){
     map(function(x){params.push(x)}, xs);
    },
    [me.someArgs, arguments]//can I map across arguments? Yes.
   );
   return me.fn.apply(this, params);
  },
  {
   fn: fn,
   someArgs: firstFew,
   maker: arguments.callee,
   toString: function toString(){
    return [
     "(",
     " (",
        indent(this.maker, "  "),
     " )(",
        indent(this.fn, "  ") + ",",
     "  [",
         indent(
          map(
           function stringify(x){
            if("string" == typeof x)
             return "\"" +
              strReplace(
               "\"",
               "\\\"",
               strReplace("\\", "\\\\", x)
              ) +
              "\"";
            if(x instanceof Array)
             return "[" + x + "]";
            return ""+x;
           },
           this.someArgs
          ).join(",\n"),
          "   "
         ),
     "  ]",
     " )",
     ")"
    ].join("\n");
   }
  }
 );
}
function callAll(fns, params){
 return map(
  function passTo(f){
   return f.apply(this, params);
  },
  fns
 );
}
function makeRacer(conditions, callback){
 return function(){
  if(
   allTrue(
    callAll(
     conditions,
     arguments
    )
   )
  )
   return callback();
 };
}

function reverseInputs(f){
 return patchOb(
  function(a,b){
   return arguments.callee.callback.call(this, b, a);
  },
  {callback: f}
 );
}


function throwOrPass(callback){
 return function(error, value){
  if(error) throw error;
  return callback(value);
 }
}

function atLeastOne(predicate, arr){
 var someAre = false;
 map(
  function(x){
   if(predicate(x))
    someAre = true;
  },
  arr
 )
 return someAre;
}
function allTrue(arr){
 return !atLeastOne(
  function isFalsep(x){return !x;},
  arr
 );
}

function flattenArrayArray(xss){//but no deeper!
 return [].concat.apply([], xss);
}

function arrayCons(ar, dr){
 return [ar, dr];
}
function curriedArrayCons(ar){
 return function(dr){
  return [ar, dr];
 }
}

function consToAll(head){
 var fn = curriedArrayCons(head);
 return function(tails){
  return map(fn, tails);
 }
}
function consToEach(tails){
 function mapper(fn){return map(fn, tails);}
 return function(head){
  return mapper(curriedArrayCons(head));
 }
}

function cartesianProduct(l, r){
 return flattenArrayArray(
  map(consToEach(r), l)
 );
}

function initUtil(g){patchOb(g, this); return this;}

function patchFunctions(ob, fns){
 map(function(f){ob[f.name] = f;}, fns);
}

function joinLines(lines, ending){
 if(arguments.length < 2) ending = "\n";
 return lines.join(ending);
}

function I(x){return x;};


function biCurry(f){
 return homoiconicPartialEval(
  function(f, a){
   return homoiconicPartialEval(
    function(f, a, b){
     return f(a, b);
    },
    [f, a]
   );
  },
  [f]
 );
}
function callWithFrom(key, param, ob){
 return ob[key](param);
}
var splitStrOn = homoiconicPartialEval(callWithFrom, ["split"]);
var joinArrWith = homoiconicPartialEval(callWithFrom, ["join"]);
function decapitate(arr){
 var head = arr[0];
 arr.shift();
 return [head, arr];
}
function compose(g,f){
 return biCurry(
  function(fg,x){
   return fg[0](
    fg[1](x)
   );
  }
 )(
  [f,g]
 );
}
function applyIt(f, args){
 return f.apply(this, args);
}
function trimInitialSpace(str){
 return str.substring(
  " " == str.charAt(0) ?
   1 :
   0
 );
}
function biZip(f, g, x, y){
 return [f(x), g(y)];
}
function buildPatch(key, val){
 var result = {};
 result[key] = val;
 return result;
}
function fold(cata, data, initial){
 var result = initial;
 map(function(datum){result = cata(result, datum)}, data);
 return result;
}
function composeFns(fns){
 if(fns.length == 0) return I;
 if(fns.length == 1) return fns[0];
 var cell = decapitate(fns);
 return compose(cell[0], composeFns(cell[1]));
}

function passIt(f, x){return f(x);};
var lassoc = function(arr){return fold(passIt, arr, I);}
var passTo = biCurry(passIt);
var applyTo = biCurry(applyIt);
var arrToPatch = applyTo(buildPatch);
var biZipTo = compose(biCurry(homoiconicPartialEval)(biZip), applyTo);
var splitOn = biCurry(splitStrOn);
var applyFold = biCurry(fold)(applyIt);





var arrayUtil = [
 keys, map, dumbMap, fancyMap,
 arrayIndexOf, filterArrayAsSet, searchArray,
 atLeastOne, allTrue, callAll,
 cartesianProduct, flattenArrayArray,
 arrayCons, curriedArrayCons,
 consToAll, consToEach,
 joinLines
];

patchFunctions(this, arrayUtil);

patchOb(
 this,
 {
  curry: curry,
  writeToKey: writeToKey,
  patchOb: patchOb,
  fnPlz: fnPlz,
  bindThis: bindThis,
  nop: nop,
  thrower: thrower,
  bindFrom: bindFrom,
  secretBind: secretBind,
  secretBindName: secretBindName,
  secretGive: secretGive,
  initUtil: initUtil,
  dumbGetCopyField: dumbGetCopyField,
  please: please,
  isFunction: isFunction,
  cellAccess: cellAccess,
  buildDict: buildDict,
  unpackRecord: unpackRecord,
  takeProxy: takeProxy,
  lookupOrDefault: lookupOrDefault,
  homoiconicPartialEval: homoiconicPartialEval,
  makeRacer: makeRacer,
  reverseInputs: reverseInputs,
  throwOrPass: throwOrPass,
  strReplace: strReplace,
  indent: indent,
  I: I,
  dumbMap: dumbMap,
  patchFunctions: patchFunctions
 }
);

patchFunctions(
 this,
 [
  biCurry,
  callWithFrom,
  decapitate,
  compose,
  applyIt,
  trimInitialSpace,
  biZip,
  buildPatch,
  fold,
  composeFns,
  passIt
 ]
);

patchOb(
 this,
 {
  splitStrOn: splitStrOn,
  joinArrWith: joinArrWith,
  lassoc: lassoc,
  passTo: passTo,
  applyTo: applyTo,
  arrToPatch: arrToPatch,
  biZipTo: biZipTo,
  splitOn: splitOn,
  applyFold: applyFold
 }
);
