var url = require("url");
var libStream = require("./stream.lib");
var readSponge = libStream.readSponge;
var FileCache = require("./FileCache").FileCache;

var cookieCrumbToPatch = composeFns(
 [
  splitOn("="),
  decapitate,
  biZipTo(
   [trimInitialSpace, biCurry(joinArrWith)("=")]
  ),
  arrToPatch
 ]
);
function parseCookieStringCombinator(
 composeFns, patchTo, composeTo, mapAcross, lassoc, splitOn, 
 crumbToPatch, str
){
 //giveCrumbsTo ob crumbs = composeFns [patchTo (composeTo crumbToPatch) mapAcross] ob crumbs
 // = mapAcross (composeTo crumbToPatch (patchTo ob)) crumbs
 // = map (lambda crumb . composeTo crumbToPatch (patchTo ob) crumb) crumbs
 // = map (lambda crumb . patchTo ob (crumbToPatch crumb)) crumbs
 // = map (patchTo ob) (map crumbToPatch crumbs)
 var giveCrumbsTo = composeFns(
  [
   patchTo,
   composeTo(crumbToPatch),
   mapAcross
  ]
 );

 var mutateInto = composeTo(giveCrumbsTo)(composeTo(splitOn(";")));
 // = composeTo giveCrumbsTo (composeTo splitOn ";")
 // = lambda cookies . composeTo giveCrumbsTo (composeTo (splitOn ";")) cookies
 // = lambda cookies . composeTo (splitOn ";") (giveCrumbsTo cookies)
 // = lambda cookies str . composeTo (splitOn ";") (giveCrumbsTo cookies) str
 // = lambda cookies str . giveCrumbsTo cookies (splitOn ";" str)
 // = lambda cookies str . map (patchTo cookies) (map crumbToPatch (splitOn ";" str))
 // = function(cookies){return function(str){return map(patchTo(cookies), map(crumbToPatch, splitOn(";")(str)));};}

 var cookies = {};
 mutateInto(cookies)(str);
 // = map(patchTo(cookies), map(crumbToPatch, splitOn(";")(str)));
 return cookies;

}
function getCookiesCombinator(
 biCurry, patchOb, compose, map,
 composeFns, lassoc, splitOn, 
 parseCookieStringCombinator, cookieCrumbToPatch, req
){
 if("cookie" in req.headers)
  return parseCookieStringCombinator(
   composeFns,
   biCurry(patchOb),
   biCurry(compose),
   biCurry(map),
   lassoc, splitOn, 
   cookieCrumbToPatch,
   req.headers.cookie
  );
 return {};
}

var getCookies = homoiconicPartialEval(
 getCookiesCombinator,
 [
  biCurry, patchOb, compose, map,
  composeFns, lassoc, splitOn, 
  parseCookieStringCombinator, cookieCrumbToPatch
 ]
);

function sendStaticHtml(res, body, statusCode){
 if(arguments.length < 3)
  statusCode = 200;
 res.writeHead(statusCode, {"Content-Type": "text/html"});
 return res.end(body);
}

function parsePostForm(postdata){
 var form = {};
 var pairs = map(
  function splitOnFirstEquals(field){
   var p = field.split("=");
   var k = p[0];
   p.shift();
   return [k,p.join("=")];
  },
  postdata.split("&")
 );
 map(
  function(kp){
   var k = kp[0];
   if(" " == k.charAt(0))
    k = k.substring(1);
   var p = kp[1];
   if(!(k in form))
    form[k] = [];
   form[k].push(
    decodeURIComponent(
     p.split("+").join(" ")
    )
   );
  },
  pairs
 );
 return form;
}

function readPostForm(req, callback){
 function parseThePost(postdata){
  var form = parsePostForm(postdata);
  map(
   function(k){
    if(form[k].length == 1)
     form[k] = form[k][0];//php-style
   },
   keys(form)
  );
  return callback(form);
 }
 return readSponge(req, parseThePost);
}


function cookieDateUncurried(spawn, soak, time, callback){
 return soak(
  spawn(
   "date",
   [
    "-ud",
    time,
    "+%a, %d-%b-%Y %T %Z"
   ]
  ).stdout,
  function(dateBuffer){
   return callback(
    dateBuffer.split("\n")[0]
   );
  }
 );
}

function getStaticlike(body, status){
 if(arguments.length < 2)
  status = 200;
 if(0 == arguments.length)
  body = "O hi.";
 return patchOb(
  function(res, req, body){
   var me = arguments.callee;
   if(arguments.length < 3)
    body = me.default;
   return sendStaticHtml(res, body, me.code);
  },
  {
   default: body,
   code: status
  }
 );
}

function reqPath(req){
 var p = url.parse(req.url).pathname.split("/");
 if("" == p[0]) p.shift();
 return p;
}


//TODO: use this and bring it in
function allowCrossSite(req, res, headers){
 //no need to take in res...
 if("origin" in req.headers)
  headers["Access-Control-Allow-Origin"] = req.headers.origin;
 return headers;
}


function ServerFunction(serveRoot){
 if(arguments.length > 0)
  if("function" == typeof serveRoot)
   this.serveRoot = serveRoot;
 this.kids = {}; 
}

patchOb(
 ServerFunction.prototype,
 {
  serve: function serve(req, res, path){
   try{
    //setup default values
    if(arguments.length < 3)
     path = reqPath(req);
    if(!("length" in path))
     path = [];//how dare you pass me a broken path like that!

    //root case
    if(0 == path.length)
     return this.serveRoot(req, res, path);
    if(1 == path.length && "" == path[0])
     return this.serveRoot(req, res, path);

    //inductive case
    var kid = this.getChild(path[0]);
    var k = path[0];
    path.shift();
    return kid.serve(req, res, path);
   }
   catch(e){
    console.log(e.stack);
    res.writeHead(500);
    res.end("Oops! Something broke; ask an admin to check the logs.");
   }
  },
  serveRoot: function serveRoot(req, res, path){
   res.writeHead(404);
   res.end("This server doesn't have a root.");
  },
  getChild: function(kidName){
   var me = this;
   if(!(kidName in this.kids))
    return {serve: function(req, res, path){return me.getNotFound.serve(req, res, [kidName]);}};
   var result = this.kids[kidName];
   if("serve" in result)
    return result;

   function nonServer(req, res){
    res.writeHead(500);
    res.end(kidName + " isn't a server for some reason, though it's filed away where only servers should go.");
   }
   result = new ServerFunction(nonServer);
   result.getNotFound = result;
   return result;
  },
  getNotFound: patchOb(
   new ServerFunction(),
   {
    serve: function(req, res, path){
     if(!path) path = reqPath(req);
     return this.serveRoot(req, res, path);
    },
    serveRoot: function serve(req, res, path){
     res.writeHead(404);
     res.end("\"" + path.join("/") + "\"" + " not found");
    },
    getChild: function(kidName){return this;}
   }
  )
 }
)

function staticServe(path, mimetype){
 var headers = {};
 if(mimetype) headers["Content-Type"] = mimetype;
 var cache = new FileCache(path);
 function setRedundant(data){if("" != data) arguments.callee.redundant = data;};
 setRedundant.redundant = "";
 cache.startWatch(setRedundant);
 cache.updateFile(setRedundant);
 return patchOb(
  function serveStatic(req, res){
   var me = arguments.callee;
   if(!("contents" in me.cache)){
    res.writeHead(404);
    res.end("oops, cache is missing");
    return;
   }
   res.writeHead(200, headers);
   res.end(me.cache.contents != "" ? me.cache.contents : me.setRedundant.redundant);
   return;
  },
  {
   cache: cache,
   setRedundant: setRedundant
  }
 );
}




patchOb(
 this,
 {
  cookieCrumbToPatch: cookieCrumbToPatch,
  getCookies: getCookies
 }
);
patchFunctions(
 this,
 [
  parseCookieStringCombinator,
  getCookiesCombinator,
  sendStaticHtml,
  parsePostForm,
  readPostForm,
  cookieDateUncurried,
  getStaticlike,
  reqPath,
  ServerFunction,
  staticServe
 ]
);
